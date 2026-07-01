import type { Mindmap } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Returns null for both "doesn't exist" and "exists but isn't yours" — callers should
// respond 404 in both cases so a non-owner can't distinguish the two.
export async function getOwnedMindmap(
  userId: string,
  mindmapId: string,
): Promise<Mindmap | null> {
  const mindmap = await prisma.mindmap.findUnique({ where: { id: mindmapId } });
  if (!mindmap || mindmap.ownerId !== userId) return null;
  return mindmap;
}
