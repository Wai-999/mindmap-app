import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";

import { useKeyboardShortcuts } from "@/components/editor/keyboard/use-keyboard-shortcuts";
import { useEditorStore } from "@/store/editor-store";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string, x: number, y: number): MindmapNode {
  return { id, type: "mindmapNode", position: { x, y }, width: 100, height: 40, data: { label: id } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

function dispatchKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}

function load(nodes: MindmapNode[], edges: MindmapEdge[]) {
  useEditorStore.getState().loadMindmap({
    id: "m1",
    title: "Test",
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  });
}

// The directional math itself is covered by spatial-nav.test.ts — this covers the
// hook's wiring: that arrow keys actually reach the store, that a cold start (no
// selection yet) can bootstrap one, and that F2 opens editing without touching
// Enter's own established "add a sibling" behavior.
describe("useKeyboardShortcuts (arrow-key navigation + F2-to-edit)", () => {
  beforeEach(() => {
    load(
      [makeNode("root", 0, 0), makeNode("right-child", 300, 0), makeNode("second-root", 0, 400)],
      [makeEdge("root", "right-child")],
    );
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("selects a root node on the first arrow press when nothing is selected yet", () => {
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
    renderHook(() => useKeyboardShortcuts("/api/mindmaps/m1"));

    dispatchKey("ArrowRight");

    expect(useEditorStore.getState().selectedNodeId).not.toBeNull();
  });

  it("moves selection to the geometrically nearest node in the pressed direction", () => {
    useEditorStore.getState().selectNode("root");
    renderHook(() => useKeyboardShortcuts("/api/mindmaps/m1"));

    dispatchKey("ArrowRight");
    expect(useEditorStore.getState().selectedNodeId).toBe("right-child");
  });

  it("F2 opens the selected node for editing", () => {
    useEditorStore.getState().selectNode("root");
    renderHook(() => useKeyboardShortcuts("/api/mindmaps/m1"));

    dispatchKey("F2");

    expect(useEditorStore.getState().editingNodeId).toBe("root");
  });

  it("Enter still adds a sibling instead of editing (F2 owns editing, not Enter)", () => {
    useEditorStore.getState().selectNode("right-child");
    const nodesBefore = useEditorStore.getState().nodes.length;
    renderHook(() => useKeyboardShortcuts("/api/mindmaps/m1"));

    dispatchKey("Enter");

    expect(useEditorStore.getState().nodes.length).toBe(nodesBefore + 1);
  });

  it("ignores arrow keys while actively typing a label", () => {
    useEditorStore.getState().selectNode("root");
    renderHook(() => useKeyboardShortcuts("/api/mindmaps/m1"));

    // Dispatched on the input itself (not window) so the listener's e.target
    // correctly reflects it, matching what a real keypress while typing looks like.
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    document.body.removeChild(input);

    expect(useEditorStore.getState().selectedNodeId).toBe("root");
  });
});
