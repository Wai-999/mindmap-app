import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange } from "@xyflow/react";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { generateNodeId, generateEdgeId } from "@/lib/mindmap/id";
import { getParentId, getChildIds, getSubtreeIds, isRootNode } from "@/lib/mindmap/tree-utils";
import { NODE_COLORS } from "@/lib/mindmap/defaults";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorState {
  mindmapId: string | null;
  title: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  selectedNodeId: string | null;
  editingNodeId: string | null;

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
  }) => void;

  onNodesChange: (changes: NodeChange<MindmapNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<MindmapEdge>[]) => void;

  selectNode: (id: string | null) => void;
  setEditingNode: (id: string | null) => void;
  setTitle: (title: string) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, color: string) => void;
  toggleCollapsed: (id: string) => void;

  addChildNode: (parentId: string) => string | null;
  addSiblingNode: (nodeId: string) => string | null;
  deleteNodeAndSubtree: (nodeId: string) => void;

  markSaving: () => void;
  markSaved: (updatedAt: string, savedRevision: number) => void;
  markSaveError: () => void;
}

function resolveNewNodeColor(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  parentId: string,
): string {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return NODE_COLORS[0];

  // Children of the root each start a new branch color; deeper descendants inherit
  // their branch's color so a whole subtree reads as one color-coded limb.
  if (isRootNode(edges, parentId)) {
    const siblingCount = getChildIds(edges, parentId).length;
    return NODE_COLORS[siblingCount % NODE_COLORS.length];
  }
  return parent.data.color ?? NODE_COLORS[0];
}

function computeChildPosition(parent: MindmapNode, existingChildCount: number) {
  const horizontalGap = 240;
  const verticalGap = 70;
  return {
    x: parent.position.x + horizontalGap,
    y: parent.position.y + existingChildCount * verticalGap,
  };
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    mindmapId: null,
    title: "Untitled Mindmap",
    nodes: [],
    edges: [],
    selectedNodeId: null,
    editingNodeId: null,
    revision: 0,
    dirty: false,
    saveStatus: "idle",
    lastSyncedUpdatedAt: null,

    loadMindmap: ({ id, title, nodes, edges, updatedAt }) =>
      set({
        mindmapId: id,
        title,
        nodes,
        edges,
        selectedNodeId: null,
        editingNodeId: null,
        revision: 0,
        dirty: false,
        saveStatus: "idle",
        lastSyncedUpdatedAt: updatedAt,
      }),

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

    selectNode: (id) => set({ selectedNodeId: id }),
    setEditingNode: (id) => set({ editingNodeId: id }),

    setTitle: (title) => set((s) => ({ title, dirty: true, revision: s.revision + 1 })),

    updateNodeLabel: (id, label) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
        dirty: true,
        revision: s.revision + 1,
      })),

    updateNodeColor: (id, color) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)),
        dirty: true,
        revision: s.revision + 1,
      })),

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
      const parent = state.nodes.find((n) => n.id === parentId);
      if (!parent) return null;

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
      if (!parentId) return null;
      return get().addChildNode(parentId);
    },

    deleteNodeAndSubtree: (nodeId) => {
      const state = get();
      if (isRootNode(state.edges, nodeId)) return;

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
