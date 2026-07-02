import type { MindmapEdge, MindmapNode } from "@/types/mindmap";
import { getParentId, getChildIds } from "@/lib/mindmap/tree-utils";

export type BranchSide = "left" | "right";

// Which side of ITS OWN parent a node currently sits on — the single source of truth
// for "which direction is this branch growing," derived from position rather than
// stored separately, so manually dragging a node to the other side of its parent just
// works without any explicit "flip side" action. Nodes with no parent (forest roots)
// have no side of their own; callers only ask this for a node that already has one.
export function getNodeBranchSide(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  nodeId: string,
): BranchSide {
  const parentId = getParentId(edges, nodeId);
  const parent = parentId ? nodes.find((n) => n.id === parentId) : null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!parent || !node) return "right";
  return node.position.x < parent.position.x ? "left" : "right";
}

// Which side a NEW child of parentId should be placed on. A root's direct children
// alternate left/right (first child keeps the existing rightward convention); a
// non-root parent's children all continue the same direction its own branch already
// established, so a subtree that started left keeps growing left rather than
// alternating internally.
export function pickChildSide(nodes: MindmapNode[], edges: MindmapEdge[], parentId: string): BranchSide {
  const grandparentId = getParentId(edges, parentId);
  if (grandparentId) return getNodeBranchSide(nodes, edges, parentId);

  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return "right";
  const rightCount = getChildIds(edges, parentId).filter(
    (id) => (nodes.find((n) => n.id === id)?.position.x ?? Infinity) >= parent.position.x,
  ).length;
  const leftCount = getChildIds(edges, parentId).length - rightCount;
  return rightCount <= leftCount ? "right" : "left";
}

// How many of parentId's existing children already sit on the given side — used to
// stack a new same-side sibling below the others without overlapping, independent of
// however many are stacked on the opposite side.
export function countChildrenOnSide(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  parentId: string,
  side: BranchSide,
): number {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return 0;
  return getChildIds(edges, parentId).filter((id) => {
    const child = nodes.find((n) => n.id === id);
    if (!child) return false;
    const childSide: BranchSide = child.position.x < parent.position.x ? "left" : "right";
    return childSide === side;
  }).length;
}
