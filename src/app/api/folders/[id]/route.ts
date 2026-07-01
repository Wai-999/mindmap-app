import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { renameFolderSchema } from "@/lib/validations/organization";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.ownerId !== session.user.id) return jsonError("Folder not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = renameFolderSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const updated = await prisma.folder.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true },
  });
  return jsonOk({ folder: updated });
}

// Mindmaps inside are unfiled (folderId -> null), not deleted, via the schema's
// onDelete: SetNull.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.ownerId !== session.user.id) return jsonError("Folder not found", 404);

  await prisma.folder.delete({ where: { id } });
  return jsonOk({ id });
}
