"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useEditorStore } from "@/store/editor-store";
import { getRootNodes, getChildIds } from "@/lib/mindmap/tree-utils";
import { cn } from "@/lib/utils";

function OutlineRow({ nodeId, depth }: { nodeId: string; depth: number }) {
  const storedLabel = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.label ?? "");
  const collapsed = useEditorStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.collapsed ?? false);
  // getChildIds returns a new array every call — useShallow avoids React's
  // useSyncExternalStore "getSnapshot should be cached" infinite-loop guard tripping
  // on a selector that never reference-equals its previous result.
  const childIds = useEditorStore(useShallow((s) => getChildIds(s.edges, nodeId)));
  const selected = useEditorStore((s) => s.selectedNodeId === nodeId);
  const readOnly = useEditorStore((s) => s.readOnly);
  const selectNode = useEditorStore((s) => s.selectNode);
  const updateNodeLabel = useEditorStore((s) => s.updateNodeLabel);
  const toggleCollapsed = useEditorStore((s) => s.toggleCollapsed);

  // Reflects the live store value whenever this row isn't focused (so undo/remote
  // collaborator edits always show up immediately) and only diverges locally while
  // the user is actively typing, committing once on blur — same shape as the canvas
  // node's contentEditable, just without the DOM-focus complexity that needs.
  const [draft, setDraft] = useState(storedLabel);
  const [isFocused, setIsFocused] = useState(false);
  const displayValue = isFocused ? draft : storedLabel;

  return (
    <li>
      <div
        className={cn(
          "hover:bg-accent flex items-center gap-1.5 rounded-md py-1 pr-2",
          selected && "bg-accent",
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        onClick={() => selectNode(nodeId)}
      >
        {childIds.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed(nodeId);
            }}
            className="text-muted-foreground shrink-0"
            aria-label={collapsed ? "Expand branch" : "Collapse branch"}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")} />
          </button>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <input
          value={displayValue}
          disabled={readOnly}
          placeholder="Empty idea"
          onFocus={() => {
            setDraft(storedLabel);
            setIsFocused(true);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            if (draft !== storedLabel) updateNodeLabel(nodeId, draft);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {!collapsed && childIds.length > 0 && (
        <ul>
          {childIds.map((childId) => (
            <OutlineRow key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Alternate, list-based view of the same content the canvas renders — read + quick
// inline edit only, wired to editor-store's existing actions (no new store surface).
export function OutlineView() {
  const rootIds = useEditorStore(
    useShallow((s) => getRootNodes(s.nodes, s.edges).map((n) => n.id)),
  );

  if (rootIds.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No ideas yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <ul className="space-y-0.5">
        {rootIds.map((rootId) => (
          <OutlineRow key={rootId} nodeId={rootId} depth={0} />
        ))}
      </ul>
    </div>
  );
}
