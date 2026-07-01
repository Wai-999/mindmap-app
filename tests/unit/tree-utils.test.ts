import { describe, it, expect } from "vitest";

import {
  getParentId,
  getChildIds,
  getDescendantIds,
  getSubtreeIds,
  getRootNode,
  getRootNodes,
  isRootNode,
  getDepth,
  filterVisible,
  getHiddenIds,
  isHierarchyEdge,
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

function makeLinkEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}_link`, type: "mindmapEdge", source, target, data: { kind: "link" } };
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

  describe("getRootNodes (forest support)", () => {
    it("returns an empty array for an empty forest", () => {
      expect(getRootNodes([], [])).toEqual([]);
    });

    it("returns a single-element array matching getRootNode for a single-tree mindmap", () => {
      expect(getRootNodes(nodes, edges).map((n) => n.id)).toEqual(["root"]);
    });

    it("returns every parentless node when the mindmap has several independent primary ideas", () => {
      const forestNodes = [...nodes, makeNode("root2"), makeNode("c")];
      const forestEdges = [...edges, makeEdge("root2", "c")];

      const roots = getRootNodes(forestNodes, forestEdges);
      expect(roots.map((n) => n.id).sort()).toEqual(["root", "root2"]);
    });
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

  describe("free-form link edges never count as hierarchy", () => {
    it("isHierarchyEdge distinguishes kind", () => {
      expect(isHierarchyEdge(makeEdge("a", "b"))).toBe(true);
      expect(isHierarchyEdge(makeLinkEdge("a", "b"))).toBe(false);
    });

    it("getChildIds and getParentId ignore a link edge between siblings", () => {
      const linkedEdges = [...edges, makeLinkEdge("a1", "a2")];
      expect(getChildIds(linkedEdges, "a1")).toEqual([]);
      expect(getParentId(linkedEdges, "a2")).toBe("a");
    });

    it("a link edge does not make a node's target count as a root", () => {
      const forestNodes = [...nodes, makeNode("root2"), makeNode("c")];
      const forestEdges = [...edges, makeEdge("root2", "c"), makeLinkEdge("a1", "root2")];

      // root2 is still a root even though a link edge targets it — only a *hierarchy*
      // edge targeting a node disqualifies it from being a forest root.
      const roots = getRootNodes(forestNodes, forestEdges);
      expect(roots.map((n) => n.id).sort()).toEqual(["root", "root2"]);
      expect(isRootNode(forestEdges, "root2")).toBe(true);
    });

    it("a link edge between two nodes in the same subtree does not widen the cascade-delete set", () => {
      const linkedEdges = [...edges, makeLinkEdge("a1", "b1")];
      expect(getSubtreeIds(linkedEdges, "a").sort()).toEqual(["a", "a1", "a2"]);
    });
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
