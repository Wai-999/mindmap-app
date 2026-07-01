"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RenameMindmapDialog } from "@/components/dashboard/rename-mindmap-dialog";
import { DeleteMindmapDialog } from "@/components/dashboard/delete-mindmap-dialog";
import type { MindmapSummary } from "@/types/mindmap";

interface MindmapCardMenuProps {
  mindmap: MindmapSummary;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MindmapCardMenu({ mindmap, onRename, onDuplicate, onDelete }: MindmapCardMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="size-8 shadow"
            aria-label="Mindmap actions"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate(mindmap.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameMindmapDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentTitle={mindmap.title}
        onSubmit={(title) => onRename(mindmap.id, title)}
      />
      <DeleteMindmapDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={mindmap.title}
        onConfirm={() => onDelete(mindmap.id)}
      />
    </>
  );
}
