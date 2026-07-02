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
