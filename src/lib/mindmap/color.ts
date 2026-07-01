import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getChildIds, getRootNodes, isRootNode } from "@/lib/mindmap/tree-utils";
import { NODE_COLORS } from "@/lib/mindmap/defaults";

// Shared by editor-store's addChildNode and the Markdown importer (which builds the
// same tree shape incrementally). Children of the root each start a new branch color;
// deeper descendants inherit their branch's color so a whole subtree reads as one
// color-coded limb.
export function resolveNewNodeColor(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  parentId: string,
): string {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return NODE_COLORS[0];

  if (isRootNode(edges, parentId)) {
    const siblingCount = getChildIds(edges, parentId).length;
    return NODE_COLORS[siblingCount % NODE_COLORS.length];
  }
  return parent.data.color ?? NODE_COLORS[0];
}

// A new primary idea (root) has no parent to inherit a color from — cycle through the
// palette by how many roots already exist, separate from resolveNewNodeColor's
// parent-keyed logic above (roots aren't siblings of anything).
export function resolveNewRootColor(nodes: MindmapNode[], edges: MindmapEdge[]): string {
  return NODE_COLORS[getRootNodes(nodes, edges).length % NODE_COLORS.length];
}
