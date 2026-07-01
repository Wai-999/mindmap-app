import { tree as d3Tree, stratify } from "d3-hierarchy";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getParentId, getRootNodes, getSubtreeIds } from "@/lib/mindmap/tree-utils";

export type LayoutDirection = "LR" | "TB";
export type NodePositions = Record<string, { x: number; y: number }>;

const DEPTH_SPACING = 260; // distance between generations
const SIBLING_SPACING = 90; // distance between siblings at the same depth
const FOREST_GAP = 120; // gap between unrelated primary ideas' trees, along the breadth axis

interface FlatNode {
  id: string;
  parentId: string | null;
}

// Lays out a single tree (one root + its descendants), returning both the final
// swapped-for-direction positions and the raw pre-swap breadth-axis (d3's x) range,
// which the forest-combination pass below needs to stack trees without overlap.
function layoutOneTree(
  subNodes: MindmapNode[],
  subEdges: MindmapEdge[],
  direction: LayoutDirection,
): { positions: NodePositions; breadthMin: number; breadthMax: number } {
  const flat: FlatNode[] = subNodes.map((n) => ({ id: n.id, parentId: getParentId(subEdges, n.id) }));
  const stratified = stratify<FlatNode>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(flat);

  const layout = d3Tree<FlatNode>().nodeSize([SIBLING_SPACING, DEPTH_SPACING]);
  const laidOut = layout(stratified);

  const positions: NodePositions = {};
  let breadthMin = 0;
  let breadthMax = 0;
  laidOut.each((node) => {
    breadthMin = Math.min(breadthMin, node.x);
    breadthMax = Math.max(breadthMax, node.x);
    // d3's x = breadth axis, y = depth axis; swap them for a left-to-right tree.
    positions[node.data.id] =
      direction === "LR" ? { x: node.y, y: node.x } : { x: node.x, y: node.y };
  });

  return { positions, breadthMin, breadthMax };
}

// Reingold–Tilford tree layout (d3-hierarchy). Mindmaps are a forest of strict trees
// (multiple independent primary ideas are allowed), so each root's subtree is laid out
// independently with the same single-tree primitive, then the trees are stacked along
// the breadth axis with a gap so unrelated primary ideas never overlap.
export function computeTreeLayout(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  direction: LayoutDirection = "LR",
): NodePositions {
  const roots = getRootNodes(nodes, edges);
  if (roots.length === 0) return {};

  const positions: NodePositions = {};
  let cursor = 0;

  for (const root of roots) {
    const ids = new Set(getSubtreeIds(edges, root.id));
    const subNodes = nodes.filter((n) => ids.has(n.id));
    const subEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));

    const { positions: subPositions, breadthMin, breadthMax } = layoutOneTree(
      subNodes,
      subEdges,
      direction,
    );

    // The breadth axis is `y` for LR (siblings spread vertically) and `x` for TB
    // (siblings spread horizontally) — offset only that axis so every tree's root
    // still starts at depth 0 on the other axis.
    for (const [id, pos] of Object.entries(subPositions)) {
      positions[id] =
        direction === "LR"
          ? { x: pos.x, y: pos.y - breadthMin + cursor }
          : { x: pos.x - breadthMin + cursor, y: pos.y };
    }

    cursor += breadthMax - breadthMin + FOREST_GAP;
  }

  return positions;
}
