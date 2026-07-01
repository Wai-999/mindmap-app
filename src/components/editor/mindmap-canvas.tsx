"use client";

import { useCallback, useMemo } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, ConnectionMode } from "@xyflow/react";
import type { NodeMouseHandler, Connection, IsValidConnection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/store/editor-store";
import { MindmapNode } from "@/components/editor/nodes/mindmap-node";
import { MindmapEdge } from "@/components/editor/edges/mindmap-edge";
import { getHiddenIds, filterVisible, isHierarchyEdge } from "@/lib/mindmap/tree-utils";

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

  const { nodes: visibleNodes, edges: visibleEdges } = useMemo(() => {
    const hidden = getHiddenIds(nodes, edges);
    const { nodes: vn, edges: ve } = filterVisible(nodes, edges, hidden);
    // Hierarchy edges saved before free-form links existed have no handle id at all
    // (there was only ever one source/one target handle per node back then) — default
    // them to the "right"/"left" handles that now have those explicit ids, so old
    // mindmaps keep rendering exactly where they always did.
    const normalizedEdges = ve.map((e) =>
      isHierarchyEdge(e) && !e.sourceHandle && !e.targetHandle
        ? { ...e, sourceHandle: "right", targetHandle: "left" }
        : e,
    );
    return { nodes: vn, edges: normalizedEdges };
  }, [nodes, edges]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      addLinkEdge(connection.source, connection.target, connection.sourceHandle, connection.targetHandle);
    },
    [readOnly, addLinkEdge],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => connection.source !== connection.target,
    [],
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
      onPaneClick={() => selectNode(null)}
      onConnect={handleConnect}
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
