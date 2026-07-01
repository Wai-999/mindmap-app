"use client";

import { useEffect, useState } from "react";
import { Share2, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShareLinkRow } from "@/components/editor/share/share-link-row";
import type { ShareLinkSummary, SharePermission } from "@/types/share";

export function ShareDialog({ mindmapId }: { mindmapId: string }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLinkSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [permission, setPermission] = useState<SharePermission>("VIEW");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/mindmaps/${mindmapId}/share`)
      .then((res) => res.json())
      .then((data: ShareLinkSummary[]) => setLinks(data))
      .finally(() => setLoading(false));
  }, [open, mindmapId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch(`/api/mindmaps/${mindmapId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission }),
      });
      if (res.ok) {
        const link = (await res.json()) as ShareLinkSummary;
        setLinks((prev) => [link, ...prev]);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(linkId: string) {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    await fetch(`/api/mindmaps/${mindmapId}/share/${linkId}`, { method: "DELETE" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this mindmap</DialogTitle>
          <DialogDescription>
            Anyone with the link can open it — no account required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Select
            value={permission}
            onValueChange={(v) => setPermission(v as SharePermission)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEW">Can view</SelectItem>
              <SelectItem value="EDIT">Can edit</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={creating} className="flex-1">
            {creating && <Loader2 className="size-4 animate-spin" />}
            Create link
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active share links yet.</p>
          ) : (
            links.map((link) => <ShareLinkRow key={link.id} link={link} onRevoke={handleRevoke} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
