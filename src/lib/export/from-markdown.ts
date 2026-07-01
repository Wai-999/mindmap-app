import { generateNodeId, generateEdgeId } from "@/lib/mindmap/id";
import { resolveNewNodeColor } from "@/lib/mindmap/color";
import { NODE_COLORS } from "@/lib/mindmap/defaults";
import { computeTreeLayout } from "@/lib/mindmap/layout-tree";
import type { MindmapContent, MindmapNode, MindmapEdge } from "@/types/mindmap";

interface ParsedLine {
  depth: number;
  label: string;
}

function parseLines(markdown: string): ParsedLine[] {
  const parsed: ParsedLine[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const match = rawLine.match(/^(\s*)[-*]\s+(.*)$/);
    if (!match) continue;

    const [, indent, label] = match;
    const normalizedIndent = indent.replace(/\t/g, "  ");
    const depth = Math.floor(normalizedIndent.length / 2);
    parsed.push({ depth, label: label.trim() });
  }

  return parsed;
}

// Indentation-normalized: the first line is always the root regardless of its actual
// indent, and every later line is clamped to at most one level deeper than the line
// before it — this tolerates inconsistent or partial indentation (common when a list
// is hand-edited) without ever producing more than one root or an orphaned subtree.
// Imported content has no meaningful positions, so a tree layout runs immediately.
export function importFromMarkdown(markdown: string): MindmapContent {
  const lines = parseLines(markdown);
  if (lines.length === 0) {
    throw new Error('No list items found. Use "- " bullets, one per idea.');
  }

  const nodes: MindmapNode[] = [];
  const edges: MindmapEdge[] = [];
  const stack: string[] = []; // most recent node id seen at each depth

  let previousDepth = 0;
  lines.forEach((line, index) => {
    const depth = index === 0 ? 0 : Math.min(line.depth, previousDepth + 1);
    previousDepth = depth;

    const id = generateNodeId();
    const parentId = depth === 0 ? null : stack[depth - 1];
    const color = parentId ? resolveNewNodeColor(nodes, edges, parentId) : NODE_COLORS[0];

    nodes.push({
      id,
      type: "mindmapNode",
      position: { x: 0, y: 0 }, // overwritten by the layout pass below
      data: { label: line.label || "Untitled", color },
    });

    if (parentId) {
      edges.push({
        id: generateEdgeId(parentId, id),
        type: "mindmapEdge",
        source: parentId,
        target: id,
      });
    }

    stack[depth] = id;
    stack.length = depth + 1;
  });

  const positions = computeTreeLayout(nodes, edges, "LR");
  const laidOutNodes = nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position }));

  return { nodes: laidOutNodes, edges };
}
