import { describe, it, expect } from "vitest";

import { getSharedAnchorTarget } from "@/lib/mindmap/shared-edge-anchor";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function node(id: string, x: number, y: number): MindmapNode {
  return { id, type: "mindmapNode", position: { x, y }, data: { label: id } };
}
function edge(id: string, source: string, target: string): MindmapEdge {
  return { id, type: "mindmapEdge", source, target };
}

describe("getSharedAnchorTarget", () => {
  it("returns null for a lone child (nothing to share an exit point with)", () => {
    const nodes = [node("root", 0, 0), node("a", 240, 0)];
    const edges = [edge("e1", "root", "a")];
    expect(getSharedAnchorTarget(edges, nodes, "e1")).toBeNull();
  });

  it("gives every sibling on the same side the identical centroid to aim at", () => {
    // Three children all to the right of root, stacked vertically.
    const nodes = [
      node("root", 0, 0),
      node("a", 240, -80),
      node("b", 240, 0),
      node("c", 240, 80),
    ];
    const edges = [edge("e1", "root", "a"), edge("e2", "root", "b"), edge("e3", "root", "c")];

    const p1 = getSharedAnchorTarget(edges, nodes, "e1");
    const p2 = getSharedAnchorTarget(edges, nodes, "e2");
    const p3 = getSharedAnchorTarget(edges, nodes, "e3");

    expect(p1).not.toBeNull();
    expect(p1).toEqual(p2);
    expect(p2).toEqual(p3);
    // Centroid of (240,-80), (240,0), (240,80) is (240, 0).
    expect(p1).toEqual({ x: 240, y: 0 });
  });

  it("keeps left-side and right-side siblings in separate groups", () => {
    const nodes = [
      node("root", 0, 0),
      node("a", 240, -40), // right
      node("b", 240, 40), // right
      node("c", -240, 0), // left, alone
    ];
    const edges = [edge("e1", "root", "a"), edge("e2", "root", "b"), edge("e3", "root", "c")];

    expect(getSharedAnchorTarget(edges, nodes, "e1")).toEqual({ x: 240, y: 0 });
    expect(getSharedAnchorTarget(edges, nodes, "e2")).toEqual({ x: 240, y: 0 });
    // c is alone on the left — no group, falls back to its own target (null here).
    expect(getSharedAnchorTarget(edges, nodes, "e3")).toBeNull();
  });

  it("groups by the source node, not globally — unrelated parents don't mix", () => {
    const nodes = [
      node("root1", 0, 0),
      node("a", 240, -40),
      node("b", 240, 40),
      node("root2", 1000, 0),
      node("c", 1240, 0),
    ];
    const edges = [edge("e1", "root1", "a"), edge("e2", "root1", "b"), edge("e3", "root2", "c")];

    expect(getSharedAnchorTarget(edges, nodes, "e1")).toEqual({ x: 240, y: 0 });
    expect(getSharedAnchorTarget(edges, nodes, "e3")).toBeNull();
  });

  it("returns the same cached Map entry for repeated calls with the same edges array", () => {
    const nodes = [node("root", 0, 0), node("a", 240, -40), node("b", 240, 40)];
    const edges = [edge("e1", "root", "a"), edge("e2", "root", "b")];
    const first = getSharedAnchorTarget(edges, nodes, "e1");
    const second = getSharedAnchorTarget(edges, nodes, "e1");
    expect(first).toBe(second);
  });
});
