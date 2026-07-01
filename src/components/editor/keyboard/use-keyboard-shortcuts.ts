"use client";

import { useEffect } from "react";

import { useEditorStore } from "@/store/editor-store";
import { forceSave } from "@/store/autosave";
import { deleteNodeWithUndo } from "@/lib/mindmap/delete-with-undo";

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

      const selectedId = store.selectedNodeId;
      if (!selectedId) return;

      if (e.key === "Tab") {
        e.preventDefault();
        store.addChildNode(selectedId);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const siblingId = store.addSiblingNode(selectedId);
        if (!siblingId) store.setEditingNode(selectedId); // root has no sibling — edit it instead
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
