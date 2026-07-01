import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateMindmapButton } from "@/components/dashboard/create-mindmap-button";

// Minimal working version for Phase 2 verification — replaced with the full card
// grid (thumbnails, rename/duplicate/delete, empty state) in Phase 4.
export default async function DashboardPage() {
  const session = await auth();
  const mindmaps = await prisma.mindmap.findMany({
    where: { ownerId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <CreateMindmapButton />
      </div>

      {mindmaps.length === 0 ? (
        <p className="text-muted-foreground mt-8">You don&apos;t have any mindmaps yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mindmaps.map((m) => (
            <li key={m.id}>
              <Link
                href={`/mindmap/${m.id}`}
                className="hover:bg-accent block rounded-lg border p-4 transition-colors"
              >
                <p className="truncate font-medium">{m.title}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Updated {m.updatedAt.toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
