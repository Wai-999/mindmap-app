import { tree as d3Tree, stratify } from "d3-hierarchy";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getParentId, getRootNode } from "@/lib/mindmap/tree-utils";

export type LayoutDirection = "LR" | "TB";
export type NodePositions = Record<string, { x: number; y: number }>;

const DEPTH_SPACING = 260; // distance between generations
const SIBLING_SPACING = 90; // distance between siblings at the same depth

interface FlatNode {
  id: string;
  parentId: string | null;
}

// Reingold–Tilford tree layout (d3-hierarchy). Mindmaps are strict trees, so this
// (rather than a general-graph layout like dagre) is a natural fit and gives both
// this and the radial layout below "for free" from the same primitive.
export function computeTreeLayout(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  direction: LayoutDirection = "LR",
): NodePositions {
  const root = getRootNode(nodes, edges);
  if (!root || nodes.length === 0) return {};

  const flat: FlatNode[] = nodes.map((n) => ({ id: n.id, parentId: getParentId(edges, n.id) }));
  const stratified = stratify<FlatNode>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(flat);

  const layout = d3Tree<FlatNode>().nodeSize([SIBLING_SPACING, DEPTH_SPACING]);
  const laidOut = layout(stratified);

  const positions: NodePositions = {};
  laidOut.each((node) => {
    // d3's x = breadth axis, y = depth axis; swap them for a left-to-right tree.
    positions[node.data.id] =
      direction === "LR" ? { x: node.y, y: node.x } : { x: node.x, y: node.y };
  });

  return positions;
}
