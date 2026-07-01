"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { TagSummary } from "@/types/mindmap";

interface EditTagsDialogProps {
  mindmapId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTags: TagSummary[];
  onSubmit: (tags: TagSummary[]) => void;
}

export function EditTagsDialog({
  mindmapId,
  open,
  onOpenChange,
  currentTags,
  onSubmit,
}: EditTagsDialogProps) {
  const [names, setNames] = useState<string[]>(() => currentTags.map((t) => t.name));
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function addFromDraft() {
    const name = draft.trim();
    setDraft("");
    if (!name || names.includes(name)) return;
    setNames((prev) => [...prev, name]);
  }

  async function handleSave() {
    addFromDraft();
    const finalNames = draft.trim() && !names.includes(draft.trim()) ? [...names, draft.trim()] : names;

    setSaving(true);
    try {
      const res = await fetch(`/api/mindmaps/${mindmapId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagNames: finalNames }),
      });
      if (!res.ok) {
        toast.error("Couldn't save tags.");
        return;
      }
      const data = (await res.json()) as { tags: TagSummary[] };
      onSubmit(data.tags);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setNames(currentTags.map((t) => t.name));
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription>Tag this mindmap to find it faster later.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {names.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1">
              {name}
              <button
                type="button"
                onClick={() => setNames((prev) => prev.filter((n) => n !== name))}
                aria-label={`Remove ${name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>

        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addFromDraft();
            }
          }}
          placeholder="Type a tag and press Enter…"
        />

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
