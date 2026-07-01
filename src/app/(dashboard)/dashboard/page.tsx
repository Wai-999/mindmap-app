import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MindmapGrid } from "@/components/dashboard/mindmap-grid";
import type { MindmapSummary } from "@/types/mindmap";

export default async function DashboardPage() {
  const session = await auth();
  const mindmaps = await prisma.mindmap.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true, thumbnail: true },
  });

  const summaries: MindmapSummary[] = mindmaps.map((m) => ({
    id: m.id,
    title: m.title,
    updatedAt: m.updatedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
    thumbnail: m.thumbnail,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <div className="mt-6">
        <MindmapGrid initialMindmaps={summaries} />
      </div>
    </div>
  );
}
