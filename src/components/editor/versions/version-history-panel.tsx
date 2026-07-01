"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { relativeTime } from "@/lib/utils";
import type { MindmapContent } from "@/types/mindmap";

interface VersionSummary {
  id: string;
  title: string;
  createdAt: string;
}

// Owner-only — versions are snapshotted on every content save (see
// lib/mindmap/versions.ts), not something a share-link visitor's canvas exposes.
export function VersionHistoryPanel({ mindmapId }: { mindmapId: string }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const replaceContent = useEditorStore((s) => s.replaceContent);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/mindmaps/${mindmapId}/versions`)
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data: { versions?: VersionSummary[] }) => setVersions(data.versions ?? []))
      .finally(() => setLoading(false));
  }, [open, mindmapId]);

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/mindmaps/${mindmapId}/versions/${versionId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { content: MindmapContent };
      // replaceContent commits history, so restoring is one local Undo away, and the
      // regular autosave path picks up the change and persists it like any other edit.
      replaceContent(data.content.nodes, data.content.edges);
      setOpen(false);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Version history" title="Version history">
          <History className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            A snapshot is saved every time this mindmap&apos;s content is saved. Restoring
            replaces the current canvas — your own local Undo can still bring it back.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No earlier versions yet.</p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{relativeTime(version.createdAt)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoringId === version.id}
                  onClick={() => handleRestore(version.id)}
                >
                  {restoringId === version.id && <Loader2 className="size-3.5 animate-spin" />}
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
