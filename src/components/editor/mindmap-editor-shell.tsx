"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useEditorStore } from "@/store/editor-store";
import { initAutosave } from "@/store/autosave";
import { EditorHeader } from "@/components/editor/editor-header";
import { MindmapCanvas } from "@/components/editor/mindmap-canvas";
import { FloatingToolbar } from "@/components/editor/toolbar/floating-toolbar";
import type { MindmapContent } from "@/types/mindmap";

interface MindmapEditorShellProps {
  mindmap: {
    id: string;
    title: string;
    content: MindmapContent;
    updatedAt: string;
  };
}

export function MindmapEditorShell({ mindmap }: MindmapEditorShellProps) {
  const loadMindmap = useEditorStore((s) => s.loadMindmap);

  useEffect(() => {
    loadMindmap({
      id: mindmap.id,
      title: mindmap.title,
      nodes: mindmap.content.nodes,
      edges: mindmap.content.edges,
      updatedAt: mindmap.updatedAt,
    });
    // Intentionally scoped to mindmap.id only — this should reset the canvas when
    // navigating to a different mindmap, not on every incidental prop re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindmap.id]);

  useEffect(() => {
    return initAutosave(mindmap.id);
  }, [mindmap.id]);

  useEffect(() => {
    function handleConflict() {
      toast.error("This mindmap changed elsewhere", {
        description: "Reload to see the latest version before continuing.",
        action: { label: "Reload", onClick: () => window.location.reload() },
        duration: Infinity,
      });
    }
    window.addEventListener("mindmap:conflict", handleConflict);
    return () => window.removeEventListener("mindmap:conflict", handleConflict);
  }, []);

  return (
    <div className="flex h-svh flex-col">
      <EditorHeader />
      <div className="relative flex-1">
        <MindmapCanvas />
        <FloatingToolbar />
      </div>
    </div>
  );
}
