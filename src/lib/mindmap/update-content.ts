import type { Mindmap } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { encodeContent, decodeContent } from "@/lib/mindmap/content-codec";
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

  return { ok: true, updatedAt: updated.updatedAt.toISOString() };
}
