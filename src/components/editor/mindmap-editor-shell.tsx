"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReactFlowProvider } from "@xyflow/react";

import { useEditorStore } from "@/store/editor-store";
import { initAutosave } from "@/store/autosave";
import { useKeyboardShortcuts } from "@/components/editor/keyboard/use-keyboard-shortcuts";
import { EditorHeader } from "@/components/editor/editor-header";
import { MindmapCanvas } from "@/components/editor/mindmap-canvas";
import { FloatingToolbar } from "@/components/editor/toolbar/floating-toolbar";
import { NodeInspectorPanel } from "@/components/editor/inspector/node-inspector-panel";
import { OutlineView } from "@/components/editor/outline/outline-view";
import { LiveblocksRoomProvider } from "@/components/editor/collab/liveblocks-room-provider";
import { mindmapRoomId } from "@/lib/liveblocks/room-id";
import type { MindmapContent } from "@/types/mindmap";

interface MindmapEditorShellProps {
  mindmap: {
    id: string;
    title: string;
    content: MindmapContent;
    updatedAt: string;
  };
  liveblocksEnabled: boolean;
  userName: string;
}

export function MindmapEditorShell({
  mindmap,
  liveblocksEnabled,
  userName,
}: MindmapEditorShellProps) {
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
    return initAutosave(`/api/mindmaps/${mindmap.id}`);
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

  useKeyboardShortcuts(`/api/mindmaps/${mindmap.id}`);

  // Local, not store state — nothing outside this shell needs to know which view is
  // showing. ReactFlowProvider stays mounted either way so canvas viewport/zoom state
  // survives toggling back and forth.
  const [viewMode, setViewMode] = useState<"canvas" | "outline">("canvas");

  const body = (
    <div className="flex h-svh flex-col">
      <EditorHeader
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((v) => (v === "canvas" ? "outline" : "canvas"))}
      />
      <ReactFlowProvider>
        <div className="relative flex-1">
          {viewMode === "canvas" ? (
            <>
              <MindmapCanvas />
              <FloatingToolbar endpoint={`/api/mindmaps/${mindmap.id}`} />
              <NodeInspectorPanel endpoint={`/api/mindmaps/${mindmap.id}`} />
            </>
          ) : (
            <OutlineView />
          )}
        </div>
      </ReactFlowProvider>
    </div>
  );

  if (!liveblocksEnabled) return body;

  return (
    <LiveblocksRoomProvider roomId={mindmapRoomId(mindmap.id)} userName={userName}>
      {body}
    </LiveblocksRoomProvider>
  );
}
