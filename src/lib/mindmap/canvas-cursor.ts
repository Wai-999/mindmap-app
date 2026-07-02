// Last known cursor position over the canvas, in flow coordinates — written by
// MindmapCanvas's pane mouse-move handler, read by editor-store's addRootNode so a
// new primary idea appears where the user is pointing rather than at a computed
// corner. A plain module-level ref (same pattern as lib/liveblocks/collab-state.ts)
// because the store action that consumes it lives outside the React tree.
let lastCanvasPoint: { x: number; y: number } | null = null;

export function setLastCanvasPoint(point: { x: number; y: number }) {
  lastCanvasPoint = point;
}

export function getLastCanvasPoint(): { x: number; y: number } | null {
  return lastCanvasPoint;
}

// Cleared when the canvas unmounts (navigation away, outline view) so a stale point
// from a previous mindmap never places a node somewhere surprising.
export function clearLastCanvasPoint() {
  lastCanvasPoint = null;
}

// Screen-space (clientX/clientY — NOT flow coordinates) point of the double-click
// that started editing a node's label. Read once by mindmap-node.tsx to place the
// text cursor exactly where the user clicked via caretRangeFromPoint, instead of the
// browser's default caret placement for a freshly-focused contentEditable (which
// ignores where the triggering click actually landed). consumeEditClickPoint reads
// and clears it in one step, so a later keyboard-triggered edit (Enter on a selected
// node, with no click at all) falls back to default placement rather than reusing a
// stale position from an unrelated earlier click.
let editClickPoint: { x: number; y: number } | null = null;

export function setEditClickPoint(point: { x: number; y: number }) {
  editClickPoint = point;
}

export function consumeEditClickPoint(): { x: number; y: number } | null {
  const point = editClickPoint;
  editClickPoint = null;
  return point;
}
