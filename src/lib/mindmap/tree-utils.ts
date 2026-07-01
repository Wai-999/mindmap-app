import type { MindmapEdge, MindmapNode } from "@/types/mindmap";

// A mindmap is a strict tree: every node has at most one incoming edge. These helpers
// all derive parent/child relationships from the edges array rather than storing them
// redundantly on nodes, so there is exactly one source of truth for structure.

export function getParentId(edges: MindmapEdge[], nodeId: string): string | null {
  const edge = edges.find((e) => e.target === nodeId);
  return edge ? edge.source : null;
}

export function getChildIds(edges: MindmapEdge[], nodeId: string): string[] {
  return edges.filter((e) => e.source === nodeId).map((e) => e.target);
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
  return nodes.find((n) => !edges.some((e) => e.target === n.id)) ?? null;
}

// A mindmap can hold several independent primary ideas — a forest of trees, not a
// single tree. This returns all of them (parentless nodes), in `nodes` array order.
export function getRootNodes(nodes: MindmapNode[], edges: MindmapEdge[]): MindmapNode[] {
  return nodes.filter((n) => !edges.some((e) => e.target === n.id));
}

export function isRootNode(edges: MindmapEdge[], nodeId: string): boolean {
  return !edges.some((e) => e.target === nodeId);
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
