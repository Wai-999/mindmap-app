import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { createFolderSchema } from "@/lib/validations/organization";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const folders = await prisma.folder.findMany({
    where: { ownerId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return jsonOk({ folders });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = createFolderSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const folder = await prisma.folder.create({
    data: { name: parsed.data.name, ownerId: session.user.id },
    select: { id: true, name: true },
  });
  return jsonOk({ folder }, 201);
}
