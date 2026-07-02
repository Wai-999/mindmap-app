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
  Connection,
  IsValidConnection,
  OnConnectEnd,
  OnReconnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/store/editor-store";
import { MindmapNode } from "@/components/editor/nodes/mindmap-node";
import { MindmapEdge } from "@/components/editor/edges/mindmap-edge";
import { getHiddenIds, filterVisible, isHierarchyEdge } from "@/lib/mindmap/tree-utils";
import { setLastCanvasPoint, clearLastCanvasPoint } from "@/lib/mindmap/canvas-cursor";

const nodeTypes = { mindmapNode: MindmapNode };
const edgeTypes = { mindmapEdge: MindmapEdge };

export function MindmapCanvas() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const readOnly = useEditorStore((s) => s.readOnly);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setEditingNode = useEditorStore((s) => s.setEditingNode);
  const commitBeforeDrag = useEditorStore((s) => s.commitBeforeDrag);
  const addLinkEdge = useEditorStore((s) => s.addLinkEdge);
  const addChildNode = useEditorStore((s) => s.addChildNode);
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
    },
    [readOnly, addRootNode, screenToFlowPosition, selectNode],
  );

  const { nodes: visibleNodes, edges: visibleEdges } = useMemo(() => {
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
      return { ...e, reconnectable: true };
    });
    return { nodes: vn, edges: normalizedEdges };
  }, [nodes, edges]);

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
  // node — that's handleConnect's job) spawns a new child idea right where it was
  // dropped, connected by a real hierarchy edge to whichever node the drag started
  // from. Ties together "connect from anywhere" and "new idea where the cursor is"
  // into the one gesture most mind-mapping tools use for quickly extending a branch.
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (readOnly || connectionState.isValid || !connectionState.fromNode) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      addChildNode(connectionState.fromNode.id, position);
    },
    [readOnly, addChildNode, screenToFlowPosition],
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

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => selectNode(node.id),
    [selectNode],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (readOnly) return;
      event.stopPropagation();
      setEditingNode(node.id);
    },
    [readOnly, setEditingNode],
  );

  return (
    <ReactFlow
      nodes={visibleNodes}
      edges={visibleEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
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
      elementsSelectable={false}
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
