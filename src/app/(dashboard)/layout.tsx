import { redirect } from "next/navigation";
import Link from "next/link";
import { Brain } from "lucide-react";

import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Brain className="text-primary size-5" />
            Mindmap
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={{ name: session.user.name, email: session.user.email }} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
