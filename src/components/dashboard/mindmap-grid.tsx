"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MindmapCard } from "@/components/dashboard/mindmap-card";
import { CreateMindmapButton } from "@/components/dashboard/create-mindmap-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FolderSidebar } from "@/components/dashboard/folder-sidebar";
import { SearchInput } from "@/components/dashboard/search-input";
import { TagFilter } from "@/components/dashboard/tag-filter";
import type { MindmapSummary, FolderSummary, TagSummary } from "@/types/mindmap";

interface MindmapGridProps {
  initialMindmaps: MindmapSummary[];
  folders: FolderSummary[];
  tags: TagSummary[];
  activeFolderId: string | null;
  activeTagId: string | null;
  searchQuery: string;
}

export function MindmapGrid({
  initialMindmaps,
  folders: initialFolders,
  tags,
  activeFolderId,
  activeTagId,
  searchQuery,
}: MindmapGridProps) {
  const router = useRouter();
  const [mindmaps, setMindmaps] = useState(initialMindmaps);
  const [folders, setFolders] = useState(initialFolders);

  // Resync when the server component re-fetches (router.refresh()/navigation) —
  // useState's initializer only runs once, so without this the grid would never pick
  // up server-side changes (a new duplicate, a folder/tag filter navigation, etc.).
  useEffect(() => setMindmaps(initialMindmaps), [initialMindmaps]);
  useEffect(() => setFolders(initialFolders), [initialFolders]);

  async function handleRename(id: string, title: string) {
    const previous = mindmaps;
    setMindmaps((prev) => prev.map((m) => (m.id === id ? { ...m, title } : m)));

    const res = await fetch(`/api/mindmaps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      setMindmaps(previous);
      toast.error("Couldn't rename the mindmap.");
    }
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/mindmaps/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Couldn't duplicate the mindmap.");
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    const previous = mindmaps;
    setMindmaps((prev) => prev.filter((m) => m.id !== id));

    const res = await fetch(`/api/mindmaps/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMindmaps(previous);
      toast.error("Couldn't delete the mindmap.");
    }
  }

  async function handleMove(id: string, folderId: string | null) {
    const previous = mindmaps;
    // Optimistically drop it from the current filtered view if it no longer belongs
    // (moved out of the folder being viewed), otherwise just update its folderId.
    setMindmaps((prev) =>
      activeFolderId && activeFolderId !== folderId
        ? prev.filter((m) => m.id !== id)
        : prev.map((m) => (m.id === id ? { ...m, folderId } : m)),
    );

    const res = await fetch(`/api/mindmaps/${id}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) {
      setMindmaps(previous);
      toast.error("Couldn't move the mindmap.");
    }
  }

  function handleTagsChange(id: string, newTags: TagSummary[]) {
    setMindmaps((prev) => prev.map((m) => (m.id === id ? { ...m, tags: newTags } : m)));
    // A newly-created tag (typed in the dialog) won't be in the sidebar's tag filter
    // list yet — refresh so it shows up there too, without losing the optimistic
    // update above in the meantime.
    router.refresh();
  }

  return (
    <div className="flex gap-8">
      <FolderSidebar
        folders={folders}
        activeFolderId={activeFolderId}
        onFoldersChange={setFolders}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SearchInput initialQuery={searchQuery} />
            <TagFilter tags={tags} activeTagId={activeTagId} />
          </div>
          <CreateMindmapButton />
        </div>

        {mindmaps.length === 0 ? (
          <div className="mt-4">
            <EmptyState />
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mindmaps.map((mindmap) => (
              <li key={mindmap.id}>
                <MindmapCard
                  mindmap={mindmap}
                  folders={folders}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onMove={handleMove}
                  onTagsChange={handleTagsChange}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
