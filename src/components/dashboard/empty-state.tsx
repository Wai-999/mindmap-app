import { Brain } from "lucide-react";

import { CreateMindmapButton } from "@/components/dashboard/create-mindmap-button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-24 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <Brain className="text-muted-foreground size-7" />
      </div>
      <div>
        <p className="font-medium">No mindmaps yet</p>
        <p className="text-muted-foreground text-sm">Start mapping your first idea.</p>
      </div>
      <CreateMindmapButton />
    </div>
  );
}
