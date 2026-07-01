"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

import type { MindmapEdge as MindmapEdgeType } from "@/types/mindmap";
import { useEditorStore } from "@/store/editor-store";

export function MindmapEdge({
  id,
  source,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps<MindmapEdgeType>) {
  const color = useEditorStore(
    (s) => s.nodes.find((n) => n.id === source)?.data.color ?? "var(--muted-foreground)",
  );

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return <BaseEdge id={id} path={edgePath} style={{ stroke: color, strokeWidth: 2.5 }} />;
}
