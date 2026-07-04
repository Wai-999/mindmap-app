import type { MindmapNode } from "@/types/mindmap";
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from "@/lib/mindmap/defaults";

export type NavDirection = "up" | "down" | "left" | "right";

function nodeCenter(node: MindmapNode): { x: number; y: number } {
  const w = node.width ?? node.measured?.width ?? DEFAULT_NODE_WIDTH;
  const h = node.height ?? node.measured?.height ?? DEFAULT_NODE_HEIGHT;
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
}

// Arrow-key node navigation, based on each node's actual on-canvas position
// rather than the tree's parent/child structure — a hierarchy edge can render to
// either side of its parent (see branch-side.ts's left/right auto-placement) and
// the canvas also supports top-down and radial auto-layouts, so "right arrow
// always means child" isn't actually true in this app. Picking the geometrically
// closest node within a 45° cone of the pressed direction works regardless of
// which layout mode or manual dragging produced the current positions — the same
// approach spatial-navigation UIs (game console menus, CSS's draft spatial-nav)
// use for exactly this reason.
export function findNodeInDirection(
  nodes: MindmapNode[],
  fromId: string,
  direction: NavDirection,
): string | null {
  const from = nodes.find((n) => n.id === fromId);
  if (!from) return null;
  const origin = nodeCenter(from);

  const axisX = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const axisY = direction === "up" ? -1 : direction === "down" ? 1 : 0;

  let best: { id: string; score: number } | null = null;
  for (const node of nodes) {
    if (node.id === fromId) continue;
    const c = nodeCenter(node);
    const vx = c.x - origin.x;
    const vy = c.y - origin.y;

    // How far along the pressed direction this candidate is — must be positive
    // (strictly "in front of" the origin along that axis) to be a candidate at all.
    const along = vx * axisX + vy * axisY;
    if (along <= 0) continue;

    // How far the candidate strays off the direct line — rejecting anything
    // outside a 45° cone keeps e.g. a right-arrow press from jumping to a node
    // that's actually mostly above or below the current one.
    const perpendicular = axisX !== 0 ? Math.abs(vy) : Math.abs(vx);
    if (perpendicular > along) continue;

    const score = Math.hypot(vx, vy) + perpendicular;
    if (!best || score < best.score) best = { id: node.id, score };
  }
  return best?.id ?? null;
}
