"use client";

import { useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { CirclePlus, Type, StickyNote, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { computeViewportCenter } from "@/lib/mindmap/viewport-center";
import type { AttachmentRecord } from "@/types/mindmap";

interface InsertMenuProps {
  endpoint: string;
}

// One entry point for every standalone-node creation action, consolidating what
// used to be a growing row of separate toolbar buttons (add idea/text/sticky
// note/file) — mirrors Freeform's own single "insert" icon, which groups its
// shape/text/note/file options behind one popover instead of a button per kind.
export function InsertMenu({ endpoint }: InsertMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const addRootNode = useEditorStore((s) => s.addRootNode);
  const addTextNode = useEditorStore((s) => s.addTextNode);
  const addStickyNote = useEditorStore((s) => s.addStickyNote);
  const addFileNode = useEditorStore((s) => s.addFileNode);
  const addAttachment = useEditorStore((s) => s.addAttachment);
  const deleteNodeAndSubtree = useEditorStore((s) => s.deleteNodeAndSubtree);
  const { getViewport } = useReactFlow();
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);

  // Every Insert action lands its new node at the middle of whatever's currently
  // visible, instead of wherever the cursor last happened to be hovering (the
  // previous default) — reads as "insert here, in front of me" regardless of
  // where the mouse drifted before opening this menu. Computed fresh on each call
  // (not memoized) since pan/zoom can change while the menu or a file picker is open.
  function viewportCenter(): { x: number; y: number } | undefined {
    return computeViewportCenter({ width: paneWidth, height: paneHeight }, getViewport());
  }

  async function handleFile(file: File, at: { x: number; y: number } | undefined) {
    // Create the node first so it appears immediately (placeholder), then fill it in
    // with the uploaded file. nodeId is client-generated, and attachments correlate
    // by that id, so the order is fine.
    const nodeId = addFileNode(file.name, file.type.startsWith("image/"), at);
    if (!nodeId) return; // read-only, shouldn't happen (button is hidden then)

    const formData = new FormData();
    formData.append("nodeId", nodeId);
    formData.append("file", file);
    try {
      const res = await fetch(`${endpoint}/attachments`, { method: "POST", body: formData });
      if (!res.ok) {
        // Roll the empty placeholder node back so a failed upload doesn't strand it.
        deleteNodeAndSubtree(nodeId);
        toast.error(
          res.status === 413 ? `"${file.name}" is too large (max 10MB).` : `Couldn't upload "${file.name}".`,
        );
        return;
      }
      const data = (await res.json()) as { attachment: AttachmentRecord };
      // Endpoint-scoped URL, same rewrite the inspector's upload path uses — the
      // server returns the owner-authenticated path, which a share visitor can't use.
      addAttachment({ ...data.attachment, url: `${endpoint}/attachments/${data.attachment.id}` });
    } catch {
      deleteNodeAndSubtree(nodeId);
      toast.error(`Couldn't upload "${file.name}".`);
    }
  }

  // Multiple files land as a grid (not all stacked on the same spot) so a batch of
  // photos picked at once is immediately usable instead of needing to be dragged
  // apart first. Uploads run concurrently — each file/node pair is independent, so
  // one slow or failed upload shouldn't hold up the rest of the batch.
  const GRID_COLUMNS = 3;
  const GRID_GAP_X = 280;
  const GRID_GAP_Y = 220;

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const base = viewportCenter();
      await Promise.all(
        files.map((file, i) => {
          const at = base
            ? { x: base.x + (i % GRID_COLUMNS) * GRID_GAP_X, y: base.y + Math.floor(i / GRID_COLUMNS) * GRID_GAP_Y }
            : undefined;
          return handleFile(file, at);
        }),
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {/* Kept outside DropdownMenuContent so it stays mounted (and clickable via
          ref) regardless of the menu's own open/closed state. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Reset so picking the same file(s) twice in a row still fires onChange.
          e.target.value = "";
          if (files.length > 0) void handleFiles(files);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            disabled={uploading}
            title="Insert"
            aria-label="Insert"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <CirclePlus className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => addRootNode(viewportCenter())}>
            <CirclePlus /> Idea
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addTextNode(viewportCenter())}>
            <Type /> Text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addStickyNote(viewportCenter())}>
            <StickyNote /> Sticky note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <Paperclip /> Files…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
