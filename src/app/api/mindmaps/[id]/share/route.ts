import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { createShareLinkSchema } from "@/lib/validations/share";
import { generateShareToken } from "@/lib/tokens";
import type { ShareLinkSummary, SharePermission } from "@/types/share";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const links = await prisma.shareLink.findMany({
    where: { mindmapId: id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const summaries: ShareLinkSummary[] = links.map((l) => ({
    id: l.id,
    token: l.token,
    permission: l.permission as SharePermission,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  return jsonOk(summaries);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const body = await request.json().catch(() => ({}));
  const parsed = createShareLinkSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { permission, expiresInDays } = parsed.data;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const link = await prisma.shareLink.create({
    data: { token: generateShareToken(), permission, mindmapId: id, expiresAt },
  });

  const summary: ShareLinkSummary = {
    id: link.id,
    token: link.token,
    permission: link.permission as SharePermission,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };

  return jsonOk(summary, 201);
}
