import { describe, it, expect } from "vitest";

import { findNodeInDirection } from "@/lib/mindmap/spatial-nav";
import type { MindmapNode } from "@/types/mindmap";

function makeNode(id: string, x: number, y: number, width = 100, height = 40): MindmapNode {
  return { id, type: "mindmapNode", position: { x, y }, width, height, data: { label: id } };
}

describe("findNodeInDirection (arrow-key spatial navigation)", () => {
  it("finds the nearest node directly to the right", () => {
    const nodes = [makeNode("origin", 0, 0), makeNode("right", 300, 0), makeNode("far-right", 600, 0)];
    expect(findNodeInDirection(nodes, "origin", "right")).toBe("right");
  });

  it("finds the nearest node directly below", () => {
    const nodes = [makeNode("origin", 0, 0), makeNode("below", 0, 200), makeNode("far-below", 0, 500)];
    expect(findNodeInDirection(nodes, "origin", "down")).toBe("below");
  });

  it("finds the nearest node above/left symmetrically", () => {
    const nodes = [makeNode("origin", 300, 300), makeNode("above", 300, 100), makeNode("left", 100, 300)];
    expect(findNodeInDirection(nodes, "origin", "up")).toBe("above");
    expect(findNodeInDirection(nodes, "origin", "left")).toBe("left");
  });

  it("rejects a node outside the 45-degree cone for the pressed direction", () => {
    // "steep" is mostly above origin, barely to the right — a right-arrow press
    // should not jump to it.
    const nodes = [makeNode("origin", 0, 0), makeNode("steep", 50, -400)];
    expect(findNodeInDirection(nodes, "origin", "right")).toBeNull();
  });

  it("prefers the closer of two candidates in the same direction", () => {
    const nodes = [makeNode("origin", 0, 0), makeNode("near", 150, 0), makeNode("far", 800, 0)];
    expect(findNodeInDirection(nodes, "origin", "right")).toBe("near");
  });

  it("returns null when nothing exists in the pressed direction", () => {
    const nodes = [makeNode("origin", 0, 0), makeNode("left-only", -200, 0)];
    expect(findNodeInDirection(nodes, "origin", "right")).toBeNull();
  });

  it("returns null when the origin node itself isn't found", () => {
    const nodes = [makeNode("a", 0, 0)];
    expect(findNodeInDirection(nodes, "missing", "right")).toBeNull();
  });

  it("falls back to measured dimensions when width/height aren't explicitly set", () => {
    const origin: MindmapNode = { id: "origin", type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: "o" } };
    const target: MindmapNode = {
      id: "target",
      type: "mindmapNode",
      position: { x: 300, y: 0 },
      measured: { width: 120, height: 50 },
      data: { label: "t" },
    };
    expect(findNodeInDirection([origin, target], "origin", "right")).toBe("target");
  });
});
