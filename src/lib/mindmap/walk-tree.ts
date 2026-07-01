import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getRootNodes, getChildIds } from "@/lib/mindmap/tree-utils";

// Depth-first pre-order traversal across every root's tree — a mindmap can hold
// several independent primary ideas, so this walks each one in turn, always starting
// fresh at depth 0. Shared by anything that needs the whole forest in a stable,
// predictable order (see to-markdown.ts, to-slides.ts).
export function walkForestPreOrder(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  visit: (node: MindmapNode, depth: number) => void,
): void {
  function walk(nodeId: string, depth: number) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    visit(node, depth);

    for (const childId of getChildIds(edges, nodeId)) {
      walk(childId, depth + 1);
    }
  }

  for (const root of getRootNodes(nodes, edges)) walk(root.id, 0);
}
