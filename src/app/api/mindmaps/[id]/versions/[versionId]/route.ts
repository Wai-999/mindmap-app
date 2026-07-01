import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";
import { decodeContent } from "@/lib/mindmap/content-codec";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

// Fetches one version's content for a restore preview/apply. No server-side "restore"
// endpoint — restoring is a client-side action: fetch the version here, then call the
// existing PATCH .../route.ts with that content like any other save (goes through the
// normal 409-guarded path, and calling editor-store's replaceContent makes it undo-able).
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id, versionId } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const version = await prisma.mindmapVersion.findUnique({ where: { id: versionId } });
  if (!version || version.mindmapId !== id) return jsonError("Version not found", 404);

  return jsonOk({
    id: version.id,
    title: version.title,
    content: decodeContent(version.content),
    createdAt: version.createdAt.toISOString(),
  });
}
