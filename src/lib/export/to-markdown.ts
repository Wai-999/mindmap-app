import type { MindmapContent } from "@/types/mindmap";
import { walkForestPreOrder } from "@/lib/mindmap/walk-tree";

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]])/g, "\\$1");
}

// Depth-first traversal from each root, one 2-space-indented bullet per node. A
// mindmap can hold several independent primary ideas — each root's tree is walked in
// turn, and every root starts fresh at depth 0, so multiple depth-0 bullets in the
// output are exactly how from-markdown.ts's parser expects to see multiple roots.
export function exportToMarkdown(content: MindmapContent): string {
  const lines: string[] = [];
  walkForestPreOrder(content.nodes, content.edges, (node, depth) => {
    const label = escapeMarkdown(node.data.label || "Untitled");
    lines.push(`${"  ".repeat(depth)}- ${label}`);
  });
  return lines.join("\n");
}
