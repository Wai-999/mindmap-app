import type { MindmapContent } from "@/types/mindmap";
import { getRootNode, getChildIds } from "@/lib/mindmap/tree-utils";

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]])/g, "\\$1");
}

// Depth-first traversal from the root, one 2-space-indented bullet per node. The
// natural inverse of from-markdown.ts's parser.
export function exportToMarkdown(content: MindmapContent): string {
  const { nodes, edges } = content;
  const root = getRootNode(nodes, edges);
  if (!root) return "";

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

  walk(root.id, 0);
  return lines.join("\n");
}
