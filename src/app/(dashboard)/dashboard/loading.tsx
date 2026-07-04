import { Skeleton } from "@/components/ui/skeleton";

// Shown automatically by Next.js while page.tsx's data fetch (mindmaps + folders +
// tags) is in flight — previously the dashboard just flashed blank/white for that
// window. Mirrors the real page's layout (heading + card grid) so there's no
// layout shift once the actual content swaps in.
export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-64" />
      <div className="mt-6">
        <div className="flex gap-8">
          <div className="hidden w-48 shrink-0 space-y-2 md:block">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-9 w-32" />
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="overflow-hidden rounded-xl border">
                  <Skeleton className="aspect-4/3 rounded-none" />
                  <div className="space-y-1.5 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
