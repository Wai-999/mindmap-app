import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { resolveShareAccess } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";
import { deleteAttachment } from "@/lib/mindmap/attachments";

interface RouteParams {
  params: Promise<{ token: string; attachmentId: string }>;
}

function accessErrorResponse(reason: "not_found" | "expired") {
  return reason === "expired"
    ? jsonError("This link has expired or was revoked", 410)
    : jsonError("Link not found", 404);
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token, attachmentId } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return accessErrorResponse(result.reason);

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.mindmapId !== result.mindmap.id) {
    return jsonError("Attachment not found", 404);
  }

  const buffer = await storage.read(attachment.id).catch(() => null);
  if (!buffer) return jsonError("File not found", 404);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { token, attachmentId } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return accessErrorResponse(result.reason);
  if (result.permission !== "EDIT") return jsonError("This link is view-only", 403);

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.mindmapId !== result.mindmap.id) {
    return jsonError("Attachment not found", 404);
  }

  await deleteAttachment(attachment);
  return jsonOk({ id: attachmentId });
}
