"use client";

import { useRef, useState } from "react";
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

  async function handleFile(file: File) {
    // Create the node first so it appears immediately (placeholder), then fill it in
    // with the uploaded file. nodeId is client-generated, and attachments correlate
    // by that id, so the order is fine.
    const nodeId = addFileNode(file.name, file.type.startsWith("image/"));
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
          <DropdownMenuItem onClick={() => addRootNode()}>
            <CirclePlus /> Idea
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addTextNode()}>
            <Type /> Text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addStickyNote()}>
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
