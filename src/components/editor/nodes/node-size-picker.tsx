"use client";

import { Scaling } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import type { NodeSize } from "@/types/mindmap";

// A single "A" glyph per size gives an at-a-glance sense of the scale each applies.
const SIZES: { value: NodeSize; label: string; glyph: string }[] = [
  { value: "small", label: "Small", glyph: "text-xs" },
  { value: "medium", label: "Medium (default)", glyph: "text-base" },
  { value: "large", label: "Large", glyph: "text-2xl" },
];

export function NodeSizePicker({ nodeId }: { nodeId: string }) {
  const currentSize = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.size ?? "medium");
  const updateNodeSize = useEditorStore((s) => s.updateNodeSize);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Change size"
          title="Change size"
        >
          <Scaling className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="flex items-end gap-1">
          {SIZES.map(({ value, label, glyph }) => (
            <button
              key={value}
              type="button"
              className={cn(
                "hover:bg-accent flex size-9 items-center justify-center rounded-md leading-none font-semibold",
                glyph,
                currentSize === value && "bg-accent ring-1 ring-foreground",
              )}
              // "medium" is the default, so store it as undefined to keep saved
              // content clean (mirrors how the shape picker omits "rounded").
              onClick={() => updateNodeSize(nodeId, value === "medium" ? undefined : value)}
              aria-label={label}
              title={label}
            >
              A
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
