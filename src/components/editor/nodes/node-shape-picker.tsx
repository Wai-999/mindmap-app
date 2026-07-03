"use client";

import { Shapes, Square, RectangleHorizontal, Pill, Diamond, Triangle, Pentagon, ArrowRight } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import type { NodeShape } from "@/types/mindmap";

// lucide-react has no parallelogram icon — a tiny inline SVG matching its own
// stroke conventions (24x24 viewBox, currentColor, 2px stroke) so it sits at home
// next to the real lucide icons in the grid below.
function ParallelogramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 5h14l-4 14H3Z" />
    </svg>
  );
}

// Grid layout (3 columns) rather than the old single row — mirrors Freeform's own
// shape picker as the set has grown past what fits comfortably in one line.
const SHAPES: { value: NodeShape; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: "rounded", label: "Rounded (default)", icon: Square },
  { value: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { value: "pill", label: "Pill", icon: Pill },
  { value: "diamond", label: "Diamond", icon: Diamond },
  { value: "triangle", label: "Triangle", icon: Triangle },
  { value: "pentagon", label: "Pentagon", icon: Pentagon },
  { value: "parallelogram", label: "Parallelogram", icon: ParallelogramIcon },
  { value: "chevron", label: "Arrow", icon: ArrowRight },
];

export function NodeShapePicker({ nodeId }: { nodeId: string }) {
  const currentShape = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.shape ?? "rounded");
  const updateNodeShape = useEditorStore((s) => s.updateNodeShape);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Change shape"
          title="Change shape"
        >
          <Shapes className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="grid grid-cols-4 gap-1">
          {SHAPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={cn(
                "hover:bg-accent flex size-9 items-center justify-center rounded-md",
                currentShape === value && "bg-accent ring-1 ring-foreground",
              )}
              onClick={() => updateNodeShape(nodeId, value === "rounded" ? undefined : value)}
              aria-label={label}
              title={label}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
