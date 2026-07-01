"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ReactFlowProvider } from "@xyflow/react";

import { useEditorStore } from "@/store/editor-store";
import { initAutosave } from "@/store/autosave";
import { useKeyboardShortcuts } from "@/components/editor/keyboard/use-keyboard-shortcuts";
import { MindmapCanvas } from "@/components/editor/mindmap-canvas";
import { FloatingToolbar } from "@/components/editor/toolbar/floating-toolbar";
import { SharedViewBanner } from "@/components/shared-view/shared-view-banner";
import type { MindmapContent } from "@/types/mindmap";
import type { SharePermission } from "@/types/share";

interface SharedMindmapViewerProps {
  token: string;
  permission: SharePermission;
  mindmap: {
    id: string;
    title: string;
    content: MindmapContent;
    updatedAt: string;
  };
}

export function SharedMindmapViewer({ token, permission, mindmap }: SharedMindmapViewerProps) {
  const loadMindmap = useEditorStore((s) => s.loadMindmap);
  const isEditable = permission === "EDIT";
  const endpoint = `/api/shared/${token}`;

  useEffect(() => {
    loadMindmap({
      id: mindmap.id,
      title: mindmap.title,
      nodes: mindmap.content.nodes,
      edges: mindmap.content.edges,
      updatedAt: mindmap.updatedAt,
      readOnly: !isEditable,
    });
    // Intentionally scoped to mindmap.id only — see mindmap-editor-shell.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindmap.id]);

  useEffect(() => {
    if (!isEditable) return;
    return initAutosave(endpoint);
  }, [isEditable, endpoint]);

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

  useKeyboardShortcuts(endpoint);

  return (
    <div className="flex h-svh flex-col">
      <SharedViewBanner title={mindmap.title} permission={permission} />
      <ReactFlowProvider>
        <div className="relative flex-1">
          <MindmapCanvas />
          {isEditable && <FloatingToolbar />}
        </div>
      </ReactFlowProvider>
    </div>
  );
}
