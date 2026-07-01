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
});
