import { create } from "zustand";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

export interface HistorySnapshot {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

const MAX_HISTORY = 100;

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Called with the state as it was *before* a mutation, right before applying that
  // mutation — one commit = one user-perceived action, not one per keystroke/frame.
  commit: (snapshot: HistorySnapshot) => void;
  undo: (current: HistorySnapshot) => HistorySnapshot | null;
  redo: (current: HistorySnapshot) => HistorySnapshot | null;
  reset: () => void;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],

  commit: (snapshot) =>
    set((s) => ({
      past: [...s.past, snapshot].slice(-MAX_HISTORY),
      future: [],
    })),

  undo: (current) => {
    const { past, future } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, MAX_HISTORY),
    });
    return previous;
  },

  redo: (current) => {
    const { past, future } = get();
    if (future.length === 0) return null;

    const next = future[0];
    set({
      past: [...past, current].slice(-MAX_HISTORY),
      future: future.slice(1),
    });
    return next;
  },

  reset: () => set({ past: [], future: [] }),
}));
