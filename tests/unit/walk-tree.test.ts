import { describe, it, expect } from "vitest";

import { walkForestPreOrder } from "@/lib/mindmap/walk-tree";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: id } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

describe("walkForestPreOrder", () => {
  it("visits nothing for an empty forest", () => {
    const visited: string[] = [];
    walkForestPreOrder([], [], (n) => visited.push(n.id));
    expect(visited).toEqual([]);
  });

  it("visits a single tree in depth-first pre-order", () => {
    const nodes = [makeNode("root"), makeNode("a"), makeNode("a1"), makeNode("b")];
    const edges = [makeEdge("root", "a"), makeEdge("a", "a1"), makeEdge("root", "b")];

    const visited: Array<{ id: string; depth: number }> = [];
    walkForestPreOrder(nodes, edges, (n, depth) => visited.push({ id: n.id, depth }));

    expect(visited).toEqual([
      { id: "root", depth: 0 },
      { id: "a", depth: 1 },
      { id: "a1", depth: 2 },
      { id: "b", depth: 1 },
    ]);
  });

  it("visits every root's tree in turn, each starting fresh at depth 0", () => {
    const nodes = [makeNode("root1"), makeNode("c1"), makeNode("root2"), makeNode("c2")];
    const edges = [makeEdge("root1", "c1"), makeEdge("root2", "c2")];

    const visited: Array<{ id: string; depth: number }> = [];
    walkForestPreOrder(nodes, edges, (n, depth) => visited.push({ id: n.id, depth }));

    expect(visited).toEqual([
      { id: "root1", depth: 0 },
      { id: "c1", depth: 1 },
      { id: "root2", depth: 0 },
      { id: "c2", depth: 1 },
    ]);
  });
});
