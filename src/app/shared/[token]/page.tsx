import { notFound } from "next/navigation";

import { resolveShareAccess } from "@/lib/permissions";
import { decodeContent } from "@/lib/mindmap/content-codec";
import { isLiveblocksConfigured } from "@/lib/liveblocks/config";
import { SharedMindmapViewer } from "@/components/shared-view/shared-mindmap-viewer";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedPage({ params }: SharedPageProps) {
  const { token } = await params;
  const result = await resolveShareAccess(token);

  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">This link has expired</h1>
        <p className="text-muted-foreground text-sm">Ask the owner to share a new link.</p>
      </div>
    );
  }

  return (
    <SharedMindmapViewer
      token={token}
      permission={result.permission}
      mindmap={{
        id: result.mindmap.id,
        title: result.mindmap.title,
        content: decodeContent(result.mindmap.content),
        updatedAt: result.mindmap.updatedAt.toISOString(),
      }}
      liveblocksEnabled={isLiveblocksConfigured()}
    />
  );
}
