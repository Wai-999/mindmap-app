import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// List only — no create endpoint needed here, snapshots are taken automatically by
// applyMindmapUpdate on every content save (see lib/mindmap/versions.ts).
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const versions = await prisma.mindmapVersion.findMany({
    where: { mindmapId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return jsonOk({ versions });
}
