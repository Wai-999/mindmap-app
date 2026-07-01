import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getOwnedMindmap } from "@/lib/permissions";
import { decodeContent } from "@/lib/mindmap/content-codec";
import { MindmapEditorShell } from "@/components/editor/mindmap-editor-shell";

interface MindmapPageProps {
  params: Promise<{ id: string }>;
}

export default async function MindmapPage({ params }: MindmapPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) notFound();

  return (
    <MindmapEditorShell
      mindmap={{
        id: mindmap.id,
        title: mindmap.title,
        content: decodeContent(mindmap.content),
        updatedAt: mindmap.updatedAt.toISOString(),
      }}
    />
  );
}
