"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Copy, Trash2, FolderInput, Tag, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RenameMindmapDialog } from "@/components/dashboard/rename-mindmap-dialog";
import { DeleteMindmapDialog } from "@/components/dashboard/delete-mindmap-dialog";
import { EditTagsDialog } from "@/components/dashboard/edit-tags-dialog";
import type { MindmapSummary, FolderSummary, TagSummary } from "@/types/mindmap";

interface MindmapCardMenuProps {
  mindmap: MindmapSummary;
  folders: FolderSummary[];
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  onTagsChange: (id: string, tags: TagSummary[]) => void;
}

export function MindmapCardMenu({
  mindmap,
  folders,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  onTagsChange,
}: MindmapCardMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

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
          <DropdownMenuItem onSelect={() => setTagsOpen(true)}>
            <Tag /> Edit tags
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput /> Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => onMove(mindmap.id, null)}>
                {mindmap.folderId === null && <Check className="size-3.5" />}
                Unfiled
              </DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem key={folder.id} onSelect={() => onMove(mindmap.id, folder.id)}>
                  {mindmap.folderId === folder.id && <Check className="size-3.5" />}
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
      <EditTagsDialog
        mindmapId={mindmap.id}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        currentTags={mindmap.tags}
        onSubmit={(tags) => onTagsChange(mindmap.id, tags)}
      />
    </>
  );
}
