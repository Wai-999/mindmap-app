"use client";

import { useCallback, useMemo } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap } from "@xyflow/react";
import type { NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/store/editor-store";
import { MindmapNode } from "@/components/editor/nodes/mindmap-node";
import { MindmapEdge } from "@/components/editor/edges/mindmap-edge";
import { getHiddenIds, filterVisible } from "@/lib/mindmap/tree-utils";

const nodeTypes = { mindmapNode: MindmapNode };
const edgeTypes = { mindmapEdge: MindmapEdge };

export function MindmapCanvas() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setEditingNode = useEditorStore((s) => s.setEditingNode);

  const { nodes: visibleNodes, edges: visibleEdges } = useMemo(() => {
    const hidden = getHiddenIds(nodes, edges);
    return filterVisible(nodes, edges, hidden);
  }, [nodes, edges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => selectNode(node.id),
    [selectNode],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      setEditingNode(node.id);
    },
    [setEditingNode],
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
      onPaneClick={() => selectNode(null)}
      deleteKeyCode={null}
      nodesConnectable={false}
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
