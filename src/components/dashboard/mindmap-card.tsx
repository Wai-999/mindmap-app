"use client";

import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { MindmapCardMenu } from "@/components/dashboard/mindmap-card-menu";
import type { MindmapSummary } from "@/types/mindmap";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return rtf.format(-diffDay, "day");
}

interface MindmapCardProps {
  mindmap: MindmapSummary;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MindmapCard({ mindmap, onRename, onDuplicate, onDelete }: MindmapCardProps) {
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
        </div>
      </Link>
      <div className="absolute top-2 right-2">
        <MindmapCardMenu
          mindmap={mindmap}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
