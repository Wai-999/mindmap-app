// Namespaced rather than a bare mindmap id, so the room-id format is future-proofed
// against ever needing other kinds of rooms.
export function mindmapRoomId(mindmapId: string): string {
  return `mindmap:${mindmapId}`;
}
