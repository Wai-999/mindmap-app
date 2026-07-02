"use client";

import { Shapes, Square, RectangleHorizontal, Pill, Diamond } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import type { NodeShape } from "@/types/mindmap";

const SHAPES: { value: NodeShape; label: string; icon: typeof Square }[] = [
  { value: "rounded", label: "Rounded (default)", icon: Square },
  { value: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { value: "pill", label: "Pill", icon: Pill },
  { value: "diamond", label: "Diamond", icon: Diamond },
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
        <div className="flex gap-1">
          {SHAPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={cn(
                "hover:bg-accent flex size-8 items-center justify-center rounded-md",
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
