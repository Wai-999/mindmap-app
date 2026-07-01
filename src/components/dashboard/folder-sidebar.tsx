"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Folder as FolderIcon,
  FolderPlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  PanelLeftClose,
  PanelLeft,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FolderSummary } from "@/types/mindmap";

const COLLAPSED_STORAGE_KEY = "mindmap:folder-sidebar-collapsed";

interface FolderSidebarProps {
  folders: FolderSummary[];
  activeFolderId: string | null;
  onFoldersChange: (folders: FolderSummary[]) => void;
}

export function FolderSidebar({ folders, activeFolderId, onFoldersChange }: FolderSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // Starts expanded on both server and first client render (no localStorage access
  // during render, which would throw during SSR) — the stored preference is applied
  // a moment later via the effect below, same as the app's other client-only prefs.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function navigateToFolder(folderId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (folderId) params.set("folder", folderId);
    else params.delete("folder");
    router.push(`/dashboard?${params.toString()}`);
  }

  async function handleCreate() {
    const name = draftName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { folder } = (await res.json()) as { folder: FolderSummary };
      onFoldersChange([...folders, folder].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      toast.error("Couldn't create the folder.");
    }
    setDraftName("");
    setCreating(false);
  }

  async function handleRename(id: string) {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name) return;

    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      onFoldersChange(folders.map((f) => (f.id === id ? { ...f, name } : f)));
    } else {
      toast.error("Couldn't rename the folder.");
    }
  }

  async function handleDelete(id: string) {
    const previous = folders;
    onFoldersChange(folders.filter((f) => f.id !== id));
    if (activeFolderId === id) navigateToFolder(null);

    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      onFoldersChange(previous);
      toast.error("Couldn't delete the folder.");
    }
  }

  if (collapsed) {
    return (
      <nav className="flex w-12 shrink-0 flex-col items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <PanelLeft className="size-4" />
        </Button>

        <button
          type="button"
          onClick={() => navigateToFolder(null)}
          title="All mindmaps"
          aria-label="All mindmaps"
          className={cn(
            "hover:bg-accent flex size-8 items-center justify-center rounded-md",
            activeFolderId === null && "bg-accent",
          )}
        >
          <LayoutGrid className="size-4" />
        </button>

        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => navigateToFolder(folder.id)}
            title={folder.name}
            aria-label={folder.name}
            className={cn(
              "hover:bg-accent flex size-8 items-center justify-center rounded-md",
              activeFolderId === folder.id && "bg-accent",
            )}
          >
            <FolderIcon className="size-4" />
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            localStorage.setItem(COLLAPSED_STORAGE_KEY, "0");
            setCreating(true);
          }}
          title="New folder"
          aria-label="New folder"
          className="hover:bg-accent text-muted-foreground flex size-8 items-center justify-center rounded-md"
        >
          <FolderPlus className="size-4" />
        </button>
      </nav>
    );
  }

  return (
    <nav className="w-48 shrink-0 space-y-0.5">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => navigateToFolder(null)}
          className={cn(
            "hover:bg-accent flex-1 rounded-md px-2 py-1.5 text-left text-sm",
            activeFolderId === null && "bg-accent font-medium",
          )}
        >
          All mindmaps
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={toggleCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-3.5" />
        </Button>
      </div>

      {folders.map((folder) => (
        <div key={folder.id} className="group flex items-center gap-1">
          {renamingId === folder.id ? (
            <Input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => handleRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="h-7 flex-1 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => navigateToFolder(folder.id)}
              className={cn(
                "hover:bg-accent flex flex-1 items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-left text-sm",
                activeFolderId === folder.id && "bg-accent font-medium",
              )}
            >
              <FolderIcon className="size-3.5 shrink-0" />
              <span className="truncate">{folder.name}</span>
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                aria-label={`${folder.name} actions`}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setRenameDraft(folder.name);
                  setRenamingId(folder.id);
                }}
              >
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(folder.id)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {creating ? (
        <Input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={handleCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setCreating(false);
          }}
          placeholder="Folder name"
          className="h-7 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="hover:bg-accent text-muted-foreground flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm"
        >
          <FolderPlus className="size-3.5" />
          New folder
        </button>
      )}
    </nav>
  );
}
