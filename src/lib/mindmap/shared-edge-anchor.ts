import type { MindmapEdge, MindmapNode } from "@/types/mindmap";

interface Point {
  x: number;
  y: number;
}

type SideBucket = "left" | "right" | "top" | "bottom";

function sideBucket(dx: number, dy: number): SideBucket {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

// Which point a given edge's SOURCE side should aim at when computing its floating
// exit point (see floating-edge.ts) — normally just its own target's position, but
// when a node has several outgoing edges (any mix of hierarchy/link) leaving toward
// roughly the same side, they all aim at that group's shared centroid instead. That
// turns several children fanning out from slightly different, competing points on a
// small parent — crossing lines, the "spaghetti" look a multi-child node produces
// once each edge independently floats toward its own target's exact center — into one
// clean shared exit point that the bezier curve itself fans out from, same as a
// classic tree diagram. Returns null for a lone (ungrouped) edge — the caller falls
// back to its own target's real center, unaffected.
//
// Cached per edges-array identity (WeakMap), same pattern as focus.ts's
// getFocusedSubtree: recomputed once per edit, not once per edge per render.
const cache = new WeakMap<MindmapEdge[], Map<string, Point>>();

export function getSharedAnchorTarget(
  edges: MindmapEdge[],
  nodes: MindmapNode[],
  edgeId: string,
): Point | null {
  let byEdgeId = cache.get(edges);
  if (!byEdgeId) {
    byEdgeId = computeAll(edges, nodes);
    cache.set(edges, byEdgeId);
  }
  return byEdgeId.get(edgeId) ?? null;
}

function computeAll(edges: MindmapEdge[], nodes: MindmapNode[]): Map<string, Point> {
  const positionOf = new Map(nodes.map((n) => [n.id, n.position]));
  const groups = new Map<string, { edgeIds: string[]; sum: Point; count: number }>();

  for (const edge of edges) {
    const sourcePos = positionOf.get(edge.source);
    const targetPos = positionOf.get(edge.target);
    if (!sourcePos || !targetPos) continue;

    const key = `${edge.source}:${sideBucket(targetPos.x - sourcePos.x, targetPos.y - sourcePos.y)}`;
    const group = groups.get(key) ?? { edgeIds: [], sum: { x: 0, y: 0 }, count: 0 };
    group.edgeIds.push(edge.id);
    group.sum.x += targetPos.x;
    group.sum.y += targetPos.y;
    group.count += 1;
    groups.set(key, group);
  }

  const result = new Map<string, Point>();
  for (const group of groups.values()) {
    if (group.count <= 1) continue; // lone edge on that side: nothing to share
    const centroid = { x: group.sum.x / group.count, y: group.sum.y / group.count };
    for (const edgeId of group.edgeIds) result.set(edgeId, centroid);
  }
  return result;
}
