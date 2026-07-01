import Link from "next/link";
import { Brain } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <Brain className="text-primary size-6" />
        Mindmap
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
