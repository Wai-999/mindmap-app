import { tree as d3Tree, stratify } from "d3-hierarchy";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getParentId, getChildIds, getRootNodes, getSubtreeIds } from "@/lib/mindmap/tree-utils";
import { getNodeBranchSide } from "@/lib/mindmap/branch-side";

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

// LR only: lays out a root's right-side children and left-side children as two
// independent single-direction trees (layoutOneTree above), mirrors the left one, and
// recenters both on the root's own breadth position before combining — so Tidy Layout
// preserves whichever side each direct child is already on (from the smart
// auto-placement add-child gesture, or from manually dragging one across) instead of
// silently collapsing every child back onto the right, which used to undo that
// structure every time. Falls back to the plain single-direction layout when the root
// has no left children at all — the overwhelmingly common case, and one extra
// full layoutOneTree call isn't worth paying for when it wouldn't change anything.
function layoutOneTreeLR(
  rootId: string,
  subNodes: MindmapNode[],
  subEdges: MindmapEdge[],
): { positions: NodePositions; breadthMin: number; breadthMax: number } {
  const directChildIds = getChildIds(subEdges, rootId);
  const leftChildIds = directChildIds.filter(
    (id) => getNodeBranchSide(subNodes, subEdges, id) === "left",
  );
  if (leftChildIds.length === 0) return layoutOneTree(subNodes, subEdges, "LR");

  const rightChildIds = directChildIds.filter((id) => !leftChildIds.includes(id));
  const rightIds = new Set([rootId, ...rightChildIds.flatMap((id) => getSubtreeIds(subEdges, id))]);
  const leftIds = new Set([rootId, ...leftChildIds.flatMap((id) => getSubtreeIds(subEdges, id))]);

  const right = layoutOneTree(
    subNodes.filter((n) => rightIds.has(n.id)),
    subEdges.filter((e) => rightIds.has(e.source) && rightIds.has(e.target)),
    "LR",
  );
  const left = layoutOneTree(
    subNodes.filter((n) => leftIds.has(n.id)),
    subEdges.filter((e) => leftIds.has(e.source) && leftIds.has(e.target)),
    "LR",
  );

  const rootRightY = right.positions[rootId].y;
  const rootLeftY = left.positions[rootId].y;

  const positions: NodePositions = {};
  let breadthMin = Infinity;
  let breadthMax = -Infinity;

  for (const [id, pos] of Object.entries(right.positions)) {
    const y = pos.y - rootRightY; // recenter so the root sits at breadth 0
    positions[id] = { x: pos.x, y };
    breadthMin = Math.min(breadthMin, y);
    breadthMax = Math.max(breadthMax, y);
  }
  for (const [id, pos] of Object.entries(left.positions)) {
    if (id === rootId) continue; // already placed from the right pass above
    const y = pos.y - rootLeftY;
    positions[id] = { x: -pos.x, y }; // mirror the depth axis to flip to the left
    breadthMin = Math.min(breadthMin, y);
    breadthMax = Math.max(breadthMax, y);
  }

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

    const { positions: subPositions, breadthMin, breadthMax } =
      direction === "LR"
        ? layoutOneTreeLR(root.id, subNodes, subEdges)
        : layoutOneTree(subNodes, subEdges, direction);

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
