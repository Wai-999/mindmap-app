"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";

import type { MindmapEdge as MindmapEdgeType } from "@/types/mindmap";
import { useEditorStore } from "@/store/editor-store";
import { removeLinkEdgeWithUndo } from "@/lib/mindmap/delete-with-undo";

export function MindmapEdge({
  id,
  source,
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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

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
