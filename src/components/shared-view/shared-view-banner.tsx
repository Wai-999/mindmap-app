import Link from "next/link";
import { Brain, Eye, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SharePermission } from "@/types/share";

export function SharedViewBanner({
  title,
  permission,
}: {
  title: string;
  permission: SharePermission;
}) {
  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-between border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" className="shrink-0">
          <Brain className="text-primary size-5" />
        </Link>
        <span className="truncate text-sm font-medium">{title}</span>
      </div>
      <Badge variant={permission === "EDIT" ? "default" : "secondary"} className="gap-1 shrink-0">
        {permission === "EDIT" ? <Pencil className="size-3" /> : <Eye className="size-3" />}
        {permission === "EDIT" ? "Can edit" : "View only"}
      </Badge>
    </header>
  );
}
