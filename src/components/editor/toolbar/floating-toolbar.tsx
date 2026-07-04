"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Plus, GitBranch, Trash2, Undo2, Redo2, Focus } from "lucide-react";

import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
import { deleteNodeWithUndo } from "@/lib/mindmap/delete-with-undo";
import { NodeColorPicker } from "@/components/editor/nodes/node-color-picker";
import { NodeShapePicker } from "@/components/editor/nodes/node-shape-picker";
import { NodeSizePicker } from "@/components/editor/nodes/node-size-picker";
import { NodeIconPicker } from "@/components/editor/nodes/node-icon-picker";
import { InsertMenu } from "@/components/editor/toolbar/insert-menu";
import { LayoutMenu } from "@/components/editor/toolbar/layout-menu";
import { ExportMenu } from "@/components/editor/export/export-menu";
import { ImportDialog } from "@/components/editor/export/import-dialog";
import { KeyboardShortcutsDialog } from "@/components/editor/toolbar/keyboard-shortcuts-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingToolbarProps {
  endpoint: string;
}

export function FloatingToolbar({ endpoint }: FloatingToolbarProps) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectionCount = useEditorStore((s) => s.selectedNodeIds.length);
  const addChildNode = useEditorStore((s) => s.addChildNode);
  const addSiblingNode = useEditorStore((s) => s.addSiblingNode);
  const setFocusedNode = useEditorStore((s) => s.setFocusedNode);
  const deleteSelectedNodes = useEditorStore((s) => s.deleteSelectedNodes);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  if (readOnly) return null;

  const multi = selectionCount > 1;

  function handleBulkDelete() {
    deleteSelectedNodes();
    toast(`${selectionCount} ideas deleted`, {
      action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
    });
  }

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
      <ExportMenu endpoint={endpoint} />
      <ImportDialog />
      <KeyboardShortcutsDialog />

      <Divider />

      <InsertMenu endpoint={endpoint} />

      {multi && selectedNodeId && (
        <>
          <Divider />
          <span className="text-muted-foreground px-2 text-xs font-medium whitespace-nowrap">
            {selectionCount} selected
          </span>
          <NodeColorPicker nodeId={selectedNodeId} bulk />
          <ToolbarButton label="Delete selected" onClick={handleBulkDelete} destructive>
            <Trash2 className="size-4" />
          </ToolbarButton>
        </>
      )}

      {!multi && selectedNodeId && (
        <>
          <Divider />
          <ToolbarButton label="Add child" onClick={() => addChildNode(selectedNodeId)}>
            <Plus className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Add sibling" onClick={() => addSiblingNode(selectedNodeId)}>
            <GitBranch className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Focus on branch" onClick={() => setFocusedNode(selectedNodeId)}>
            <Focus className="size-4" />
          </ToolbarButton>
          <NodeColorPicker nodeId={selectedNodeId} />
          <NodeIconPicker nodeId={selectedNodeId} />
          <NodeShapePicker nodeId={selectedNodeId} />
          <NodeSizePicker nodeId={selectedNodeId} />
          <Divider />
          <ToolbarButton
            label="Delete"
            onClick={() => deleteNodeWithUndo(selectedNodeId)}
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
