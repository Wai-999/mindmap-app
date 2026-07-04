import type { Mindmap } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { encodeContent, decodeContent } from "@/lib/mindmap/content-codec";
import { deleteAttachment } from "@/lib/mindmap/attachments";
import { snapshotMindmapVersion } from "@/lib/mindmap/versions";
import type { MindmapContent } from "@/types/mindmap";

export interface MindmapUpdateInput {
  title?: string;
  content?: MindmapContent;
  clientUpdatedAt?: string;
  thumbnail?: string | null;
}

export type MindmapUpdateResult =
  | { ok: true; updatedAt: string }
  | { ok: false; status: 409; content: MindmapContent; updatedAt: string };

// Shared by the owner PATCH route and the public share-link PATCH route — both need
// identical optimistic-concurrency + write semantics, just reached through different
// auth models (session vs. token), so only this core is shared.
export async function applyMindmapUpdate(
  current: Mindmap,
  input: MindmapUpdateInput,
): Promise<MindmapUpdateResult> {
  // Concurrency only matters when overwriting canvas content — a title-only rename
  // (e.g. from the dashboard, which doesn't have the mindmap's current updatedAt on
  // hand) can't clobber someone else's in-progress edits, so it skips the check.
  if (input.content !== undefined && input.clientUpdatedAt !== current.updatedAt.toISOString()) {
    return {
      ok: false,
      status: 409,
      content: decodeContent(current.content),
      updatedAt: current.updatedAt.toISOString(),
    };
  }

  const updated = await prisma.mindmap.update({
    where: { id: current.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: encodeContent(input.content) } : {}),
      // Oversized thumbnails are silently dropped rather than rejecting the whole
      // save — a stale/missing dashboard thumbnail isn't worth losing canvas edits.
      ...(input.thumbnail !== undefined && input.thumbnail !== null && input.thumbnail.length <= 150_000
        ? { thumbnail: input.thumbnail }
        : {}),
      updatedAt: new Date(),
    },
  });

  // Attachments aren't foreign-keyed to nodes (nodes live in the JSON blob, not as
  // rows), so deleting a node client-side doesn't cascade — clean up here, the one
  // place that has both the old and new node-id sets in hand at exactly the right
  // moment. Best-effort: an orphaned file left behind on a rare failure here is a
  // minor storage-cleanliness issue, not a correctness one, so it isn't allowed to
  // fail the save itself.
  if (input.content !== undefined) {
    // Best-effort: if the previously-stored content can't be decoded, there's no
    // diff to compute — skip cleanup rather than let it block the save itself
    // (the save above already succeeded and doesn't depend on reading old content).
    const oldNodeIds = new Set(
      (() => {
        try {
          return decodeContent(current.content).nodes.map((n) => n.id);
        } catch {
          return [];
        }
      })(),
    );
    const newNodeIds = new Set(input.content.nodes.map((n) => n.id));
    const removedNodeIds = [...oldNodeIds].filter((id) => !newNodeIds.has(id));

    if (removedNodeIds.length > 0) {
      await prisma.attachment
        .findMany({ where: { mindmapId: current.id, nodeId: { in: removedNodeIds } } })
        .then((orphaned) => Promise.all(orphaned.map((a) => deleteAttachment(a))))
        .catch(() => undefined);
    }

    // Snapshot for version history — only on real content changes, same branch that
    // already skips the concurrency check for title-only saves, since those can't
    // meaningfully be "restored" the way a content version can.
    await snapshotMindmapVersion(current.id, updated.title, updated.content).catch(() => undefined);
  }

  return { ok: true, updatedAt: updated.updatedAt.toISOString() };
}
