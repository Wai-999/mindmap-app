"use client";

import type { ReactNode } from "react";
import { Plus, GitBranch, Trash2, Undo2, Redo2 } from "lucide-react";

import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
import { isRootNode } from "@/lib/mindmap/tree-utils";
import { deleteNodeWithUndo } from "@/lib/mindmap/delete-with-undo";
import { NodeColorPicker } from "@/components/editor/nodes/node-color-picker";
import { LayoutMenu } from "@/components/editor/toolbar/layout-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingToolbar() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const isRoot = useEditorStore((s) =>
    selectedNodeId ? isRootNode(s.edges, selectedNodeId) : false,
  );
  const addChildNode = useEditorStore((s) => s.addChildNode);
  const addSiblingNode = useEditorStore((s) => s.addSiblingNode);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  return (
    <div className="bg-card absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1.5 shadow-lg">
      <ToolbarButton label="Undo" onClick={undo} disabled={!canUndo}>
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={redo} disabled={!canRedo}>
        <Redo2 className="size-4" />
      </ToolbarButton>

      <Divider />

      <LayoutMenu />

      {selectedNodeId && (
        <>
          <Divider />
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
          <NodeColorPicker nodeId={selectedNodeId} />
          <Divider />
          <ToolbarButton
            label="Delete"
            onClick={() => deleteNodeWithUndo(selectedNodeId)}
            disabled={isRoot}
            destructive
          >
            <Trash2 className="size-4" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

function Divider() {
  return <div className="bg-border mx-1 h-5 w-px" />;
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
