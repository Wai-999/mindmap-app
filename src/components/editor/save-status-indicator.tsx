"use client";

import type { ReactNode } from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";

import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

export function SaveStatusIndicator() {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const dirty = useEditorStore((s) => s.dirty);

  if (saveStatus === "saving") {
    return <StatusPill icon={<Loader2 className="size-3.5 animate-spin" />} label="Saving…" />;
  }
  if (saveStatus === "error") {
    return (
      <StatusPill
        icon={<CloudOff className="size-3.5" />}
        label="Save failed"
        className="text-destructive"
      />
    );
  }
  if (dirty) {
    return <StatusPill icon={<Loader2 className="size-3.5" />} label="Unsaved changes" />;
  }
  return <StatusPill icon={<Check className="size-3.5" />} label="Saved" />;
}

function StatusPill({
  icon,
  label,
  className,
}: {
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}>
      {icon}
      {label}
    </div>
  );
}
