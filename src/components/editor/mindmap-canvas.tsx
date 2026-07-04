"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
} from "@xyflow/react";
import type {
  NodeMouseHandler,
  EdgeMouseHandler,
  Connection,
  IsValidConnection,
  OnConnectEnd,
  OnReconnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/store/editor-store";
import { MindmapNode } from "@/components/editor/nodes/mindmap-node";
import { MindmapEdge } from "@/components/editor/edges/mindmap-edge";
import type { MindmapEdge as MindmapEdgeType } from "@/types/mindmap";
import { getHiddenIds, filterVisible, isHierarchyEdge } from "@/lib/mindmap/tree-utils";
import { getFocusedSubtree } from "@/lib/mindmap/focus";
import { setLastCanvasPoint, clearLastCanvasPoint, setEditClickPoint } from "@/lib/mindmap/canvas-cursor";

const nodeTypes = { mindmapNode: MindmapNode };
const edgeTypes = { mindmapEdge: MindmapEdge };

export function MindmapCanvas() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const focusedNodeId = useEditorStore((s) => s.focusedNodeId);
  const readOnly = useEditorStore((s) => s.readOnly);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const selectNode = useEditorStore((s) => s.selectNode);
  const selectEdge = useEditorStore((s) => s.selectEdge);
  const setEditingNode = useEditorStore((s) => s.setEditingNode);
  const setFocusedNode = useEditorStore((s) => s.setFocusedNode);
  const commitBeforeDrag = useEditorStore((s) => s.commitBeforeDrag);
  const addLinkEdge = useEditorStore((s) => s.addLinkEdge);
  const addLinkedNode = useEditorStore((s) => s.addLinkedNode);
  const addRootNode = useEditorStore((s) => s.addRootNode);
  const reconnectLinkEdge = useEditorStore((s) => s.reconnectLinkEdge);
  const { screenToFlowPosition } = useReactFlow();

  // Track where the cursor is over the canvas (in flow coordinates) so addRootNode
  // can place a new primary idea at that spot. Cleared on unmount — a stale point
  // from a previous mindmap or view must never position a node in this one.
  useEffect(() => clearLastCanvasPoint, []);

  const handlePaneMouseMove = useCallback(
    (event: React.MouseEvent) => {
      setLastCanvasPoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [screenToFlowPosition],
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Double-clicking empty canvas creates a new primary idea right there (the
      // first click of the pair just deselects, same as a single click). detail is
      // the native click count — React Flow has no onPaneDoubleClick prop.
      if (event.detail === 2 && !readOnly) {
        addRootNode(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        return;
      }
      selectNode(null);
      // Tapping empty canvas is also the quickest way out of focus mode — no need to
      // reach for Escape or the banner's own "Exit" button first.
      setFocusedNode(null);
    },
    [readOnly, addRootNode, screenToFlowPosition, selectNode, setFocusedNode],
  );

  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => {
    const hidden = getHiddenIds(nodes, edges);
    const { nodes: vn, edges: ve } = filterVisible(nodes, edges, hidden);
    // Hierarchy edges saved before free-form links existed have no handle id at all
    // (there was only ever one source/one target handle per node back then) — default
    // them to the "right"/"left" handles that now have those explicit ids, so old
    // mindmaps keep rendering exactly where they always did.
    const normalizedEdges = ve.map((e) => {
      if (isHierarchyEdge(e)) {
        return !e.sourceHandle && !e.targetHandle ? { ...e, sourceHandle: "right", targetHandle: "left" } : e;
      }
      // Link edges (not hierarchy) can be reconnected — dragging an end onto a
      // different node — without opening that up for the structural tree edges,
      // which only ever change through the store's own actions. Per-edge
      // `reconnectable` overrides the canvas's global `edgesReconnectable={false}`.
      // "drop" only ever exists as a handle while a connection drag is in progress
      // (mindmap-node.tsx's whole-node drop target) — a handful of mindmaps saved
      // before handleConnect's guard against persisting it still have it stored,
      // which makes React Flow log a "couldn't find handle" warning on every
      // render (harmless for link edges, since floating-edge math below ignores
      // sourceHandle/targetHandle entirely, but still worth clearing on sight).
      return {
        ...e,
        sourceHandle: e.sourceHandle === "drop" ? null : e.sourceHandle,
        targetHandle: e.targetHandle === "drop" ? null : e.targetHandle,
        reconnectable: true,
      };
    });
    return { nodes: vn, edges: normalizedEdges };
  }, [nodes, edges]);

  // Cheap second pass (kept out of the normalization memo above so it doesn't re-run
  // on every selection change): mirror the store's selection onto React Flow's
  // node.selected (so multi-drag moves the whole set together), and apply focus-mode
  // dimming. focusedSet is the isolated node's hierarchy subtree; everything outside
  // it dims and goes non-interactive, edges dim if either end is outside.
  const displayNodes = useMemo(() => {
    const selectedSet = new Set(selectedNodeIds);
    // Full store edges (not the collapse-filtered baseEdges) so the focused subtree is
    // computed against the true hierarchy even when part of it is collapsed. Edges dim
    // themselves (see mindmap-edge.tsx reading the same cached set) — only nodes need
    // their style set here.
    const focusedSet = getFocusedSubtree(edges, focusedNodeId);

    return baseNodes.map((n) => {
      const isSelected = selectedSet.has(n.id);
      const dim = focusedSet ? !focusedSet.has(n.id) : false;
      if (!isSelected && !dim && !n.selected && !n.style?.opacity) return n;
      return {
        ...n,
        selected: isSelected,
        style: dim
          ? { ...n.style, opacity: 0.12, pointerEvents: "none" as const }
          : { ...n.style, opacity: undefined, pointerEvents: undefined },
      };
    });
  }, [baseNodes, edges, selectedNodeIds, focusedNodeId]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      // Deliberately NOT storing connection.sourceHandle/targetHandle: link edges
      // render as floating edges (anchor points derived from node rects, see
      // mindmap-edge.tsx), so stored handles are never used for drawing — and the
      // drop's targetHandle would be "drop", a handle that only exists while a
      // connection drag is in progress; persisting it leaves React Flow unable to
      // re-resolve the edge's anchors on the next node move (stale, frozen path).
      addLinkEdge(connection.source, connection.target);
    },
    [readOnly, addLinkEdge],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => connection.source !== connection.target,
    [],
  );

  // Dragging a connection out and releasing it on empty canvas (not onto another
  // node — that's handleConnect's job) spawns a new idea right where it was dropped,
  // joined to whichever node the drag started from by a link edge — dashed and
  // floating (rotates around either node as they move), matching the free-form
  // connection that created it, rather than silently becoming a fixed-anchor
  // hierarchy edge that only looks right when the new node happens to land to the
  // parent's right. Ties together "connect from anywhere" and "new idea where the
  // cursor is" into the one gesture most mind-mapping tools use to spin off a
  // related-but-independent idea.
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (readOnly || connectionState.isValid || !connectionState.fromNode) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      addLinkedNode(connectionState.fromNode.id, position);
    },
    [readOnly, addLinkedNode, screenToFlowPosition],
  );

  // Grabbing an existing link edge's endpoint and dragging it to a different node —
  // the line pivots around its other, untouched end while this happens. Only ever
  // reaches link edges: reconnectLinkEdge itself refuses hierarchy edges, and the
  // per-edge `reconnectable` flag set below only marks link edges as draggable in
  // the first place.
  const handleReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (readOnly) return;
      reconnectLinkEdge(oldEdge.id, newConnection.source, newConnection.target);
    },
    [readOnly, reconnectLinkEdge],
  );

  // Only link edges are selectable this way — hierarchy edges have no click-driven
  // action at all (they only change via the structural store actions), so clicking
  // one is a no-op rather than clearing whatever else was selected.
  const handleEdgeClick: EdgeMouseHandler<MindmapEdgeType> = useCallback(
    (event, edge) => {
      if (isHierarchyEdge(edge)) return;
      event.stopPropagation();
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (readOnly) return;
      event.stopPropagation();
      // Recorded before the contentEditable even mounts (isEditing flips true a
      // render later) so mindmap-node.tsx can place the caret exactly where this
      // click landed once it does — see canvas-cursor.ts for why this needs to be
      // consumed once rather than just read.
      setEditClickPoint({ x: event.clientX, y: event.clientY });
      setEditingNode(node.id);
    },
    [readOnly, setEditingNode],
  );

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={baseEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDoubleClick={handleNodeDoubleClick}
      onEdgeClick={handleEdgeClick}
      onNodeDragStart={commitBeforeDrag}
      onPaneClick={handlePaneClick}
      onPaneMouseMove={handlePaneMouseMove}
      onConnect={handleConnect}
      onConnectEnd={handleConnectEnd}
      onReconnect={handleReconnect}
      isValidConnection={isValidConnection}
      connectionMode={ConnectionMode.Loose}
      deleteKeyCode={null}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      // React Flow drives selection now (click, Cmd/Ctrl-click to add, Shift-drag for
      // a marquee box) and reports it through onNodesChange's `select` changes, which
      // the store folds into selectedNodeIds. Plain drag still pans (selectionKeyCode
      // gates the marquee), so panning is unaffected.
      elementsSelectable
      selectionKeyCode="Shift"
      multiSelectionKeyCode={["Meta", "Control"]}
      edgesFocusable={false}
      edgesReconnectable={false}
      zoomOnDoubleClick={false}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => (n.data as { color?: string }).color ?? "#94a3b8"}
        className="bg-card!"
      />
    </ReactFlow>
  );
}
