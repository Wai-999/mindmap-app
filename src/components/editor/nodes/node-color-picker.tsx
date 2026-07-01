"use client";

import { Palette } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NODE_COLORS } from "@/lib/mindmap/defaults";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

export function NodeColorPicker({ nodeId }: { nodeId: string }) {
  const currentColor = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.color);
  const updateNodeColor = useEditorStore((s) => s.updateNodeColor);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Change color"
          title="Change color"
        >
          <Palette className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="flex gap-1.5">
          {NODE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "size-6 rounded-full transition-transform hover:scale-110",
                currentColor === color && "ring-2 ring-foreground ring-offset-2",
              )}
              style={{ backgroundColor: color }}
              onClick={() => updateNodeColor(nodeId, color)}
              aria-label={`Set color ${color}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
