import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeChange, EdgeChange } from "@xyflow/react";

import type { MindmapNode, MindmapEdge, MindmapNodeData } from "@/types/mindmap";
import { generateNodeId, generateEdgeId } from "@/lib/mindmap/id";
import { getParentId, getChildIds, getSubtreeIds, isHierarchyEdge } from "@/lib/mindmap/tree-utils";
import { resolveNewNodeColor, resolveNewRootColor } from "@/lib/mindmap/color";
import { getLastCanvasPoint } from "@/lib/mindmap/canvas-cursor";
import { useHistoryStore } from "@/store/history-store";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorState {
  mindmapId: string | null;
  title: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  // Which node's inspector panel (note/task/attachments) is open, if any — a view
  // toggle like editingNodeId, not content, so it's not part of undo/dirty tracking.
  inspectorNodeId: string | null;
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
  setInspectorNode: (id: string | null) => void;
  setTitle: (title: string) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, color: string) => void;
  updateNodeNote: (id: string, note: string) => void;
  updateNodeTask: (id: string, task: MindmapNodeData["task"]) => void;
  toggleCollapsed: (id: string) => void;

  // `at` overrides the usual computed offset-from-parent position — used when a
  // child is spawned by dragging a connection out to empty canvas, so it lands where
  // the user dropped it rather than in the fixed grid spot.
  addChildNode: (parentId: string, at?: { x: number; y: number }) => string | null;
  addSiblingNode: (nodeId: string) => string | null;
  // A new independent primary idea — no parent edge. Also the fallback target when
  // addSiblingNode is called on a root (a root's "sibling" is a new root).
  // `at` is a flow-coordinate point to center the new idea on (e.g. a double-clicked
  // pane position); when omitted, falls back to the cursor's last tracked canvas
  // position, and only then to a computed spot below the existing content.
  addRootNode: (at?: { x: number; y: number }) => string | null;
  // A free-form relationship line between any two nodes (including across separate
  // primary ideas), drawn by dragging between handles — distinct from a hierarchy edge
  // and ignored by layout/export/subtree-delete. Returns the new edge's id, or null if
  // rejected (self-loop, missing node, duplicate pair, or readOnly).
  addLinkEdge: (source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null) => string | null;
  removeLinkEdge: (edgeId: string) => void;
  // Re-targets an existing link edge's endpoints (dragging one end to a different
  // node) — never applies to hierarchy edges, which only change via the structural
  // actions above.
  reconnectLinkEdge: (edgeId: string, newSource: string, newTarget: string) => void;
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

// Roughly half a default node's rendered size (min-width 120px, ~42px tall), so a
// node created "at" a point appears centered on it, not hanging off to the lower-right.
// Exported for the unit tests that assert cursor-relative placement.
export const ROOT_AT_CURSOR_OFFSET = { x: 60, y: 21 };

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
    inspectorNodeId: null,
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
        inspectorNodeId: null,
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
    // Not readOnly-guarded — a VIEW-only visitor can still open a node's inspector to
    // read its note/attachments, the same way toggleCollapsed is allowed for them too.
    setInspectorNode: (id) => set({ inspectorNodeId: id }),

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

    updateNodeNote: (id, note) => {
      const state = get();
      if (state.readOnly) return;
      const target = state.nodes.find((n) => n.id === id);
      if (!target || target.data.note === note) return;

      commitHistory(state.nodes, state.edges);
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, note } } : n)),
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    updateNodeTask: (id, task) => {
      const state = get();
      if (state.readOnly) return;
      const target = state.nodes.find((n) => n.id === id);
      if (!target) return;

      commitHistory(state.nodes, state.edges);
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, task } } : n)),
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

    addChildNode: (parentId, at) => {
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
        position: at ?? computeChildPosition(parent, siblingCount),
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

    addRootNode: (at) => {
      const state = get();
      if (state.readOnly) return null;

      commitHistory(state.nodes, state.edges);

      // Preferred: center the new idea on where the user is pointing (an explicit
      // point from a pane double-click, else the cursor's last tracked canvas
      // position). Fallback: below-and-left of everything else, so it still reads as
      // a fresh start rather than overlapping any existing tree's bounding box.
      const cursor = at ?? getLastCanvasPoint();
      const minX = state.nodes.length > 0 ? Math.min(...state.nodes.map((n) => n.position.x)) : 0;
      const maxY = state.nodes.length > 0 ? Math.max(...state.nodes.map((n) => n.position.y)) : 0;
      const position = cursor
        ? { x: cursor.x - ROOT_AT_CURSOR_OFFSET.x, y: cursor.y - ROOT_AT_CURSOR_OFFSET.y }
        : { x: minX, y: maxY + 160 };

      const id = generateNodeId();
      const newNode: MindmapNode = {
        id,
        type: "mindmapNode",
        position,
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

    addLinkEdge: (source, target, sourceHandle, targetHandle) => {
      const state = get();
      if (state.readOnly) return null;
      if (source === target) return null;
      if (!state.nodes.some((n) => n.id === source) || !state.nodes.some((n) => n.id === target)) {
        return null;
      }
      // One connection per unordered pair, regardless of kind — a second link between
      // nodes already connected (by hierarchy or an earlier link) would just overlap
      // the existing line with nothing new to show.
      const alreadyConnected = state.edges.some(
        (e) =>
          (e.source === source && e.target === target) ||
          (e.source === target && e.target === source),
      );
      if (alreadyConnected) return null;

      commitHistory(state.nodes, state.edges);

      const id = generateEdgeId(source, target);
      const newEdge: MindmapEdge = {
        id,
        type: "mindmapEdge",
        source,
        target,
        sourceHandle,
        targetHandle,
        data: { kind: "link" },
      };

      set((s) => ({
        edges: [...s.edges, newEdge],
        dirty: true,
        revision: s.revision + 1,
      }));

      return id;
    },

    removeLinkEdge: (edgeId) => {
      const state = get();
      if (state.readOnly) return;
      // Guard against ever deleting a hierarchy edge through this path — it only ever
      // gets called from the link edge's own delete button, but stays defensive.
      const target = state.edges.find((e) => e.id === edgeId);
      if (!target || isHierarchyEdge(target)) return;

      commitHistory(state.nodes, state.edges);
      set((s) => ({
        edges: s.edges.filter((e) => e.id !== edgeId),
        dirty: true,
        revision: s.revision + 1,
      }));
    },

    reconnectLinkEdge: (edgeId, newSource, newTarget) => {
      const state = get();
      if (state.readOnly) return;
      if (newSource === newTarget) return;

      const target = state.edges.find((e) => e.id === edgeId);
      // Same defensive guard as removeLinkEdge — reconnecting is only ever wired up
      // for link edges; hierarchy shape only ever changes through the structural
      // actions (addChildNode, deleteNodeAndSubtree, etc).
      if (!target || isHierarchyEdge(target)) return;
      if (!state.nodes.some((n) => n.id === newSource) || !state.nodes.some((n) => n.id === newTarget)) {
        return;
      }

      // Dragging this edge's end onto a pair that's already connected some other way
      // would just overlap an existing line — reject rather than create a duplicate.
      const wouldDuplicate = state.edges.some(
        (e) =>
          e.id !== edgeId &&
          ((e.source === newSource && e.target === newTarget) ||
            (e.source === newTarget && e.target === newSource)),
      );
      if (wouldDuplicate) return;

      commitHistory(state.nodes, state.edges);
      set((s) => ({
        edges: s.edges.map((e) => (e.id === edgeId ? { ...e, source: newSource, target: newTarget } : e)),
        dirty: true,
        revision: s.revision + 1,
      }));
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
        inspectorNodeId:
          s.inspectorNodeId && idsToRemove.has(s.inspectorNodeId) ? null : s.inspectorNodeId,
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

      // Only hierarchy edges are cloned — a link edge fully inside the copied subtree
      // would otherwise be created with no `data.kind` (defaulting to hierarchy),
      // handing some cloned node a second incoming hierarchy edge and breaking the
      // forest invariant that d3-hierarchy's stratify() (used by both layouts) relies on.
      const clonedEdges: MindmapEdge[] = state.edges
        .filter((e) => isHierarchyEdge(e) && idMap.has(e.source) && idMap.has(e.target))
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
        inspectorNodeId: null,
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
        inspectorNodeId: stillExists(s.inspectorNodeId) ? s.inspectorNodeId : null,
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
        inspectorNodeId: null,
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
        inspectorNodeId: null,
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
