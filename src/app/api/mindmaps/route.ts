import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { createMindmapSchema } from "@/lib/validations/mindmap";
import { encodeContent } from "@/lib/mindmap/content-codec";
import { createSeedContent } from "@/lib/mindmap/defaults";
import { getTemplate } from "@/lib/mindmap/templates";
import type { MindmapSummary } from "@/types/mindmap";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const mindmaps = await prisma.mindmap.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdAt: true,
      thumbnail: true,
      folderId: true,
      tags: { select: { id: true, name: true } },
    },
  });

  const summaries: MindmapSummary[] = mindmaps.map((m) => ({
    id: m.id,
    title: m.title,
    updatedAt: m.updatedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
    thumbnail: m.thumbnail,
    folderId: m.folderId,
    tags: m.tags,
  }));

  return jsonOk(summaries);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const parsed = createMindmapSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  // A known template seeds its content and (unless the caller named one) its title;
  // an unknown/absent template falls back to the plain single-node seed.
  const template = parsed.data.templateId ? getTemplate(parsed.data.templateId) : undefined;
  const title = parsed.data.title ?? template?.name ?? "Untitled Mindmap";
  const content = template ? template.build() : createSeedContent();

  const mindmap = await prisma.mindmap.create({
    data: {
      title,
      content: encodeContent(content),
      ownerId: session.user.id,
    },
  });

  return jsonOk({ id: mindmap.id }, 201);
}
