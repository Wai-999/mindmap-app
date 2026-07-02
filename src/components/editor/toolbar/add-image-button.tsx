"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import type { AttachmentRecord } from "@/types/mindmap";

// "Upload an image onto the canvas": pick any image file, drop a standalone image
// node where the cursor is, and upload the file through the existing per-node
// attachment pipeline. The node renders as just the image (imageOnly) once the
// upload lands. Reuses everything — undo, autosave, sharing — for free.
export function AddImageButton({ endpoint }: { endpoint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const addImageNode = useEditorStore((s) => s.addImageNode);
  const addAttachment = useEditorStore((s) => s.addAttachment);
  const deleteNodeAndSubtree = useEditorStore((s) => s.deleteNodeAndSubtree);

  async function handleFile(file: File) {
    // Create the node first so it appears immediately (placeholder), then fill it in
    // with the uploaded image. nodeId is client-generated, and attachments correlate
    // by that id, so the order is fine.
    const nodeId = addImageNode(file.name);
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
        toast.error(res.status === 413 ? "Image is too large (max 10MB)." : "Couldn't upload the image.");
        return;
      }
      const data = (await res.json()) as { attachment: AttachmentRecord };
      // Endpoint-scoped URL, same rewrite the inspector's upload path uses — the
      // server returns the owner-authenticated path, which a share visitor can't use.
      addAttachment({ ...data.attachment, url: `${endpoint}/attachments/${data.attachment.id}` });
    } catch {
      deleteNodeAndSubtree(nodeId);
      toast.error("Couldn't upload the image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file twice in a row still fires onChange.
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Add image"
        aria-label="Add image"
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      </Button>
    </>
  );
}
