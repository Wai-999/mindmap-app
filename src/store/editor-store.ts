import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange } from "@xyflow/react";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { generateNodeId, generateEdgeId } from "@/lib/mindmap/id";
import { getParentId, getChildIds, getSubtreeIds } from "@/lib/mindmap/tree-utils";
import { resolveNewNodeColor, resolveNewRootColor } from "@/lib/mindmap/color";
import { useHistoryStore } from "@/store/history-store";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorState {
  mindmapId: string | null;
  title: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  // True for a share link with VIEW permission — canvas renders but nothing mutates.
  readOnly: boolean;

  // Bumped by every content-affecting mutation (not selection/editing-focus changes).
  // autosave.ts subscribes to this specifically so it can debounce "time since the
  // last real edit" instead of "time since the last store update of any kind."
  revision: number;
  dirty: boolean;
  saveStatus: SaveStatus;
  lastSyncedUpdatedAt: string | null;

  loadMindmap: (input: {
    id: string;
    title: string;
    nodes: MindmapNode[];
    edges: MindmapEdge[];
    updatedAt: string;
    readOnly?: boolean;
  }) => void;

  onNodesChange: (changes: NodeChange<MindmapNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<MindmapEdge>[]) => void;
  commitBeforeDrag: () => void;

  selectNode: (id: string | null) => void;
  setEditingNode: (id: string | null) => void;
  setTitle: (title: string) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, color: string) => void;
  toggleCollapsed: (id: string) => void;

  addChildNode: (parentId: string) => string | null;
  addSiblingNode: (nodeId: string) => string | null;
  // A new independent primary idea — no parent edge. Also the fallback target when
  // addSiblingNode is called on a root (a root's "sibling" is a new root).
  addRootNode: () => string | null;
  deleteNodeAndSubtree: (nodeId: string) => void;
  duplicateSubtree: (nodeId: string) => string | null;
  applyLayout: (positions: Record<string, { x: number; y: number }>) => void;
  // Wholesale swap for import — unlike loadMindmap, this is a real edit: it commits
  // history (so import is one Undo away) and marks the canvas dirty for autosave,
  // rather than treating the new content as "just synced from the server."
  replaceContent: (nodes: MindmapNode[], edges: MindmapEdge[]) => void;
  // Wholesale swap from a remote collaborator's edit (via the Liveblocks bridge).
  // Deliberately does NOT commit history, unlike replaceContent — a local Cmd+Z should
  // only ever undo this browser's own actions, never a peer's edit that just arrived.
  applyRemoteContent: (nodes: MindmapNode[], edges: MindmapEdge[]) => void;

  undo: () => void;
  redo: () => void;

  markSaving: () => void;
  markSaved: (updatedAt: string, savedRevision: number) => void;
  markSaveError: () => void;
}

function computeChildPosition(parent: MindmapNode, existingChildCount: number) {
  const horizontalGap = 240;
  const verticalGap = 70;
  return {
    x: parent.position.x + horizontalGap,
    y: parent.position.y + existingChildCount * verticalGap,
  };
}

function commitHistory(nodes: MindmapNode[], edges: MindmapEdge[]) {
  useHistoryStore.getState().commit({ nodes, edges });
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    mindmapId: null,
    title: "Untitled Mindmap",
    nodes: [],
    edges: [],
    selectedNodeId: null,
    editingNodeId: null,
    readOnly: false,
    revision: 0,
    dirty: false,
    saveStatus: "idle",
    lastSyncedUpdatedAt: null,

    loadMindmap: ({ id, title, nodes, edges, updatedAt, readOnly = false }) => {
      useHistoryStore.getState().reset();
      set({
        mindmapId: id,
        title,
        nodes,
        edges,
        selectedNodeId: null,
        editingNodeId: null,
        readOnly,
        revision: 0,
        dirty: false,
        saveStatus: "idle",
        lastSyncedUpdatedAt: updatedAt,
      });
    },

    onNodesChange: (changes) =>
      set((s) => {
        const meaningful = changes.some(
          (c) => c.type === "position" || c.type === "add" || c.type === "remove",
        );
        return {
          nodes: applyNodeChanges(changes, s.nodes),
          dirty: s.dirty || meaningful,
          revision: meaningful ? s.revision + 1 : s.revision,
        };
      }),

    onEdgesChange: (changes) =>
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

    // Called from onNodeDragStart — one history entry per whole drag gesture, not one
    // per position-change event fired while the mouse moves.
    commitBeforeDrag: () => {
      const state = get();
      commitHistory(state.nodes, state.edges);
    },

    selectNode: (id) => set({ selectedNodeId: id }),
    setEditingNode: (id) => {
      if (get().readOnly) return;
      set({ editingNodeId: id });
    },

    setTitle: (title) => {
      if (get().readOnly) return;
      set((s) => ({ title, dirty: true, revision: s.revision + 1 }));
    },

    updateNodeLabel: (id, label) => {
      const state = get();
      if (state.readOnly) return;
      const target = state.nodes.find((n) => n.id === id);
      if (!target || target.data.label === label) return;

      commitHistory(state.nodes, state.edges);
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    updateNodeColor: (id, color) => {
      const state = get();
      if (state.readOnly) return;
      const target = state.nodes.find((n) => n.id === id);
      if (!target || target.data.color === color) return;

      commitHistory(state.nodes, state.edges);
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)),
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    // Not committed to undo history — collapsing/expanding is a view convenience, not
    // a content edit, and undo-ing it when the user expected their last edit to revert
    // would be surprising. Deliberately allowed even when readOnly: a view-only shared
    // visitor can still collapse branches to explore a large mindmap locally — it's
    // harmless since no autosave subscriber exists in that mode to persist it.
    toggleCollapsed: (id) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n,
        ),
        dirty: true,
        revision: s.revision + 1,
      })),

    addChildNode: (parentId) => {
      const state = get();
      if (state.readOnly) return null;
      const parent = state.nodes.find((n) => n.id === parentId);
      if (!parent) return null;

      commitHistory(state.nodes, state.edges);

      const siblingCount = getChildIds(state.edges, parentId).length;
      const id = generateNodeId();
      const newNode: MindmapNode = {
        id,
        type: "mindmapNode",
        position: computeChildPosition(parent, siblingCount),
        data: {
          label: "",
          color: resolveNewNodeColor(state.nodes, state.edges, parentId),
        },
      };
      const newEdge: MindmapEdge = {
        id: generateEdgeId(parentId, id),
        type: "mindmapEdge",
        source: parentId,
        target: id,
      };

      set((s) => ({
        nodes: [...s.nodes, newNode],
        edges: [...s.edges, newEdge],
        selectedNodeId: id,
        editingNodeId: id,
        dirty: true,
        revision: s.revision + 1,
      }));

      return id;
    },

    addSiblingNode: (nodeId) => {
      const parentId = getParentId(get().edges, nodeId);
      if (!parentId) return get().addRootNode();
      return get().addChildNode(parentId);
    },

    addRootNode: () => {
      const state = get();
      if (state.readOnly) return null;

      commitHistory(state.nodes, state.edges);

      // Below-and-left of everything else, so a new primary idea reads as a fresh
      // start rather than overlapping any existing tree's bounding box.
      const minX = state.nodes.length > 0 ? Math.min(...state.nodes.map((n) => n.position.x)) : 0;
      const maxY = state.nodes.length > 0 ? Math.max(...state.nodes.map((n) => n.position.y)) : 0;
      const id = generateNodeId();
      const newNode: MindmapNode = {
        id,
        type: "mindmapNode",
        position: { x: minX, y: maxY + 160 },
        data: { label: "", color: resolveNewRootColor(state.nodes, state.edges) },
      };

      set((s) => ({
        nodes: [...s.nodes, newNode],
        selectedNodeId: id,
        editingNodeId: id,
        dirty: true,
        revision: s.revision + 1,
      }));

      return id;
    },

    deleteNodeAndSubtree: (nodeId) => {
      const state = get();
      if (state.readOnly) return;

      commitHistory(state.nodes, state.edges);

      const idsToRemove = new Set(getSubtreeIds(state.edges, nodeId));
      set((s) => ({
        nodes: s.nodes.filter((n) => !idsToRemove.has(n.id)),
        edges: s.edges.filter((e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)),
        selectedNodeId: s.selectedNodeId && idsToRemove.has(s.selectedNodeId) ? null : s.selectedNodeId,
        editingNodeId: s.editingNodeId && idsToRemove.has(s.editingNodeId) ? null : s.editingNodeId,
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    duplicateSubtree: (nodeId) => {
      const state = get();
      if (state.readOnly) return null;
      const parentId = getParentId(state.edges, nodeId);
      if (!parentId) return null; // duplicating the root as a "sibling" has no parent to attach to

      commitHistory(state.nodes, state.edges);

      const subtreeIds = getSubtreeIds(state.edges, nodeId);
      const idMap = new Map<string, string>(subtreeIds.map((oldId) => [oldId, generateNodeId()]));
      const yOffset = 60;

      const clonedNodes: MindmapNode[] = subtreeIds.map((oldId) => {
        const original = state.nodes.find((n) => n.id === oldId)!;
        return {
          ...original,
          id: idMap.get(oldId)!,
          position: { x: original.position.x, y: original.position.y + yOffset },
          data: { ...original.data },
        };
      });

      const clonedEdges: MindmapEdge[] = state.edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          id: generateEdgeId(idMap.get(e.source)!, idMap.get(e.target)!),
          type: "mindmapEdge",
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

      const rootCloneId = idMap.get(nodeId)!;
      const connectingEdge: MindmapEdge = {
        id: generateEdgeId(parentId, rootCloneId),
        type: "mindmapEdge",
        source: parentId,
        target: rootCloneId,
      };

      set((s) => ({
        nodes: [...s.nodes, ...clonedNodes],
        edges: [...s.edges, ...clonedEdges, connectingEdge],
        selectedNodeId: rootCloneId,
        dirty: true,
        revision: s.revision + 1,
      }));

      return rootCloneId;
    },

    applyLayout: (positions) => {
      const state = get();
      if (state.readOnly) return;
      commitHistory(state.nodes, state.edges);

      set((s) => ({
        nodes: s.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n)),
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    replaceContent: (nodes, edges) => {
      const state = get();
      if (state.readOnly) return;
      commitHistory(state.nodes, state.edges);

      set((s) => ({
        nodes,
        edges,
        selectedNodeId: null,
        editingNodeId: null,
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    applyRemoteContent: (nodes, edges) => {
      const state = get();
      if (state.readOnly) return;

      const stillExists = (id: string | null) => id !== null && nodes.some((n) => n.id === id);
      set((s) => ({
        nodes,
        edges,
        // A remote edit may have deleted whatever this tab had selected/open for
        // editing — drop the reference rather than pointing at a node that's gone.
        selectedNodeId: stillExists(s.selectedNodeId) ? s.selectedNodeId : null,
        editingNodeId: stillExists(s.editingNodeId) ? s.editingNodeId : null,
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    undo: () => {
      const state = get();
      if (state.readOnly) return;
      const restored = useHistoryStore.getState().undo({ nodes: state.nodes, edges: state.edges });
      if (!restored) return;
      set({
        nodes: restored.nodes,
        edges: restored.edges,
        selectedNodeId: null,
        editingNodeId: null,
        dirty: true,
        revision: state.revision + 1,
      });
    },

    redo: () => {
      const state = get();
      if (state.readOnly) return;
      const restored = useHistoryStore.getState().redo({ nodes: state.nodes, edges: state.edges });
      if (!restored) return;
      set({
        nodes: restored.nodes,
        edges: restored.edges,
        selectedNodeId: null,
        editingNodeId: null,
        dirty: true,
        revision: state.revision + 1,
      });
    },

    markSaving: () => set({ saveStatus: "saving" }),

    markSaved: (updatedAt, savedRevision) =>
      set((s) => ({
        saveStatus: "saved",
        lastSyncedUpdatedAt: updatedAt,
        // If new edits landed while the request was in flight, stay dirty so the
        // next debounce/fallback cycle picks them up instead of losing them.
        dirty: s.revision !== savedRevision,
      })),

    markSaveError: () => set({ saveStatus: "error" }),
  })),
);
