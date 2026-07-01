import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { createTagSchema } from "@/lib/validations/organization";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const tags = await prisma.tag.findMany({
    where: { ownerId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return jsonOk({ tags });
}

// Rarely called directly — setMindmapTags (api/mindmaps/[id]/tags) upserts tags by
// name as part of tagging a mindmap. This exists for a standalone "create an empty
// tag ahead of time" flow if the UI ever wants one.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const tag = await prisma.tag.upsert({
    where: { ownerId_name: { ownerId: session.user.id, name: parsed.data.name } },
    create: { name: parsed.data.name, ownerId: session.user.id },
    update: {},
    select: { id: true, name: true },
  });
  return jsonOk({ tag }, 201);
}
