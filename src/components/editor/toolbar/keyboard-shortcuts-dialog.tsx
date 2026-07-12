"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface Shortcut {
  keys: string[];
  description: string;
}

// Reflects exactly what use-keyboard-shortcuts.ts implements — keep these two
// files in sync when either changes, this list isn't generated from the other.
const SHORTCUTS: Shortcut[] = [
  { keys: ["↑", "↓", "←", "→"], description: "Move selection to the nearest idea in that direction" },
  { keys: ["Tab"], description: "Add a child idea" },
  { keys: ["Enter"], description: "Add a sibling idea" },
  { keys: ["⇧", "Enter"], description: "New line while editing an idea's text" },
  { keys: ["F2"], description: "Rename the selected idea" },
  { keys: ["Delete"], description: "Delete the selected idea, link, or selection" },
  { keys: ["Esc"], description: "Deselect, or step out of focus mode" },
  { keys: ["⌘", "Z"], description: "Undo" },
  { keys: ["⌘", "⇧", "Z"], description: "Redo" },
  { keys: ["⌘", "D"], description: "Duplicate the selected branch" },
  { keys: ["⌘", "S"], description: "Save now" },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="bg-muted text-muted-foreground inline-flex min-w-[1.5em] items-center justify-center rounded border px-1.5 py-0.5 text-xs font-medium">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Select an idea first (click it, or use the arrow keys), then:</DialogDescription>
        </DialogHeader>
        <ul className="divide-border -my-1 divide-y">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-muted-foreground">{s.description}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((key, i) => (
                  <KeyCap key={i}>{key}</KeyCap>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
