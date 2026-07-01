import { customAlphabet } from "nanoid";

// Lowercase alphanumeric only: these ids end up as React Flow DOM ids and (for nodes,
// potentially) URL-adjacent strings, so keep them boring on purpose.
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export function generateNodeId(): string {
  return `n_${nanoid()}`;
}

export function generateEdgeId(sourceId: string, targetId: string): string {
  return `e_${sourceId}_${targetId}`;
}
