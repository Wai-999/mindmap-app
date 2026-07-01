import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createClient, type Json } from "@liveblocks/client";
import { liveblocks, type WithLiveblocks } from "@liveblocks/zustand";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { shareTokenRef } from "@/lib/liveblocks/collab-state";

// The presence generic passed to WithLiveblocks below — gives `liveblocks.others[].presence`
// proper types instead of falling back to a generic JSON-object shape. The index
// signature is required to satisfy Liveblocks' JsonObject constraint.
export interface MindmapPresence {
  name: string;
  color: string;
  selectedNodeId: string | null;
  [key: string]: Json | undefined;
}

interface LiveblocksState {
  // Storage-synced (see storageMapping below) — the live, CRDT-merged copy of the
  // canvas while a room is active. editor-store.ts stays the single source of truth
  // for everything else (selection, editing, undo); only nodes/edges cross the bridge.
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  setContent: (nodes: MindmapNode[], edges: MindmapEdge[]) => void;

  // Presence-synced (see presenceMapping below) — this client's own broadcast state,
  // used to render remote-collaborator selection rings and the avatar stack. Assigned
  // once per tab in liveblocks-room-provider.tsx, not read back from other stores.
  name: string;
  color: string;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

const client = createClient({
  authEndpoint: async (room) => {
    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, token: shareTokenRef.current ?? undefined }),
    });
    if (!res.ok) throw new Error(`Liveblocks auth failed: ${res.status}`);
    return res.json();
  },
});

// A single store, wrapped by @liveblocks/zustand's middleware — both storage sync
// (nodes/edges) and presence (name/color/selectedNodeId, plus the `others` this
// middleware exposes for free on `.liveblocks.others`) go through it. There's no need
// for a separate presence mechanism: the middleware already tracks connected peers
// reactively, so a second library for that would add a dependency without adding
// capability. subscribeWithSelector wraps it too (same pattern as editor-store.ts) so
// liveblocks-bridge.tsx can subscribe to just nodes/edges rather than the whole store —
// safe to compose here since this is a brand-new store with no existing middleware or
// test coverage to risk, unlike editor-store.ts (see the plan's note on why the bridge
// exists as a separate store in the first place).
export const useLiveblocksStore = create<WithLiveblocks<LiveblocksState, MindmapPresence>>()(
  subscribeWithSelector(
    liveblocks(
      (set) => ({
        nodes: [],
        edges: [],
        setContent: (nodes, edges) => set({ nodes, edges }),

        name: "",
        color: "",
        selectedNodeId: null,
        setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      }),
      {
        client,
        storageMapping: { nodes: true, edges: true },
        presenceMapping: { name: true, color: true, selectedNodeId: true },
      },
    ),
  ),
);
