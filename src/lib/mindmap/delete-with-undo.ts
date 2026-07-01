import { toast } from "sonner";

import { useEditorStore } from "@/store/editor-store";
import { isRootNode } from "@/lib/mindmap/tree-utils";

// Shared by the keyboard shortcut and the toolbar button so both delete paths give
// the same "toast with Undo" affordance instead of a blocking confirm dialog — the
// action is already one keystroke away from being reverted, so a modal is friction
// without much safety benefit.
export function deleteNodeWithUndo(nodeId: string) {
  const store = useEditorStore.getState();
  if (isRootNode(store.edges, nodeId)) {
    toast.error("The root idea can't be deleted.");
    return;
  }

  store.deleteNodeAndSubtree(nodeId);
  toast("Idea deleted", {
    action: { label: "Undo", onClick: () => useEditorStore.getState().undo() },
  });
}
