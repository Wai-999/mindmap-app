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
  // Returns undefined (falling back to the store action's own default placement)
  // if the pane hasn't been measured yet or zoom is somehow non-finite — a stale
  // or zero measurement here would otherwise place the node off-screen instead of
  // just landing somewhere less exact.
  function viewportCenter(): { x: number; y: number } | undefined {
    if (!paneWidth || !paneHeight) return undefined;
    const { x, y, zoom } = getViewport();
    if (!zoom || !Number.isFinite(zoom)) return undefined;
    return { x: (paneWidth / 2 - x) / zoom, y: (paneHeight / 2 - y) / zoom };
  }

  async function handleFile(file: File) {
    // Create the node first so it appears immediately (placeholder), then fill it in
    // with the uploaded file. nodeId is client-generated, and attachments correlate
    // by that id, so the order is fine.
    const nodeId = addFileNode(file.name, file.type.startsWith("image/"), viewportCenter());
    if (!nodeId) return; // read-only, shouldn't happen (button is hidden then)

    setUploading(true);
    const formData = new FormData();
    formData.append("nodeId", nodeId);
    formData.append("file", file);
    try {
      const res = await fetch(`${endpoint}/attachments`, { method: "POST", body: formData });
      if (!res.ok) {
        // Roll the empty placeholder node back so a failed upload doesn't strand it.
        deleteNodeAndSubtree(nodeId);
        toast.error(res.status === 413 ? "File is too large (max 10MB)." : "Couldn't upload the file.");
        return;
      }
      const data = (await res.json()) as { attachment: AttachmentRecord };
      // Endpoint-scoped URL, same rewrite the inspector's upload path uses — the
      // server returns the owner-authenticated path, which a share visitor can't use.
      addAttachment({ ...data.attachment, url: `${endpoint}/attachments/${data.attachment.id}` });
    } catch {
      deleteNodeAndSubtree(nodeId);
      toast.error("Couldn't upload the file.");
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
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file twice in a row still fires onChange.
          e.target.value = "";
          if (file) void handleFile(file);
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
            <Paperclip /> File…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
