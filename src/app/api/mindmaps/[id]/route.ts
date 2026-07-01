import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { updateMindmapSchema } from "@/lib/validations/mindmap";
import { encodeContent, decodeContent } from "@/lib/mindmap/content-codec";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  return jsonOk({
    id: mindmap.id,
    title: mindmap.title,
    content: decodeContent(mindmap.content),
    updatedAt: mindmap.updatedAt.toISOString(),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 2_000_000) {
    return jsonError("Payload too large", 413);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMindmapSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { title, content, clientUpdatedAt, thumbnail } = parsed.data;

  if (clientUpdatedAt !== mindmap.updatedAt.toISOString()) {
    return jsonError("Conflict: mindmap was modified elsewhere", 409);
  }

  const now = new Date();
  const updated = await prisma.mindmap.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content: encodeContent(content) } : {}),
      // Oversized thumbnails are silently dropped rather than rejecting the whole
      // save — a stale/missing dashboard thumbnail isn't worth losing canvas edits.
      ...(thumbnail !== undefined && thumbnail !== null && thumbnail.length <= 150_000
        ? { thumbnail }
        : {}),
      updatedAt: now,
    },
  });

  return jsonOk({ updatedAt: updated.updatedAt.toISOString() });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  await prisma.mindmap.delete({ where: { id } });
  return jsonOk({ id });
}
