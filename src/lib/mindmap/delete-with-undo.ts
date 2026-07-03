import { toast } from "sonner";

import { useEditorStore } from "@/store/editor-store";

// Shared by the keyboard shortcut and the toolbar button so both delete paths give
// the same "toast with Undo" affordance instead of a blocking confirm dialog — the
// action is already one keystroke away from being reverted, so a modal is friction
// without much safety benefit. Any node, including a primary idea (root), can be
// deleted — a mindmap can hold several independent roots, so removing one doesn't
// leave the canvas without an entry point, and even an empty canvas is a valid state
// (the toolbar's Insert menu is the recovery path).
export function deleteNodeWithUndo(nodeId: string) {
  const store = useEditorStore.getState();
  store.deleteNodeAndSubtree(nodeId);
  toast("Idea deleted", {
    action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
  });
}

// Same toast-with-Undo affordance for removing a free-form link edge.
export function removeLinkEdgeWithUndo(edgeId: string) {
  const store = useEditorStore.getState();
  store.removeLinkEdge(edgeId);
  toast("Connection removed", {
    action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
  });
}
