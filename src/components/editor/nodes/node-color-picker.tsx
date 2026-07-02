"use client";

import { Palette } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NODE_COLORS } from "@/lib/mindmap/defaults";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

// `bulk` recolors the entire current selection in one step (updateSelectedNodesColor)
// instead of a single node — used by the toolbar's multi-select section. In bulk mode
// there's no single "current color" to highlight, so the swatch ring is suppressed.
export function NodeColorPicker({ nodeId, bulk = false }: { nodeId: string; bulk?: boolean }) {
  const currentColor = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.color);
  const updateNodeColor = useEditorStore((s) => s.updateNodeColor);
  const updateSelectedNodesColor = useEditorStore((s) => s.updateSelectedNodesColor);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label={bulk ? "Change color of selected" : "Change color"}
          title={bulk ? "Change color of selected" : "Change color"}
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
                !bulk && currentColor === color && "ring-2 ring-foreground ring-offset-2",
              )}
              style={{ backgroundColor: color }}
              onClick={() => (bulk ? updateSelectedNodesColor(color) : updateNodeColor(nodeId, color))}
              aria-label={`Set color ${color}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
