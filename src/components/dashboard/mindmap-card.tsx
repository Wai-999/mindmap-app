"use client";

import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { MindmapCardMenu } from "@/components/dashboard/mindmap-card-menu";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import type { MindmapSummary, FolderSummary, TagSummary } from "@/types/mindmap";

interface MindmapCardProps {
  mindmap: MindmapSummary;
  folders: FolderSummary[];
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  onTagsChange: (id: string, tags: TagSummary[]) => void;
}

export function MindmapCard({
  mindmap,
  folders,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  onTagsChange,
}: MindmapCardProps) {
  return (
    <div className="group bg-card relative overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link href={`/mindmap/${mindmap.id}`} className="block">
        <div className="bg-muted flex aspect-4/3 items-center justify-center overflow-hidden">
          {mindmap.thumbnail ? (
            // Base64 data URL — next/image is for optimizing remote/static image
            // URLs, not embedded data, so a plain <img> is the correct tool here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mindmap.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <FileQuestion className="text-muted-foreground/40 size-10" />
          )}
        </div>
        <div className="p-3 pr-10">
          <p className="truncate text-sm font-medium">{mindmap.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Edited {relativeTime(mindmap.updatedAt)}
          </p>
          {mindmap.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {mindmap.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px]">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>
      <div className="absolute top-2 right-2">
        <MindmapCardMenu
          mindmap={mindmap}
          folders={folders}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onMove={onMove}
          onTagsChange={onTagsChange}
        />
      </div>
    </div>
  );
}
