"use client";

import { useEffect, useRef } from "react";

import { useEditorStore } from "@/store/editor-store";
import { useLiveblocksStore } from "@/store/liveblocks-store";
import { shouldApplyRemoteChange } from "@/lib/liveblocks/should-apply-remote-change";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function contentKey(nodes: MindmapNode[], edges: MindmapEdge[]): string {
  return JSON.stringify({ nodes, edges });
}

interface LiveblocksBridgeProps {
  // False for a VIEW-only share-link visitor: the room grants them READ_ACCESS only
  // (enforced server-side by /api/liveblocks-auth regardless of this flag), but the
  // bridge shouldn't even attempt to write on their behalf — editor-store's own
  // readOnly flag already blocks every local edit action for them, so there is
  // nothing legitimate to push outward, and not trying keeps this component's
  // behavior honest about what a read-only visitor's connection actually does.
  canWrite?: boolean;
}

// Keeps editor-store (the app's single source of truth for everything else) and
// liveblocks-store (the Liveblocks-synced copy of just nodes/edges) mirroring each
// other while a room is active. Renders nothing — pure effect component, mounted only
// when collaboration is enabled (see liveblocks-room-provider.tsx).
export function LiveblocksBridge({ canWrite = true }: LiveblocksBridgeProps) {
  const lastSyncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (canWrite) {
      // Seed liveblocks-store with whatever editor-store already has before either
      // subscription fires, so a first-to-join client seeds Storage with real content
      // instead of an empty canvas (see @liveblocks/zustand's reconcilePartially,
      // which only fills in keys Storage doesn't have yet).
      const initial = useEditorStore.getState();
      lastSyncedKey.current = contentKey(initial.nodes, initial.edges);
      useLiveblocksStore.getState().setContent(initial.nodes, initial.edges);
    }

    // Keyed off `revision`, not the raw node/edge content — same reasoning as
    // autosave.ts's own subscription. React Flow attaches incidental internal
    // metadata to node objects outside of any real edit (e.g. `measured` dimensions
    // once its ResizeObserver first measures a node), which changes `contentKey`'s
    // output without editor-store treating it as a meaningful edit (see
    // onNodesChange). Pushing on every such change let two tabs' unrelated
    // measurement updates race with and sometimes clobber each other's real edits in
    // Storage — caught only by testing against two genuinely connected clients.
    const unsubEditor = canWrite
      ? useEditorStore.subscribe(
          (s) => s.revision,
          () => {
            const { nodes, edges } = useEditorStore.getState();
            const key = contentKey(nodes, edges);
            if (!shouldApplyRemoteChange(key, lastSyncedKey.current)) return;
            lastSyncedKey.current = key;
            useLiveblocksStore.getState().setContent(nodes, edges);
          },
        )
      : undefined;

    const unsubLiveblocks = useLiveblocksStore.subscribe(
      (s) => contentKey(s.nodes, s.edges),
      (key) => {
        if (!shouldApplyRemoteChange(key, lastSyncedKey.current)) return;
        lastSyncedKey.current = key;
        const { nodes, edges } = useLiveblocksStore.getState();
        useEditorStore.getState().applyRemoteContent(nodes, edges);
      },
    );

    return () => {
      unsubEditor?.();
      unsubLiveblocks();
    };
  }, [canWrite]);

  return null;
}
