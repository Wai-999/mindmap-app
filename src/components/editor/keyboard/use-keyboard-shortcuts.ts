"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useEditorStore } from "@/store/editor-store";
import { forceSave } from "@/store/autosave";
import { deleteNodeWithUndo, removeLinkEdgeWithUndo } from "@/lib/mindmap/delete-with-undo";
import { getRootNodes, getHiddenIds, filterVisible } from "@/lib/mindmap/tree-utils";
import { getFocusedSubtree } from "@/lib/mindmap/focus";
import { findNodeInDirection, type NavDirection } from "@/lib/mindmap/spatial-nav";

const ARROW_DIRECTIONS: Record<string, NavDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

// endpoint is the full PATCH URL (owner route or a share-link route when editing
// through a share link) — forwarded to forceSave for Cmd+S.
export function useKeyboardShortcuts(endpoint: string) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const store = useEditorStore.getState();
      if (store.readOnly) return;

      const editing = isEditableTarget(e.target);
      const isMod = e.metaKey || e.ctrlKey;

      // Force-save works everywhere, even mid-edit — Cmd+S is reflexive muscle memory
      // and should feel meaningful even though autosave already covers the user.
      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void forceSave(endpoint);
        return;
      }

      // Undo/redo work everywhere except while actively typing a label, where native
      // contentEditable undo should take over instead.
      if (isMod && !editing && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (editing) return;

      // Escape steps back out: first exit focus mode, else clear the selection.
      if (e.key === "Escape") {
        if (store.focusedNodeId) {
          store.setFocusedNode(null);
          return;
        }
        if (store.selectedNodeIds.length > 0 || store.selectedEdgeId) {
          store.selectNode(null);
          return;
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && store.selectedEdgeId) {
        e.preventDefault();
        removeLinkEdgeWithUndo(store.selectedEdgeId);
        return;
      }

      // A marquee/Cmd-click selection of several nodes deletes as one undoable step.
      if ((e.key === "Delete" || e.key === "Backspace") && store.selectedNodeIds.length > 1) {
        e.preventDefault();
        const count = store.selectedNodeIds.length;
        store.deleteSelectedNodes();
        toast(`${count} ideas deleted`, {
          action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
        });
        return;
      }

      // Arrow-key node selection — the one thing that makes the canvas usable
      // without a mouse at all: every other shortcut below needs a selection to
      // act on, and until now the only way to get one was to click a node.
      // Direction is resolved geometrically (see spatial-nav.ts), not from the
      // tree structure, since a hierarchy edge can render to either side of its
      // parent and the canvas also supports top-down/radial layouts.
      if (e.key in ARROW_DIRECTIONS) {
        e.preventDefault();
        const direction = ARROW_DIRECTIONS[e.key];

        const hidden = getHiddenIds(store.nodes, store.edges);
        const { nodes: visible } = filterVisible(store.nodes, store.edges, hidden);
        const focusedSet = getFocusedSubtree(store.edges, store.focusedNodeId);
        const navigable = focusedSet ? visible.filter((n) => focusedSet.has(n.id)) : visible;

        if (!store.selectedNodeId) {
          // Cold start — nothing selected yet, so there's no origin point to
          // navigate from. A root reads as the natural place to begin.
          const first = getRootNodes(navigable, store.edges)[0] ?? navigable[0];
          if (first) store.selectNode(first.id);
          return;
        }

        const nextId = findNodeInDirection(navigable, store.selectedNodeId, direction);
        if (nextId) store.selectNode(nextId);
        return;
      }

      const selectedId = store.selectedNodeId;
      if (!selectedId) return;

      // F2 (the conventional rename key — Windows Explorer, and most desktop
      // mind-mapping tools) opens the selected node for editing. Deliberately a
      // separate key from Enter, which stays "add a sibling" — that's the app's
      // own marketed core loop ("Tab to branch, Enter for a new idea"), not
      // something an editing shortcut should quietly repurpose.
      if (e.key === "F2") {
        e.preventDefault();
        store.setEditingNode(selectedId);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        store.addChildNode(selectedId);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        // A root's "sibling" is a new primary idea (addSiblingNode falls through to
        // addRootNode for a parentless node), so this only returns null if selectedId
        // doesn't resolve to a real node at all — defensive fallback, not the normal path.
        const siblingId = store.addSiblingNode(selectedId);
        if (!siblingId) store.setEditingNode(selectedId);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteNodeWithUndo(selectedId);
        return;
      }

      if (isMod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        store.duplicateSubtree(selectedId);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [endpoint]);
}
