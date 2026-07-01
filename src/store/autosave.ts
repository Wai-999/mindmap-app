import { useEditorStore } from "@/store/editor-store";
import type { MindmapContent } from "@/types/mindmap";

const DEBOUNCE_MS = 800;
const FALLBACK_INTERVAL_MS = 10_000;

export interface ConflictDetail {
  content: MindmapContent;
  updatedAt: string;
}

async function flush(mindmapId: string) {
  const state = useEditorStore.getState();
  if (!state.dirty || state.saveStatus === "saving") return;

  const revisionAtFlushStart = state.revision;
  const content: MindmapContent = { nodes: state.nodes, edges: state.edges };

  useEditorStore.getState().markSaving();

  try {
    const res = await fetch(`/api/mindmaps/${mindmapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        title: state.title,
        content,
        clientUpdatedAt: state.lastSyncedUpdatedAt,
      }),
    });

    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as ConflictDetail | null;
      useEditorStore.getState().markSaveError();
      if (body) {
        window.dispatchEvent(new CustomEvent<ConflictDetail>("mindmap:conflict", { detail: body }));
      }
      return;
    }

    if (!res.ok) {
      useEditorStore.getState().markSaveError();
      return;
    }

    const body = (await res.json()) as { updatedAt: string };
    useEditorStore.getState().markSaved(body.updatedAt, revisionAtFlushStart);
  } catch {
    useEditorStore.getState().markSaveError();
  }
}

export function initAutosave(mindmapId: string): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = useEditorStore.subscribe(
    (s) => s.revision,
    () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void flush(mindmapId), DEBOUNCE_MS);
    },
  );

  const fallback = setInterval(() => void flush(mindmapId), FALLBACK_INTERVAL_MS);

  function handleVisibilityOrUnload() {
    if (useEditorStore.getState().dirty) void flush(mindmapId);
  }
  window.addEventListener("beforeunload", handleVisibilityOrUnload);
  document.addEventListener("visibilitychange", handleVisibilityOrUnload);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    clearInterval(fallback);
    window.removeEventListener("beforeunload", handleVisibilityOrUnload);
    document.removeEventListener("visibilitychange", handleVisibilityOrUnload);
    unsubscribe();
  };
}

export function forceSave(mindmapId: string): Promise<void> {
  return flush(mindmapId);
}
