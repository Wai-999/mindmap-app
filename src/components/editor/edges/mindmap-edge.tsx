"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";

import type { MindmapEdge as MindmapEdgeType } from "@/types/mindmap";
import { useEditorStore } from "@/store/editor-store";
import { getFloatingEdgeParams, type Rect } from "@/lib/mindmap/floating-edge";
import { removeLinkEdgeWithUndo } from "@/lib/mindmap/delete-with-undo";

export function MindmapEdge({
  id,
  source,
  target,
  data,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps<MindmapEdgeType>) {
  const isLink = data?.kind === "link";
  const readOnly = useEditorStore((s) => s.readOnly);
  const color = useEditorStore(
    (s) => s.nodes.find((n) => n.id === source)?.data.color ?? "var(--muted-foreground)",
  );

  // Link edges float: each end sits on its node's border at the point facing the
  // other node, so the connection rotates around the node as either end moves —
  // instead of staying pinned to whichever side handle the drag happened to touch.
  // Hierarchy edges keep their fixed left/right anchoring (the tree layout depends on
  // that shape), so these hooks only feed the link branch below.
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  let pathParams = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  if (isLink && sourceNode && targetNode) {
    const sourceRect: Rect = {
      x: sourceNode.internals.positionAbsolute.x,
      y: sourceNode.internals.positionAbsolute.y,
      width: sourceNode.measured.width ?? 0,
      height: sourceNode.measured.height ?? 0,
    };
    const targetRect: Rect = {
      x: targetNode.internals.positionAbsolute.x,
      y: targetNode.internals.positionAbsolute.y,
      width: targetNode.measured.width ?? 0,
      height: targetNode.measured.height ?? 0,
    };
    const params = getFloatingEdgeParams(sourceRect, targetRect);
    pathParams = {
      sourceX: params.sx,
      sourceY: params.sy,
      sourcePosition: params.sourcePosition,
      targetX: params.tx,
      targetY: params.ty,
      targetPosition: params.targetPosition,
    };
  }

  const [edgePath, labelX, labelY] = getBezierPath(pathParams);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={
          isLink
            ? { stroke: "var(--muted-foreground)", strokeWidth: 2, strokeDasharray: "6 4" }
            : { stroke: color, strokeWidth: 2.5 }
        }
      />
      {isLink && !readOnly && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="nodrag nopan absolute flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            onClick={() => removeLinkEdgeWithUndo(id)}
            aria-label="Remove connection"
          >
            <X className="size-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
