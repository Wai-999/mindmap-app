import { describe, it, expect } from "vitest";

import { exportToMarkdown } from "@/lib/export/to-markdown";
import { importFromMarkdown } from "@/lib/export/from-markdown";
import { getRootNode, getChildIds } from "@/lib/mindmap/tree-utils";
import type { MindmapContent, MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string, label: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

describe("exportToMarkdown", () => {
  it("produces one 2-space-indented bullet per node, depth-first", () => {
    const content: MindmapContent = {
      nodes: [makeNode("root", "Root"), makeNode("a", "Child A"), makeNode("a1", "Grandchild")],
      edges: [makeEdge("root", "a"), makeEdge("a", "a1")],
    };

    expect(exportToMarkdown(content)).toBe("- Root\n  - Child A\n    - Grandchild");
  });

  it("returns an empty string when there is no root", () => {
    expect(exportToMarkdown({ nodes: [], edges: [] })).toBe("");
  });
});

describe("importFromMarkdown", () => {
  it("parses a nested bullet list into a tree", () => {
    const content = importFromMarkdown("- Root\n  - Child A\n    - Grandchild\n  - Child B");
    const root = getRootNode(content.nodes, content.edges)!;
    expect(root.data.label).toBe("Root");

    const childIds = getChildIds(content.edges, root.id);
    expect(childIds).toHaveLength(2);

    const labels = childIds
      .map((id) => content.nodes.find((n) => n.id === id)?.data.label)
      .sort();
    expect(labels).toEqual(["Child A", "Child B"]);
  });

  it("clamps depth jumps of more than one level instead of orphaning the node", () => {
    const content = importFromMarkdown("- Root\n      - Grandchild");
    expect(content.nodes).toHaveLength(2);
    const root = getRootNode(content.nodes, content.edges)!;
    expect(getChildIds(content.edges, root.id)).toHaveLength(1);
  });

  it("throws a clear error when there are no bullet lines", () => {
    expect(() => importFromMarkdown("just plain text, no bullets")).toThrow();
  });

  it("round-trips: export then re-import reproduces the same labels and structure", () => {
    const original: MindmapContent = {
      nodes: [
        makeNode("root", "Trip planning"),
        makeNode("a", "Flights"),
        makeNode("b", "Hotels"),
        makeNode("a1", "Book by Friday"),
      ],
      edges: [makeEdge("root", "a"), makeEdge("root", "b"), makeEdge("a", "a1")],
    };

    const reimported = importFromMarkdown(exportToMarkdown(original));

    const originalLabels = original.nodes.map((n) => n.data.label).sort();
    const reimportedLabels = reimported.nodes.map((n) => n.data.label).sort();
    expect(reimportedLabels).toEqual(originalLabels);

    const newRoot = getRootNode(reimported.nodes, reimported.edges)!;
    expect(getChildIds(reimported.edges, newRoot.id)).toHaveLength(2);

    const flightsId = reimported.nodes.find((n) => n.data.label === "Flights")!.id;
    expect(getChildIds(reimported.edges, flightsId)).toHaveLength(1);
  });
});
