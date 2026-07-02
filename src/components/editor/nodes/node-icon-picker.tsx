"use client";

import { Smile, Ban } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

// A curated set covering the common mind-mapping needs (status, priority, categories,
// people, objects) — a full emoji-search picker is a heavier dependency than this
// feature warrants, and a tight grid is faster to scan for the 90% cases.
const EMOJI = [
  "⭐", "🔥", "✅", "❌", "⚠️", "❓", "💡", "📌",
  "🎯", "🚀", "🏁", "⏰", "📅", "🔑", "🔒", "📈",
  "📉", "💰", "❤️", "👍", "👎", "🙂", "😟", "🤔",
  "👤", "👥", "🏢", "🌍", "📝", "📎", "🔗", "🧩",
  "🐞", "🛠️", "📦", "🎨", "🎵", "☕", "🍀", "🎉",
];

export function NodeIconPicker({ nodeId }: { nodeId: string }) {
  const currentIcon = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.icon);
  const updateNodeIcon = useEditorStore((s) => s.updateNodeIcon);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Change icon"
          title="Change icon"
        >
          {currentIcon ? (
            <span className="text-base leading-none" aria-hidden="true">{currentIcon}</span>
          ) : (
            <Smile className="size-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={cn(
                "hover:bg-accent flex size-8 items-center justify-center rounded-md text-lg leading-none",
                currentIcon === emoji && "bg-accent ring-1 ring-foreground",
              )}
              onClick={() => updateNodeIcon(nodeId, emoji)}
              aria-label={`Set icon ${emoji}`}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        {currentIcon && (
          <button
            type="button"
            className="hover:bg-accent text-muted-foreground mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs"
            onClick={() => updateNodeIcon(nodeId, undefined)}
          >
            <Ban className="size-3.5" />
            Remove icon
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
