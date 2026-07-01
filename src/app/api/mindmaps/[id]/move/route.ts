import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { moveMindmapSchema } from "@/lib/validations/organization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Separate from the main content PATCH route deliberately — that route's optimistic
// concurrency check is specifically for canvas content, and a folder move shouldn't
// need a clientUpdatedAt to avoid clobbering someone else's in-progress edit (same
// reasoning as why a title-only rename already skips that check).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = moveMindmapSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  if (parsed.data.folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: parsed.data.folderId } });
    if (!folder || folder.ownerId !== session.user.id) return jsonError("Folder not found", 404);
  }

  await prisma.mindmap.update({ where: { id }, data: { folderId: parsed.data.folderId } });
  return jsonOk({ id, folderId: parsed.data.folderId });
}
