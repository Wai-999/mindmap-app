import { describe, it, expect } from "vitest";

import { getNodeBranchSide, pickChildSide, countChildrenOnSide } from "@/lib/mindmap/branch-side";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function node(id: string, x: number): MindmapNode {
  return { id, type: "mindmapNode", position: { x, y: 0 }, data: { label: id } };
}
function edge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

describe("getNodeBranchSide", () => {
  it("is 'right' when the node's x is greater than or equal to its parent's", () => {
    const nodes = [node("root", 0), node("a", 240)];
    const edges = [edge("root", "a")];
    expect(getNodeBranchSide(nodes, edges, "a")).toBe("right");
  });

  it("is 'left' when the node's x is less than its parent's", () => {
    const nodes = [node("root", 0), node("a", -240)];
    const edges = [edge("root", "a")];
    expect(getNodeBranchSide(nodes, edges, "a")).toBe("left");
  });

  it("defaults to 'right' for a node with no parent (a forest root)", () => {
    expect(getNodeBranchSide([node("root", 0)], [], "root")).toBe("right");
  });
});

describe("pickChildSide", () => {
  it("a childless root's first child goes right (preserves the original convention)", () => {
    const nodes = [node("root", 0)];
    expect(pickChildSide(nodes, [], "root")).toBe("right");
  });

  it("a root's second child alternates to the left", () => {
    const nodes = [node("root", 0), node("a", 240)];
    const edges = [edge("root", "a")];
    expect(pickChildSide(nodes, edges, "root")).toBe("left");
  });

  it("a root's third child goes back to the right (fewer children there)", () => {
    const nodes = [node("root", 0), node("a", 240), node("b", -240)];
    const edges = [edge("root", "a"), edge("root", "b")];
    expect(pickChildSide(nodes, edges, "root")).toBe("right");
  });

  it("a non-root parent's children all continue its own established side (no alternating)", () => {
    // root -> a (a is to the left of root)
    const nodes = [node("root", 0), node("a", -240)];
    const edges = [edge("root", "a")];
    // a's first AND second child should both continue left, unlike a root.
    expect(pickChildSide(nodes, edges, "a")).toBe("left");

    const nodesWithOneChild = [...nodes, node("a1", -480)];
    const edgesWithOneChild = [...edges, edge("a", "a1")];
    expect(pickChildSide(nodesWithOneChild, edgesWithOneChild, "a")).toBe("left");
  });

  it("a non-root parent that itself is on the right continues right for its children", () => {
    const nodes = [node("root", 0), node("a", 240)];
    const edges = [edge("root", "a")];
    expect(pickChildSide(nodes, edges, "a")).toBe("right");
  });
});

describe("countChildrenOnSide", () => {
  it("counts only children on the requested side, independent of the other side's count", () => {
    const nodes = [node("root", 0), node("a", 240), node("b", 240), node("c", -240)];
    const edges = [edge("root", "a"), edge("root", "b"), edge("root", "c")];
    expect(countChildrenOnSide(nodes, edges, "root", "right")).toBe(2);
    expect(countChildrenOnSide(nodes, edges, "root", "left")).toBe(1);
  });

  it("is 0 for a childless parent", () => {
    expect(countChildrenOnSide([node("root", 0)], [], "root", "right")).toBe(0);
  });
});
