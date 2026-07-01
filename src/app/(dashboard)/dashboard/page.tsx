import { auth } from "@/lib/auth";

// Placeholder for Phase 1 verification — replaced with the full mindmap grid in Phase 4.
export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="text-muted-foreground mt-2">Your mindmaps will show up here.</p>
    </div>
  );
}
