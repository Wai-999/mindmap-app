import { useEffect } from "react";

import { useEditorStore } from "@/store/editor-store";
import type { AttachmentRecord } from "@/types/mindmap";

// Fetches every attachment for the whole mindmap once (no nodeId filter) so any node
// can cheaply show its own thumbnail, and the inspector panel doesn't need its own
// per-node fetch. Re-runs on mindmapId change (a fresh navigation), matching the
// pattern of the shell's own loadMindmap/initAutosave effects.
export function useFetchAttachments(endpoint: string, mindmapId: string) {
  const setAttachments = useEditorStore((s) => s.setAttachments);

  useEffect(() => {
    fetch(`${endpoint}/attachments`)
      .then((res) => (res.ok ? res.json() : { attachments: [] }))
      .then((data: { attachments?: AttachmentRecord[] }) => {
        // The server always stores the owner-authenticated download path (see
        // lib/mindmap/attachments.ts's own comment on this), which 401s for a
        // logged-out share-link visitor. Rewritten here to whichever endpoint this
        // request actually came from — /api/mindmaps/{id} for the owner, or the
        // token-scoped /api/shared/{token} route, which has its own matching
        // attachments/{id} download handler — so every consumer (this node's
        // thumbnail, the inspector panel's file links) can just use `url` as-is
        // without needing to know which context it's rendering in.
        const attachments = (data.attachments ?? []).map((a) => ({
          ...a,
          url: `${endpoint}/attachments/${a.id}`,
        }));
        setAttachments(attachments);
      })
      .catch(() => setAttachments([]));
    // Intentionally scoped to mindmapId, not endpoint — see mindmap-editor-shell.tsx's
    // own loadMindmap effect for the same reasoning (endpoint is derived from it and
    // share tokens don't change mid-session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindmapId]);
}
