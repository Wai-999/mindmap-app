import type { Attachment } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

// MIME types considered safe to render inline in a browser tab. "Add file" still
// accepts any file type on upload (an intentional feature, not a bug) — this
// allowlist only controls how a download route serves a file back, which is the
// actual attack surface: an uploaded .html/.svg opened via direct navigation to
// its attachment URL would otherwise execute as a same-origin page (stored XSS).
// Anything not on this list downloads instead of rendering (see the download
// routes), which doesn't affect using an uploaded image as a node's <img> src —
// browsers don't apply Content-Disposition to subresource loads, only to
// navigations.
const INLINE_SAFE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

export function isInlineSafeMimeType(mimeType: string): boolean {
  return INLINE_SAFE_MIME_TYPES.has(mimeType);
}

export interface UploadAttachmentInput {
  mindmapId: string;
  nodeId: string;
  file: File;
}

export type UploadAttachmentResult =
  | { ok: true; attachment: Attachment }
  | { ok: false; status: number; error: string };

// Shared by the owner and share-link upload routes — both need identical
// validation/storage/DB semantics, just reached through different auth models.
export async function uploadAttachment(input: UploadAttachmentInput): Promise<UploadAttachmentResult> {
  if (input.file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, status: 413, error: "File too large (max 10MB)" };
  }

  const created = await prisma.attachment.create({
    data: {
      mindmapId: input.mindmapId,
      nodeId: input.nodeId,
      name: input.file.name || "Untitled file",
      size: input.file.size,
      mimeType: input.file.type || "application/octet-stream",
      url: "", // filled in immediately below, once the row's own id is known
    },
  });

  const buffer = Buffer.from(await input.file.arrayBuffer());
  await storage.save(created.id, buffer);

  // The owner-path download route — always valid from the editor, which is also the
  // only place that needs a bare fetchable URL (e.g. Phase 14's PPTX image export).
  // The shared viewer constructs its own token-scoped download URL client-side rather
  // than relying on this one, since a share visitor can't authenticate against it.
  const url = `/api/mindmaps/${input.mindmapId}/attachments/${created.id}`;
  return { ok: true, attachment: await prisma.attachment.update({ where: { id: created.id }, data: { url } }) };
}

// Shared by the owner and share-link delete routes, and by applyMindmapUpdate's
// orphan cleanup when a node disappears from a save's content.
export async function deleteAttachment(attachment: Attachment): Promise<void> {
  await storage.delete(attachment.id);
  await prisma.attachment.delete({ where: { id: attachment.id } });
}
