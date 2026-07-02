import { useEditorStore } from "@/store/editor-store";
import { captureThumbnail } from "@/lib/mindmap/capture-thumbnail";
import { roomActiveRef, isElectedSaverRef } from "@/lib/liveblocks/collab-state";
import type { MindmapContent } from "@/types/mindmap";

const DEBOUNCE_MS = 800;
const FALLBACK_INTERVAL_MS = 10_000;
// Rasterizing the whole canvas (html-to-image cloning every node's DOM) is the one
// genuinely expensive part of a save — cheap enough to not notice once in a while,
// but doing it on every single debounced save (as often as every 800ms while
// actively editing) was visibly janky. The dashboard thumbnail doesn't need to be
// that fresh, so it's throttled independently of the content save itself.
const THUMBNAIL_MIN_INTERVAL_MS = 30_000;
let lastThumbnailAt = 0;

// Runs the capture during browser idle time rather than synchronously in the middle
// of a debounce callback, so its cost lands when nothing else is competing for the
// main thread. Safari has no requestIdleCallback at all, hence the setTimeout fallback.
function captureThumbnailWhenIdle(): Promise<string | null> {
  return new Promise((resolve) => {
    const run = () => void captureThumbnail().then(resolve, () => resolve(null));
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  });
}

export interface ConflictDetail {
  content: MindmapContent;
  updatedAt: string;
}

// endpoint is the full PATCH URL — either the owner route (/api/mindmaps/[id]) or the
// public share-link route (/api/shared/[token]) when editing through a shared link.
// includeThumbnail is skipped on the unload/visibility-change flush path, where the
// priority is getting the content save out before the page disappears, not spending
// extra time rasterizing a preview image. isRetry is set only by the 409-conflict
// retry-once path below — never by a normal caller.
async function flush(endpoint: string, includeThumbnail = true, isRetry = false) {
  const state = useEditorStore.getState();
  if (!state.dirty || state.saveStatus === "saving") return;

  // While a Liveblocks room is live, only the elected saver actually PATCHes the DB —
  // everyone else already has every edit via Storage sync, so their UI is never stale,
  // they just don't independently write (see lib/liveblocks/elect-saver.ts). Solo mode
  // (roomActiveRef.current === false) is completely unaffected: isElectedSaverRef
  // defaults to "always true" so this check is a no-op then.
  //
  // Still clear this tab's own dirty flag before returning — otherwise a non-elected
  // tab's save-status indicator gets stuck on "Unsaved changes" forever, even once the
  // elected saver has actually persisted the exact same content (a real bug caught by
  // testing against two genuinely connected clients, not just mocks).
  if (roomActiveRef.current && !isElectedSaverRef.current() && !isRetry) {
    useEditorStore.setState({ dirty: false, saveStatus: "saved" });
    return;
  }

  const revisionAtFlushStart = state.revision;
  const content: MindmapContent = { nodes: state.nodes, edges: state.edges };

  useEditorStore.getState().markSaving();

  // null here just means "leave the dashboard thumbnail as whatever it already is" —
  // the update route only touches the stored thumbnail when it's given a real value
  // (see applyMindmapUpdate), so skipping the capture entirely on most saves is safe.
  const shouldCaptureThumbnail = includeThumbnail && Date.now() - lastThumbnailAt >= THUMBNAIL_MIN_INTERVAL_MS;
  if (shouldCaptureThumbnail) lastThumbnailAt = Date.now();
  const thumbnail = shouldCaptureThumbnail ? await captureThumbnailWhenIdle() : null;

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

      // While a room is live, this client's content is already the CRDT-merged result
      // everyone in the room agrees on — a 409 here means some *other*, non-room
      // writer's save raced with ours, not a real edit conflict with what's on screen.
      // Retrying once against the server's own updatedAt is correct (not a silent
      // data-loss risk) specifically because the content being saved already reflects
      // every room member's edits, unlike the conflicting writer's content.
      if (roomActiveRef.current && !isRetry && body) {
        useEditorStore.setState({ lastSyncedUpdatedAt: body.updatedAt });
        await flush(endpoint, includeThumbnail, true);
        return;
      }

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
