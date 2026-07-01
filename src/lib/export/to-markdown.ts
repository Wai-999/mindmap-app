import type { MindmapContent } from "@/types/mindmap";
import { getRootNodes, getChildIds } from "@/lib/mindmap/tree-utils";

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]])/g, "\\$1");
}

// Depth-first traversal from each root, one 2-space-indented bullet per node. A
// mindmap can hold several independent primary ideas — each root's tree is walked in
// turn, and every root starts fresh at depth 0, so multiple depth-0 bullets in the
// output are exactly how from-markdown.ts's parser expects to see multiple roots.
export function exportToMarkdown(content: MindmapContent): string {
  const { nodes, edges } = content;
  const roots = getRootNodes(nodes, edges);
  if (roots.length === 0) return "";

  const lines: string[] = [];

  function walk(nodeId: string, depth: number) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const label = escapeMarkdown(node.data.label || "Untitled");
    lines.push(`${"  ".repeat(depth)}- ${label}`);

    for (const childId of getChildIds(edges, nodeId)) {
      walk(childId, depth + 1);
    }
  }

  for (const root of roots) walk(root.id, 0);
  return lines.join("\n");
}
