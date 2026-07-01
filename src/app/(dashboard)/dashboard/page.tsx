import { auth } from "@/lib/auth";
import { prisma, isPostgres } from "@/lib/prisma";
import { buildDashboardWhere } from "@/lib/mindmap/dashboard-filter";
import { MindmapGrid } from "@/components/dashboard/mindmap-grid";
import type { MindmapSummary, FolderSummary, TagSummary } from "@/types/mindmap";

interface DashboardPageProps {
  searchParams: Promise<{ folder?: string; q?: string; tag?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  const { folder, q, tag } = await searchParams;
  const ownerId = session!.user.id;

  const where = buildDashboardWhere({
    ownerId,
    folderId: folder,
    query: q,
    tagId: tag,
    isPostgres: isPostgres(),
  });

  const [mindmaps, folders, tags] = await Promise.all([
    prisma.mindmap.findMany({
      where,
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
    }),
    prisma.folder.findMany({
      where: { ownerId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.tag.findMany({
      where: { ownerId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const summaries: MindmapSummary[] = mindmaps.map((m) => ({
    id: m.id,
    title: m.title,
    updatedAt: m.updatedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
    thumbnail: m.thumbnail,
    folderId: m.folderId,
    tags: m.tags,
  }));
  const folderSummaries: FolderSummary[] = folders;
  const tagSummaries: TagSummary[] = tags;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <div className="mt-6">
        <MindmapGrid
          initialMindmaps={summaries}
          folders={folderSummaries}
          tags={tagSummaries}
          activeFolderId={folder ?? null}
          activeTagId={tag ?? null}
          searchQuery={q ?? ""}
        />
      </div>
    </div>
  );
}
