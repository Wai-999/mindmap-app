"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatusIndicator } from "@/components/editor/save-status-indicator";
import { ShareDialog } from "@/components/editor/share/share-dialog";
import { PresenceAvatars } from "@/components/editor/collab/presence-avatars";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function EditorHeader() {
  const mindmapId = useEditorStore((s) => s.mindmapId);
  const title = useEditorStore((s) => s.title);
  const setTitle = useEditorStore((s) => s.setTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  function startEditing() {
    setDraftTitle(title);
    setIsEditingTitle(true);
  }

  function commitTitle() {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) setTitle(trimmed);
    setIsEditingTitle(false);
  }

  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-between border-b px-3">
      <div className="flex min-w-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="size-9 shrink-0" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        {isEditingTitle ? (
          <Input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraftTitle(title);
                setIsEditingTitle(false);
              }
            }}
            className="h-8 w-64 font-medium"
          />
        ) : (
          <button
            type="button"
            className="hover:bg-accent truncate rounded-md px-2 py-1 text-sm font-medium"
            onClick={startEditing}
          >
            {title}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <PresenceAvatars />
        <SaveStatusIndicator />
        <ThemeToggle />
        {mindmapId && <ShareDialog mindmapId={mindmapId} />}
      </div>
    </header>
  );
}
