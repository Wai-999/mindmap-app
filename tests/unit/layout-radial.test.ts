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

  describe("forest support (multiple independent primary ideas)", () => {
    // Two disconnected clusters: root -> a, b -> a1 (as above) and root2 -> c1.
    const forestNodes = [...nodes, makeNode("root2"), makeNode("c1")];
    const forestEdges = [...edges, makeEdge("root2", "c1")];

    function distFromOwnRoot(
      positions: Record<string, { x: number; y: number }>,
      id: string,
      rootId: string,
    ) {
      return Math.hypot(positions[id].x - positions[rootId].x, positions[id].y - positions[rootId].y);
    }

    it("lays out every node across all clusters", () => {
      const positions = computeRadialLayout(forestNodes, forestEdges);
      for (const node of forestNodes) {
        expect(positions[node.id]).toBeDefined();
      }
    });

    it("keeps each cluster's own root at the same radius from its own center as the solo case", () => {
      const soloPositions = computeRadialLayout(nodes, edges);
      const soloRadius = radiusOf(soloPositions, "a"); // distance from root, since root is at the origin

      const positions = computeRadialLayout(forestNodes, forestEdges);
      expect(distFromOwnRoot(positions, "a", "root")).toBeCloseTo(soloRadius, 5);
      expect(distFromOwnRoot(positions, "c1", "root2")).toBeCloseTo(soloRadius, 5);
    });

    it("keeps a cluster's internal relative layout unchanged from the single-cluster case", () => {
      const soloPositions = computeRadialLayout(nodes, edges);
      const forestPositions = computeRadialLayout(forestNodes, forestEdges);
      expect(distFromOwnRoot(forestPositions, "a1", "a")).toBeCloseTo(
        Math.hypot(soloPositions.a1.x - soloPositions.a.x, soloPositions.a1.y - soloPositions.a.y),
        5,
      );
    });

    it("separates two clusters' centers with no overlap", () => {
      const soloPositions = computeRadialLayout(nodes, edges);
      const soloRadius = radiusOf(soloPositions, "a");

      const positions = computeRadialLayout(forestNodes, forestEdges);
      const centerDistance = Math.hypot(
        positions.root2.x - positions.root.x,
        positions.root2.y - positions.root.y,
      );
      // Clusters must be far enough apart that their outer rings (radius soloRadius
      // here) don't visually touch.
      expect(centerDistance).toBeGreaterThan(2 * soloRadius);
    });
  });
});
