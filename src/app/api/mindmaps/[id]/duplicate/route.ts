import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const copy = await prisma.mindmap.create({
    data: {
      title: `${mindmap.title} (copy)`,
      content: mindmap.content,
      thumbnail: mindmap.thumbnail,
      ownerId: session.user.id,
    },
  });

  return jsonOk({ id: copy.id }, 201);
}
