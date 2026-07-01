import { describe, it, expect } from "vitest";

import {
  getParentId,
  getChildIds,
  getDescendantIds,
  getSubtreeIds,
  getRootNode,
  isRootNode,
  getDepth,
  filterVisible,
  getHiddenIds,
} from "@/lib/mindmap/tree-utils";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string, collapsed = false): MindmapNode {
  return {
    id,
    type: "mindmapNode",
    position: { x: 0, y: 0 },
    data: { label: id, collapsed },
  };
}

function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

// root
// ├── a
// │   ├── a1
// │   └── a2
// └── b
//     └── b1
const nodes: MindmapNode[] = [
  makeNode("root"),
  makeNode("a"),
  makeNode("b"),
  makeNode("a1"),
  makeNode("a2"),
  makeNode("b1"),
];

const edges: MindmapEdge[] = [
  makeEdge("root", "a"),
  makeEdge("root", "b"),
  makeEdge("a", "a1"),
  makeEdge("a", "a2"),
  makeEdge("b", "b1"),
];

describe("tree-utils", () => {
  it("getParentId finds the correct parent, and null for the root", () => {
    expect(getParentId(edges, "a1")).toBe("a");
    expect(getParentId(edges, "root")).toBeNull();
  });

  it("getChildIds returns direct children only", () => {
    expect(getChildIds(edges, "a").sort()).toEqual(["a1", "a2"]);
    expect(getChildIds(edges, "a1")).toEqual([]);
  });

  it("getDescendantIds returns all descendants, not just direct children", () => {
    expect(getDescendantIds(edges, "root").sort()).toEqual(["a", "a1", "a2", "b", "b1"]);
    expect(getDescendantIds(edges, "b")).toEqual(["b1"]);
  });

  it("getSubtreeIds includes the node itself", () => {
    expect(getSubtreeIds(edges, "a").sort()).toEqual(["a", "a1", "a2"]);
  });

  it("getRootNode finds the node with no incoming edge", () => {
    expect(getRootNode(nodes, edges)?.id).toBe("root");
    expect(getRootNode([], [])).toBeNull();
  });

  it("isRootNode is true only for the root", () => {
    expect(isRootNode(edges, "root")).toBe(true);
    expect(isRootNode(edges, "a")).toBe(false);
  });

  it("getDepth measures distance from the root", () => {
    expect(getDepth(edges, "root")).toBe(0);
    expect(getDepth(edges, "a")).toBe(1);
    expect(getDepth(edges, "a1")).toBe(2);
  });

  it("cascade-deleting a mid-tree subtree removes exactly that subtree, leaving siblings intact", () => {
    const idsToRemove = new Set(getSubtreeIds(edges, "a"));
    const remaining = nodes.filter((n) => !idsToRemove.has(n.id));
    expect(remaining.map((n) => n.id).sort()).toEqual(["b", "b1", "root"]);
  });

  describe("filterVisible / getHiddenIds", () => {
    it("hides nothing when no node is collapsed", () => {
      const hidden = getHiddenIds(nodes, edges);
      expect(hidden.size).toBe(0);

      const result = filterVisible(nodes, edges, hidden);
      expect(result.nodes).toHaveLength(6);
      expect(result.edges).toHaveLength(5);
    });

    it("culls the entire subtree of a collapsed node, and any edges touching it", () => {
      const collapsedNodes = nodes.map((n) => (n.id === "a" ? makeNode("a", true) : n));
      const hidden = getHiddenIds(collapsedNodes, edges);
      expect(hidden).toEqual(new Set(["a1", "a2"]));

      const result = filterVisible(collapsedNodes, edges, hidden);
      expect(result.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "b1", "root"]);
      expect(result.edges.some((e) => e.target === "a1" || e.target === "a2")).toBe(false);
      // Siblings outside the collapsed branch are unaffected.
      expect(result.nodes.some((n) => n.id === "b1")).toBe(true);
    });
  });
});
