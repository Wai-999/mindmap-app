import { useEditorStore } from "@/store/editor-store";
import { captureThumbnail } from "@/lib/mindmap/capture-thumbnail";
import type { MindmapContent } from "@/types/mindmap";

const DEBOUNCE_MS = 800;
const FALLBACK_INTERVAL_MS = 10_000;

export interface ConflictDetail {
  content: MindmapContent;
  updatedAt: string;
}

// endpoint is the full PATCH URL — either the owner route (/api/mindmaps/[id]) or the
// public share-link route (/api/shared/[token]) when editing through a shared link.
// includeThumbnail is skipped on the unload/visibility-change flush path, where the
// priority is getting the content save out before the page disappears, not spending
// extra time rasterizing a preview image.
async function flush(endpoint: string, includeThumbnail = true) {
  const state = useEditorStore.getState();
  if (!state.dirty || state.saveStatus === "saving") return;

  const revisionAtFlushStart = state.revision;
  const content: MindmapContent = { nodes: state.nodes, edges: state.edges };

  useEditorStore.getState().markSaving();

  const thumbnail = includeThumbnail ? await captureThumbnail().catch(() => null) : null;

  try {
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        title: state.title,
        content,
        clientUpdatedAt: state.lastSyncedUpdatedAt,
        thumbnail,
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

export function initAutosave(endpoint: string): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = useEditorStore.subscribe(
    (s) => s.revision,
    () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void flush(endpoint), DEBOUNCE_MS);
    },
  );

  const fallback = setInterval(() => void flush(endpoint), FALLBACK_INTERVAL_MS);

  function handleVisibilityOrUnload() {
    if (useEditorStore.getState().dirty) void flush(endpoint, false);
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

export function forceSave(endpoint: string): Promise<void> {
  return flush(endpoint);
}
