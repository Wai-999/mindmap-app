import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveShareAccess } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";
import { uploadAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/mindmap/attachments";

interface RouteParams {
  params: Promise<{ token: string }>;
}

function accessErrorResponse(reason: "not_found" | "expired") {
  return reason === "expired"
    ? jsonError("This link has expired or was revoked", 410)
    : jsonError("Link not found", 404);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return accessErrorResponse(result.reason);

  const nodeId = request.nextUrl.searchParams.get("nodeId");
  const attachments = await prisma.attachment.findMany({
    where: { mindmapId: result.mindmap.id, ...(nodeId ? { nodeId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return jsonOk({ attachments });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return accessErrorResponse(result.reason);
  if (result.permission !== "EDIT") return jsonError("This link is view-only", 403);

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_ATTACHMENT_BYTES) {
    return jsonError("File too large", 413);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("Invalid form data", 400);

  const nodeId = formData.get("nodeId");
  const file = formData.get("file");
  if (typeof nodeId !== "string" || !nodeId) return jsonError("nodeId is required", 400);
  if (!(file instanceof File)) return jsonError("file is required", 400);

  const uploadResult = await uploadAttachment({ mindmapId: result.mindmap.id, nodeId, file });
  if (!uploadResult.ok) return jsonError(uploadResult.error, uploadResult.status);
  return jsonOk({ attachment: uploadResult.attachment }, 201);
}
