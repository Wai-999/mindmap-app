"use client";

import type { ReactNode } from "react";
import { Plus, GitBranch, Trash2 } from "lucide-react";

import { useEditorStore } from "@/store/editor-store";
import { isRootNode } from "@/lib/mindmap/tree-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Minimal version for Phase 2 verification — gains color picker, undo/redo, layout,
// and export actions (plus keyboard-shortcut hints) in Phase 3.
export function FloatingToolbar() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const isRoot = useEditorStore((s) =>
    selectedNodeId ? isRootNode(s.edges, selectedNodeId) : false,
  );
  const addChildNode = useEditorStore((s) => s.addChildNode);
  const addSiblingNode = useEditorStore((s) => s.addSiblingNode);
  const deleteNodeAndSubtree = useEditorStore((s) => s.deleteNodeAndSubtree);

  if (!selectedNodeId) return null;

  return (
    <div className="bg-card absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1.5 shadow-lg">
      <ToolbarButton label="Add child" onClick={() => addChildNode(selectedNodeId)}>
        <Plus className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Add sibling"
        onClick={() => addSiblingNode(selectedNodeId)}
        disabled={isRoot}
      >
        <GitBranch className="size-4" />
      </ToolbarButton>
      <div className="bg-border mx-1 h-5 w-px" />
      <ToolbarButton
        label="Delete"
        onClick={() => deleteNodeAndSubtree(selectedNodeId)}
        disabled={isRoot}
        destructive
      >
        <Trash2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  disabled,
  destructive,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 rounded-full", destructive && "hover:text-destructive")}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}
