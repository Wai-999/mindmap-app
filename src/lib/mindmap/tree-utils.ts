import type { MindmapEdge, MindmapNode } from "@/types/mindmap";

// The hierarchy (parent→child) is a strict forest: every node has at most one
// incoming hierarchy edge. A mindmap can *also* hold free-form "link" edges — cosmetic
// relationship lines a user drew between any two nodes — which must never be mistaken
// for structure, so every helper below filters them out before deriving parent/child.
export function isHierarchyEdge(edge: MindmapEdge): boolean {
  return edge.data?.kind !== "link";
}

export function getParentId(edges: MindmapEdge[], nodeId: string): string | null {
  const edge = edges.find((e) => isHierarchyEdge(e) && e.target === nodeId);
  return edge ? edge.source : null;
}

export function getChildIds(edges: MindmapEdge[], nodeId: string): string[] {
  return edges.filter((e) => isHierarchyEdge(e) && e.source === nodeId).map((e) => e.target);
}

export function getDescendantIds(edges: MindmapEdge[], nodeId: string): string[] {
  const result: string[] = [];
  const stack = getChildIds(edges, nodeId);

  while (stack.length > 0) {
    const id = stack.pop()!;
    result.push(id);
    stack.push(...getChildIds(edges, id));
  }

  return result;
}

// The subtree rooted at nodeId, including nodeId itself.
export function getSubtreeIds(edges: MindmapEdge[], nodeId: string): string[] {
  return [nodeId, ...getDescendantIds(edges, nodeId)];
}

export function getRootNode(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
): MindmapNode | null {
  return nodes.find((n) => !edges.some((e) => isHierarchyEdge(e) && e.target === n.id)) ?? null;
}

// A mindmap can hold several independent primary ideas — a forest of trees, not a
// single tree. This returns all of them (parentless nodes), in `nodes` array order. A
// node linked to (but not hierarchically parented by) another node is still a root.
export function getRootNodes(nodes: MindmapNode[], edges: MindmapEdge[]): MindmapNode[] {
  return nodes.filter((n) => !edges.some((e) => isHierarchyEdge(e) && e.target === n.id));
}

export function isRootNode(edges: MindmapEdge[], nodeId: string): boolean {
  return !edges.some((e) => isHierarchyEdge(e) && e.target === nodeId);
}

export function getDepth(edges: MindmapEdge[], nodeId: string): number {
  let depth = 0;
  let currentId: string | null = nodeId;

  while (currentId) {
    const parentId: string | null = getParentId(edges, currentId);
    if (!parentId) break;
    depth += 1;
    currentId = parentId;
  }

  return depth;
}

// Nodes whose id is not in `hiddenIds` (used to cull collapsed subtrees before handing
// arrays to <ReactFlow>) plus the edges that connect only surviving nodes.
export function filterVisible(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  hiddenIds: ReadonlySet<string>,
): { nodes: MindmapNode[]; edges: MindmapEdge[] } {
  if (hiddenIds.size === 0) return { nodes, edges };

  const visibleNodes = nodes.filter((n) => !hiddenIds.has(n.id));
  const visibleEdges = edges.filter(
    (e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target),
  );
  return { nodes: visibleNodes, edges: visibleEdges };
}

// All descendant ids of collapsed nodes — i.e. everything filterVisible should hide.
export function getHiddenIds(nodes: MindmapNode[], edges: MindmapEdge[]): Set<string> {
  const hidden = new Set<string>();
  for (const node of nodes) {
    if (node.data.collapsed) {
      for (const id of getDescendantIds(edges, node.id)) hidden.add(id);
    }
  }
  return hidden;
}
