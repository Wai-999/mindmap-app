"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReactFlowProvider } from "@xyflow/react";

import { useEditorStore } from "@/store/editor-store";
import { initAutosave } from "@/store/autosave";
import { useKeyboardShortcuts } from "@/components/editor/keyboard/use-keyboard-shortcuts";
import { MindmapCanvas } from "@/components/editor/mindmap-canvas";
import { FloatingToolbar } from "@/components/editor/toolbar/floating-toolbar";
import { NodeInspectorPanel } from "@/components/editor/inspector/node-inspector-panel";
import { SharedViewBanner } from "@/components/shared-view/shared-view-banner";
import { LiveblocksRoomProvider } from "@/components/editor/collab/liveblocks-room-provider";
import { mindmapRoomId } from "@/lib/liveblocks/room-id";
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
  liveblocksEnabled: boolean;
}

export function SharedMindmapViewer({
  token,
  permission,
  mindmap,
  liveblocksEnabled,
}: SharedMindmapViewerProps) {
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

  // A logged-out visitor has no account name — a stable-per-tab guest label is
  // enough for presence avatars/rings to be distinguishable from each other.
  const [guestName] = useState(() => `Guest ${Math.floor(100 + Math.random() * 900)}`);

  const body = (
    <div className="flex h-svh flex-col">
      <SharedViewBanner title={mindmap.title} permission={permission} endpoint={endpoint} />
      <ReactFlowProvider>
        <div className="relative flex-1">
          <MindmapCanvas />
          {isEditable && <FloatingToolbar endpoint={endpoint} />}
          <NodeInspectorPanel endpoint={endpoint} />
        </div>
      </ReactFlowProvider>
    </div>
  );

  if (!liveblocksEnabled) return body;

  return (
    <LiveblocksRoomProvider
      roomId={mindmapRoomId(mindmap.id)}
      userName={guestName}
      shareToken={token}
      canWrite={isEditable}
    >
      {body}
    </LiveblocksRoomProvider>
  );
}
