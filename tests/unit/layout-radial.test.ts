import { describe, it, expect } from "vitest";

import { computeRadialLayout } from "@/lib/mindmap/layout-radial";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: id } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

describe("computeRadialLayout", () => {
  const nodes = [makeNode("root"), makeNode("a"), makeNode("b"), makeNode("a1")];
  const edges = [makeEdge("root", "a"), makeEdge("root", "b"), makeEdge("a", "a1")];

  function radiusOf(positions: Record<string, { x: number; y: number }>, id: string) {
    return Math.hypot(positions[id].x, positions[id].y);
  }

  it("places the root at the origin", () => {
    const positions = computeRadialLayout(nodes, edges);
    expect(positions.root.x).toBeCloseTo(0);
    expect(positions.root.y).toBeCloseTo(0);
  });

  it("places same-depth nodes at the same radius from the origin", () => {
    const positions = computeRadialLayout(nodes, edges);
    expect(radiusOf(positions, "a")).toBeCloseTo(radiusOf(positions, "b"), 5);
  });

  it("places deeper nodes farther from the origin than their parent", () => {
    const positions = computeRadialLayout(nodes, edges);
    expect(radiusOf(positions, "a1")).toBeGreaterThan(radiusOf(positions, "a"));
  });

  it("returns an empty object for an empty tree", () => {
    expect(computeRadialLayout([], [])).toEqual({});
  });
});
