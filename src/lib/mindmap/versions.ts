import { prisma } from "@/lib/prisma";

const MAX_VERSIONS_PER_MINDMAP = 50;

// Called from applyMindmapUpdate on every successful *content* change (not
// title-only saves). Best-effort: a failure here shouldn't fail the save itself —
// version history is a convenience feature, not part of the save's own correctness
// (same reasoning as the attachment-orphan cleanup in the same function).
export async function snapshotMindmapVersion(
  mindmapId: string,
  title: string,
  content: string,
): Promise<void> {
  await prisma.mindmapVersion.create({ data: { mindmapId, title, content } });
  await pruneMindmapVersions(mindmapId);
}

// Keeps only the most recent MAX_VERSIONS_PER_MINDMAP snapshots for a mindmap,
// deleting older ones — mirrors history-store.ts's capped in-memory undo stack, just
// with a much smaller cap since these are durable DB rows.
export async function pruneMindmapVersions(mindmapId: string): Promise<void> {
  const toDelete = await prisma.mindmapVersion.findMany({
    where: { mindmapId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: MAX_VERSIONS_PER_MINDMAP,
  });
  if (toDelete.length === 0) return;

  await prisma.mindmapVersion.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
}
