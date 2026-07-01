import { describe, it, expect } from "vitest";

import { computeTreeLayout } from "@/lib/mindmap/layout-tree";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: id } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

describe("computeTreeLayout", () => {
  const nodes = [makeNode("root"), makeNode("a"), makeNode("b"), makeNode("c")];
  const edges = [makeEdge("root", "a"), makeEdge("root", "b"), makeEdge("root", "c")];

  it("returns a position for every node", () => {
    const positions = computeTreeLayout(nodes, edges, "LR");
    for (const node of nodes) {
      expect(positions[node.id]).toBeDefined();
    }
  });

  it("places children at a greater x than the root in LR mode", () => {
    const positions = computeTreeLayout(nodes, edges, "LR");
    for (const childId of ["a", "b", "c"]) {
      expect(positions[childId].x).toBeGreaterThan(positions.root.x);
    }
  });

  it("places children at a greater y than the root in TB mode", () => {
    const positions = computeTreeLayout(nodes, edges, "TB");
    for (const childId of ["a", "b", "c"]) {
      expect(positions[childId].y).toBeGreaterThan(positions.root.y);
    }
  });

  it("gives siblings distinct positions along the breadth axis (no overlap)", () => {
    const positions = computeTreeLayout(nodes, edges, "LR");
    const siblingYs = ["a", "b", "c"].map((id) => positions[id].y);
    expect(new Set(siblingYs).size).toBe(3);
  });

  it("returns an empty object for an empty tree", () => {
    expect(computeTreeLayout([], [])).toEqual({});
  });

  describe("forest support (multiple independent primary ideas)", () => {
    // Two disconnected trees: root -> a, b, c (as above) and root2 -> d.
    const forestNodes = [...nodes, makeNode("root2"), makeNode("d")];
    const forestEdges = [...edges, makeEdge("root2", "d")];

    it("lays out every node across all trees", () => {
      const positions = computeTreeLayout(forestNodes, forestEdges, "LR");
      for (const node of forestNodes) {
        expect(positions[node.id]).toBeDefined();
      }
    });

    it("keeps each tree's own internal relative layout unchanged from the single-tree case", () => {
      const soloPositions = computeTreeLayout(nodes, edges, "LR");
      const forestPositions = computeTreeLayout(forestNodes, forestEdges, "LR");
      // The first tree's depth-axis (x) positions are identical regardless of a second,
      // unrelated tree being present — only the breadth axis (y) may shift to make room.
      for (const id of ["root", "a", "b", "c"]) {
        expect(forestPositions[id].x).toBeCloseTo(soloPositions[id].x);
      }
    });

    it("separates unrelated trees along the breadth axis with no overlap", () => {
      const positions = computeTreeLayout(forestNodes, forestEdges, "LR");
      const firstTreeYs = ["root", "a", "b", "c"].map((id) => positions[id].y);
      const secondTreeYs = ["root2", "d"].map((id) => positions[id].y);
      expect(Math.min(...secondTreeYs)).toBeGreaterThan(Math.max(...firstTreeYs));
    });

    it("a free-form link edge crossing between two trees does not merge them into one", () => {
      const linkedEdges: MindmapEdge[] = [
        ...forestEdges,
        { id: "e_a_d_link", type: "mindmapEdge", source: "a", target: "d", data: { kind: "link" } },
      ];
      const positions = computeTreeLayout(forestNodes, linkedEdges, "LR");
      const firstTreeYs = ["root", "a", "b", "c"].map((id) => positions[id].y);
      const secondTreeYs = ["root2", "d"].map((id) => positions[id].y);
      // Still two separate trees stacked with a gap, exactly as without the link edge.
      expect(Math.min(...secondTreeYs)).toBeGreaterThan(Math.max(...firstTreeYs));
      expect(positions.root2.x).toBeCloseTo(positions.root.x);
    });
  });
});
