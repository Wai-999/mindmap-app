import type { Prisma } from "@prisma/client";

export interface DashboardFilterParams {
  ownerId: string;
  folderId?: string;
  query?: string;
  tagId?: string;
  isPostgres: boolean;
}

// Extracted for testability — Prisma's `mode: "insensitive"` filter option is
// Postgres-only (SQLite ignores/rejects it), so this branches on the caller-provided
// `isPostgres` flag rather than reaching for lib/prisma.ts's isPostgres() directly,
// keeping this a pure function with no I/O.
export function buildDashboardWhere(params: DashboardFilterParams): Prisma.MindmapWhereInput {
  const { ownerId, folderId, query, tagId, isPostgres } = params;
  const trimmedQuery = query?.trim();

  return {
    ownerId,
    ...(folderId ? { folderId } : {}),
    ...(trimmedQuery
      ? {
          title: {
            contains: trimmedQuery,
            ...(isPostgres ? { mode: "insensitive" as const } : {}),
          },
        }
      : {}),
    ...(tagId ? { tags: { some: { id: tagId } } } : {}),
  };
}
