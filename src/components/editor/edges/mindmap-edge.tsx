"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";

import type { MindmapEdge as MindmapEdgeType } from "@/types/mindmap";
import { useEditorStore } from "@/store/editor-store";
import { getFloatingEdgeParams, type Rect } from "@/lib/mindmap/floating-edge";
import { getFocusedSubtree } from "@/lib/mindmap/focus";
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
  const isSelected = useEditorStore((s) => s.selectedEdgeId === id);
  const color = useEditorStore(
    (s) => s.nodes.find((n) => n.id === source)?.data.color ?? "var(--muted-foreground)",
  );
  // Dims in focus mode when either endpoint is outside the focused subtree. The
  // selector returns a plain boolean, so this edge only re-renders when its dim state
  // actually flips (getFocusedSubtree is cached per edges-array, so it's cheap).
  const dimmed = useEditorStore((s) => {
    const set = getFocusedSubtree(s.edges, s.focusedNodeId);
    return set ? !(set.has(source) && set.has(target)) : false;
  });

  // Every edge floats: each end sits on its node's border at the point facing the
  // other node, so the connection rotates around the node as either end moves —
  // instead of staying pinned to whichever side handle the drag happened to touch (or,
  // for a hierarchy edge, to a fixed right/left pair that only looks right when the
  // child happens to sit to the parent's right). Tree/radial layout only ever
  // computes node *positions*, never anchor sides, so applying this to hierarchy
  // edges too doesn't affect layout — only how the line reaches wherever the node
  // actually ended up, including after being dragged anywhere by hand.
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  let pathParams = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  if (sourceNode && targetNode) {
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
        style={{
          opacity: dimmed ? 0.12 : undefined,
          ...(isLink
            ? {
                stroke: isSelected ? "var(--primary)" : "var(--muted-foreground)",
                strokeWidth: isSelected ? 2.5 : 2,
                strokeDasharray: "6 4",
                cursor: "pointer",
              }
            : { stroke: color, strokeWidth: 2.5 }),
        }}
      />
      {/* Delete only surfaces once a link is clicked, instead of every link
          permanently showing its own × — several crossing or nearby connections
          used to stack their buttons on top of each other; only one edge can ever
          be selected at a time, so this can't happen anymore. Hidden while dimmed in
          focus mode. */}
      {isLink && isSelected && !readOnly && !dimmed && (
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
