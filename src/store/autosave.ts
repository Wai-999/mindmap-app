import { useEditorStore } from "@/store/editor-store";
import { captureThumbnail } from "@/lib/mindmap/capture-thumbnail";
import { roomActiveRef, isElectedSaverRef } from "@/lib/liveblocks/collab-state";
import type { MindmapContent } from "@/types/mindmap";

// A save that fails outright (network error, or a non-2xx/409 response) is queued
// here so it isn't lost if the tab closes before a retry succeeds — recovered by
// initAutosave the next time this exact mindmap is opened (see recoverPendingSave
// below). Keyed by endpoint since the owner route and a share-link route are
// different mindmaps as far as this cache is concerned.
interface PendingSave {
  content: MindmapContent;
  title: string;
  clientUpdatedAt: string | null;
}

function pendingSaveKey(endpoint: string): string {
  return `mindmap:pending-save:${endpoint}`;
}

function readPendingSave(endpoint: string): PendingSave | null {
  try {
    const raw = localStorage.getItem(pendingSaveKey(endpoint));
    return raw ? (JSON.parse(raw) as PendingSave) : null;
  } catch {
    return null;
  }
}

function writePendingSave(endpoint: string, save: PendingSave) {
  try {
    localStorage.setItem(pendingSaveKey(endpoint), JSON.stringify(save));
  } catch {
    // Quota errors or private-browsing storage restrictions — losing this safety
    // net silently is no worse than not having built it in the first place.
  }
}

function clearPendingSave(endpoint: string) {
  try {
    localStorage.removeItem(pendingSaveKey(endpoint));
  } catch {
    // see writePendingSave
  }
}

// Recovers a save that never made it to the server into the just-loaded editor
// state, but ONLY if nothing else has touched this mindmap since — i.e. the
// queued save's clientUpdatedAt still matches what the server just reported as
// current. If it doesn't match, some other save (a collaborator's, or this same
// browser's own later successful retry) has already superseded it, and forcing
// the stale queued content back in would itself be a data-loss bug of exactly
// the kind this is meant to prevent — so it's discarded instead.
function recoverPendingSave(endpoint: string) {
  const pending = readPendingSave(endpoint);
  if (!pending) return;

  const state = useEditorStore.getState();
  if (pending.clientUpdatedAt !== state.lastSyncedUpdatedAt) {
    clearPendingSave(endpoint);
    return;
  }

  state.applyRemoteContent(pending.content.nodes, pending.content.edges);
  if (pending.title !== state.title) state.setTitle(pending.title);
  clearPendingSave(endpoint);
}

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
      // A 409 means the server has already moved past clientUpdatedAt — any queued
      // save from an earlier failed attempt is now provably stale (see
      // recoverPendingSave's own staleness check), so there's nothing left to keep.
      clearPendingSave(endpoint);
      if (body) {
        window.dispatchEvent(new CustomEvent<ConflictDetail>("mindmap:conflict", { detail: body }));
      }
      return;
    }

    if (!res.ok) {
      useEditorStore.getState().markSaveError();
      writePendingSave(endpoint, { content, title: state.title, clientUpdatedAt: state.lastSyncedUpdatedAt });
      return;
    }

    const body = (await res.json()) as { updatedAt: string };
    useEditorStore.getState().markSaved(body.updatedAt, revisionAtFlushStart);
    clearPendingSave(endpoint);
  } catch {
    useEditorStore.getState().markSaveError();
    writePendingSave(endpoint, { content, title: state.title, clientUpdatedAt: state.lastSyncedUpdatedAt });
  }
}

// Used only for the beforeunload/visibilitychange path below, where the priority
// is getting *something* durable out before the page disappears rather than
// running the full flush() (which awaits a thumbnail capture and a JSON response
// neither of which matter once the tab is gone). navigator.sendBeacon is built
// for exactly this — the browser guarantees best-effort delivery even after the
// page has already unloaded, unlike a plain fetch (even with keepalive: true,
// which Chromium still caps to a small request-body size that a real mindmap can
// exceed). We can't read a response from a beacon, so the queued pending-save
// entry is written unconditionally and left for initAutosave's own
// clientUpdatedAt check on next load to decide whether it was actually needed —
// if this send did land, the server's updatedAt will have moved on and the
// queued copy will correctly be recognized as stale and discarded then.
function flushOnUnload(endpoint: string) {
  const state = useEditorStore.getState();
  if (!state.dirty || state.saveStatus === "saving") return;
  if (roomActiveRef.current && !isElectedSaverRef.current()) {
    useEditorStore.setState({ dirty: false, saveStatus: "saved" });
    return;
  }

  const content: MindmapContent = { nodes: state.nodes, edges: state.edges };
  writePendingSave(endpoint, { content, title: state.title, clientUpdatedAt: state.lastSyncedUpdatedAt });

  const payload = JSON.stringify({
    title: state.title,
    content,
    clientUpdatedAt: state.lastSyncedUpdatedAt,
    thumbnail: null,
  });

  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
  } else {
    // Only reachable on a browser old enough to lack sendBeacon entirely.
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: payload,
    });
  }
}

export function initAutosave(endpoint: string): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // loadMindmap has already run by this point (mindmap-editor-shell and
  // shared-mindmap-viewer both call it in an effect declared before this one, and
  // React runs same-render effects in declaration order) — lastSyncedUpdatedAt
  // already reflects the freshly-loaded server state, so it's safe to check here.
  recoverPendingSave(endpoint);

  const unsubscribe = useEditorStore.subscribe(
    (s) => s.revision,
    () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void flush(endpoint), DEBOUNCE_MS);
    },
  );

  const fallback = setInterval(() => void flush(endpoint), FALLBACK_INTERVAL_MS);

  function handleVisibilityOrUnload() {
    flushOnUnload(endpoint);
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
