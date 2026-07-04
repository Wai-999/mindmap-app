"use client";

import { ALargeSmall, Minus, Plus } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 64;
const STEP = 2;
// Roughly the medium preset's own rendered size — the starting point the first
// +/- tap adjusts from, before any explicit size has been set.
const DEFAULT_FONT_SIZE = 14;

export function NodeTextSizePicker({ nodeId }: { nodeId: string }) {
  const fontSize = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.fontSize);
  const updateNodeFontSize = useEditorStore((s) => s.updateNodeFontSize);

  const current = fontSize ?? DEFAULT_FONT_SIZE;

  function adjust(delta: number) {
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, current + delta));
    updateNodeFontSize(nodeId, next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Text size"
          title="Text size"
        >
          <ALargeSmall className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => adjust(-STEP)}
            disabled={current <= MIN_FONT_SIZE}
            aria-label="Decrease text size"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="text-muted-foreground w-12 text-center text-xs tabular-nums">
            {fontSize != null ? `${fontSize}px` : "Auto"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => adjust(STEP)}
            disabled={current >= MAX_FONT_SIZE}
            aria-label="Increase text size"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {fontSize != null && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-1 w-full text-center text-xs"
            onClick={() => updateNodeFontSize(nodeId, undefined)}
          >
            Reset to auto
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
