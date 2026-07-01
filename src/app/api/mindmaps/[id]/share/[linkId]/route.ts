import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { updateShareLinkSchema } from "@/lib/validations/share";

interface RouteParams {
  params: Promise<{ id: string; linkId: string }>;
}

async function assertLinkOwnership(userId: string, mindmapId: string, linkId: string) {
  const mindmap = await getOwnedMindmap(userId, mindmapId);
  if (!mindmap) return null;

  const link = await prisma.shareLink.findUnique({ where: { id: linkId } });
  if (!link || link.mindmapId !== mindmapId) return null;
  return link;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id, linkId } = await params;
  const link = await assertLinkOwnership(session.user.id, id, linkId);
  if (!link) return jsonError("Share link not found", 404);

  const body = await request.json().catch(() => ({}));
  const parsed = updateShareLinkSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const updated = await prisma.shareLink.update({
    where: { id: linkId },
    data: {
      ...(parsed.data.permission ? { permission: parsed.data.permission } : {}),
      ...(parsed.data.revoke ? { revokedAt: new Date() } : {}),
    },
  });

  return jsonOk({ id: updated.id });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id, linkId } = await params;
  const link = await assertLinkOwnership(session.user.id, id, linkId);
  if (!link) return jsonError("Share link not found", 404);

  await prisma.shareLink.delete({ where: { id: linkId } });
  return jsonOk({ id: linkId });
}
