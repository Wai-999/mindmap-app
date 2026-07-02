"use client";

import { Focus, X } from "lucide-react";

import { useEditorStore } from "@/store/editor-store";

// A persistent, always-reachable way out of focus mode (the toolbar's node section
// disappears once you deselect, so it can't be the only exit). Shown centered at the
// top whenever a node is focused; Escape also exits (see use-keyboard-shortcuts).
export function FocusModeBanner() {
  const focusedNodeId = useEditorStore((s) => s.focusedNodeId);
  const label = useEditorStore((s) => s.nodes.find((n) => n.id === s.focusedNodeId)?.data.label);
  const setFocusedNode = useEditorStore((s) => s.setFocusedNode);

  if (!focusedNodeId) return null;

  return (
    <div className="bg-card absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border py-1.5 pr-1.5 pl-3 shadow-lg">
      <Focus className="text-primary size-3.5 shrink-0" />
      <span className="max-w-[240px] truncate text-sm">
        Focusing{label ? `: ${label}` : ""}
      </span>
      <button
        type="button"
        onClick={() => setFocusedNode(null)}
        className="hover:bg-accent flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        aria-label="Exit focus mode"
      >
        <X className="size-3" />
        Exit
      </button>
    </div>
  );
}
