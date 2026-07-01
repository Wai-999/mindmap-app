import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { setMindmapTagsSchema } from "@/lib/validations/organization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Full replace: upserts each tag name (by this owner) and connects exactly that set,
// disconnecting any tag not in the new list. Simpler than separate add/remove
// endpoints for what's a small, infrequently-edited list per mindmap.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = setMindmapTagsSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const uniqueNames = [...new Set(parsed.data.tagNames)];
  const tags = await Promise.all(
    uniqueNames.map((name) =>
      prisma.tag.upsert({
        where: { ownerId_name: { ownerId: session.user.id, name } },
        create: { name, ownerId: session.user.id },
        update: {},
        select: { id: true, name: true },
      }),
    ),
  );

  await prisma.mindmap.update({
    where: { id },
    data: { tags: { set: tags.map((t) => ({ id: t.id })) } },
  });

  return jsonOk({ tags });
}
