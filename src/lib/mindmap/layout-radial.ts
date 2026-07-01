import { tree as d3Tree, stratify } from "d3-hierarchy";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getParentId, getRootNode } from "@/lib/mindmap/tree-utils";
import type { NodePositions } from "@/lib/mindmap/layout-tree";

const RADIUS_STEP = 220; // distance between successive rings (one per depth level)

interface FlatNode {
  id: string;
  parentId: string | null;
}

// Same Reingold–Tilford layout as layout-tree.ts, reinterpreted in polar coordinates:
// angle comes from d3's breadth axis (x), radius comes from depth (not d3's y, which
// is normalized 0..1 across the tree's max depth — using node.depth directly instead
// gives consistent per-level ring spacing regardless of how deep the tree gets).
export function computeRadialLayout(nodes: MindmapNode[], edges: MindmapEdge[]): NodePositions {
  const root = getRootNode(nodes, edges);
  if (!root || nodes.length === 0) return {};

  const flat: FlatNode[] = nodes.map((n) => ({ id: n.id, parentId: getParentId(edges, n.id) }));
  const stratified = stratify<FlatNode>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(flat);

  const layout = d3Tree<FlatNode>()
    .size([2 * Math.PI, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
  const laidOut = layout(stratified);

  const positions: NodePositions = {};
  laidOut.each((node) => {
    const angle = node.x - Math.PI / 2; // rotate so the first child starts at the top
    const radius = node.depth * RADIUS_STEP;
    positions[node.data.id] = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });

  return positions;
}
