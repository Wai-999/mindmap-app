import { describe, it, expect } from "vitest";

import { getFocusedSubtree } from "@/lib/mindmap/focus";
import type { MindmapEdge } from "@/types/mindmap";

function edge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

function linkEdge(source: string, target: string): MindmapEdge {
  return { id: `link_${source}_${target}`, type: "mindmapEdge", source, target, data: { kind: "link" } };
}

// root ── a ── a1
//      └─ b
const edges: MindmapEdge[] = [edge("root", "a"), edge("a", "a1"), edge("root", "b")];

describe("getFocusedSubtree", () => {
  it("returns null when nothing is focused", () => {
    expect(getFocusedSubtree(edges, null)).toBeNull();
  });

  it("includes the focused node and its whole hierarchy subtree", () => {
    const set = getFocusedSubtree(edges, "a");
    expect([...set!].sort()).toEqual(["a", "a1"]);
  });

  it("focusing the root includes everything", () => {
    const set = getFocusedSubtree(edges, "root");
    expect([...set!].sort()).toEqual(["a", "a1", "b", "root"]);
  });

  it("ignores link edges when computing the subtree", () => {
    const withLink = [...edges, linkEdge("a", "b")];
    const set = getFocusedSubtree(withLink, "a");
    // b is only link-connected to a, so it must NOT be pulled into a's focused subtree.
    expect([...set!].sort()).toEqual(["a", "a1"]);
  });

  it("returns the same cached Set instance for the same edges array + node", () => {
    const first = getFocusedSubtree(edges, "a");
    const second = getFocusedSubtree(edges, "a");
    expect(first).toBe(second);
  });
});
