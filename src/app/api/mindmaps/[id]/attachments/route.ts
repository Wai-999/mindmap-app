import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";
import { uploadAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/mindmap/attachments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const nodeId = request.nextUrl.searchParams.get("nodeId");
  const attachments = await prisma.attachment.findMany({
    where: { mindmapId: id, ...(nodeId ? { nodeId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  return jsonOk({ attachments });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

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

  const result = await uploadAttachment({ mindmapId: id, nodeId, file });
  if (!result.ok) return jsonError(result.error, result.status);
  return jsonOk({ attachment: result.attachment }, 201);
}
