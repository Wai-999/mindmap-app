import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";
import { deleteAttachment } from "@/lib/mindmap/attachments";

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id, attachmentId } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.mindmapId !== id) return jsonError("Attachment not found", 404);

  const buffer = await storage.read(attachment.id).catch(() => null);
  if (!buffer) return jsonError("File not found", 404);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id, attachmentId } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.mindmapId !== id) return jsonError("Attachment not found", 404);

  await deleteAttachment(attachment);
  return jsonOk({ id: attachmentId });
}
