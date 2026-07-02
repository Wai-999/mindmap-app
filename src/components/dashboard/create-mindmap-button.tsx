"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TEMPLATES } from "@/lib/mindmap/templates";
import { cn } from "@/lib/utils";

export function CreateMindmapButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The id of the card currently being created (or "blank"), so only that card shows a
  // spinner while its mindmap is created.
  const [creatingId, setCreatingId] = useState<string | null>(null);

  async function create(templateId?: string) {
    setCreatingId(templateId ?? "blank");
    try {
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateId ? { templateId } : {}),
      });
      if (!res.ok) throw new Error("Failed to create mindmap");
      const { id } = (await res.json()) as { id: string };
      router.push(`/mindmap/${id}`);
    } catch {
      setCreatingId(null);
    }
  }

  const busy = creatingId !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New mindmap
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New mindmap</DialogTitle>
          <DialogDescription>Start from scratch or pick a template.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <TemplateCard
            title="Blank"
            description="An empty canvas with one idea"
            loading={creatingId === "blank"}
            disabled={busy}
            onClick={() => create()}
          />
          {TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              title={t.name}
              description={t.description}
              loading={creatingId === t.id}
              disabled={busy}
              onClick={() => create(t.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  title,
  description,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "hover:border-foreground/30 hover:bg-accent flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none",
        disabled && !loading && "opacity-50",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
        {title}
      </span>
      <span className="text-muted-foreground text-xs">{description}</span>
    </button>
  );
}
