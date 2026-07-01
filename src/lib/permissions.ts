import type { Mindmap, ShareLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SharePermission } from "@/types/share";

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

export type ShareAccessResult =
  | { ok: true; mindmap: Mindmap; permission: SharePermission; shareLink: ShareLink }
  | { ok: false; reason: "not_found" | "expired" };

export async function resolveShareAccess(token: string): Promise<ShareAccessResult> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { mindmap: true },
  });

  if (!shareLink) return { ok: false, reason: "not_found" };
  if (shareLink.revokedAt) return { ok: false, reason: "expired" };
  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    mindmap: shareLink.mindmap,
    permission: shareLink.permission as SharePermission,
    shareLink,
  };
}
