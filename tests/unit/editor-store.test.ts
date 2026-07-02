import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useEditorStore, ROOT_AT_CURSOR_OFFSET } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
import { getRootNodes, isRootNode } from "@/lib/mindmap/tree-utils";
import { setLastCanvasPoint, clearLastCanvasPoint } from "@/lib/mindmap/canvas-cursor";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: id } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

function load(nodes: MindmapNode[], edges: MindmapEdge[], readOnly = false) {
  useEditorStore.getState().loadMindmap({
    id: "m1",
    title: "Test",
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
    readOnly,
  });
}

describe("editor-store forest support", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("addRootNode creates a new parentless node, selecting and editing it", () => {
    const id = useEditorStore.getState().addRootNode();
    expect(id).not.toBeNull();

    const state = useEditorStore.getState();
    expect(getRootNodes(state.nodes, state.edges).map((n) => n.id).sort()).toEqual(
      ["root", id].sort(),
    );
    expect(state.selectedNodeId).toBe(id);
    expect(state.editingNodeId).toBe(id);
    expect(state.dirty).toBe(true);
  });

  it("addRootNode does nothing and returns null when read-only", () => {
    load([makeNode("root")], [], true);
    const before = useEditorStore.getState().nodes.length;

    const id = useEditorStore.getState().addRootNode();

    expect(id).toBeNull();
    expect(useEditorStore.getState().nodes).toHaveLength(before);
  });

  it("addSiblingNode on a root creates a second, independent primary idea instead of returning null", () => {
    const rootId = "root";
    const siblingId = useEditorStore.getState().addSiblingNode(rootId);

    expect(siblingId).not.toBeNull();
    expect(siblingId).not.toBe(rootId);

    const state = useEditorStore.getState();
    expect(isRootNode(state.edges, siblingId!)).toBe(true);
    // Unlike editing the same root, a real second node now exists.
    expect(state.nodes.map((n) => n.id).sort()).toEqual([rootId, siblingId].sort());
  });

  it("addSiblingNode on a non-root node still adds a sibling under the same parent", () => {
    load([makeNode("root"), makeNode("a")], [makeEdge("root", "a")]);
    const siblingId = useEditorStore.getState().addSiblingNode("a");

    const state = useEditorStore.getState();
    expect(siblingId).not.toBeNull();
    expect(state.edges.some((e) => e.source === "root" && e.target === siblingId)).toBe(true);
  });

  it("deleteNodeAndSubtree on the sole root empties the canvas without error", () => {
    expect(() => useEditorStore.getState().deleteNodeAndSubtree("root")).not.toThrow();

    const state = useEditorStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
  });

  it("deleting one root in a forest leaves the other roots and their subtrees intact", () => {
    load(
      [makeNode("root"), makeNode("a"), makeNode("root2"), makeNode("b")],
      [makeEdge("root", "a"), makeEdge("root2", "b")],
    );

    useEditorStore.getState().deleteNodeAndSubtree("root");

    const state = useEditorStore.getState();
    expect(state.nodes.map((n) => n.id).sort()).toEqual(["b", "root2"]);
  });
});

describe("editor-store applyRemoteContent (Liveblocks bridge)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
    useHistoryStore.getState().reset();
  });

  it("updates nodes/edges and marks dirty, without committing undo history", () => {
    useEditorStore.getState().selectNode("root");
    const newNodes = [makeNode("root"), makeNode("a")];
    const newEdges = [makeEdge("root", "a")];

    useEditorStore.getState().applyRemoteContent(newNodes, newEdges);

    const state = useEditorStore.getState();
    expect(state.nodes).toEqual(newNodes);
    expect(state.edges).toEqual(newEdges);
    expect(state.dirty).toBe(true);
    // A local Cmd+Z must never undo a remote peer's edit — only this tab's own
    // actions, which is why this differs from replaceContent.
    expect(useHistoryStore.getState().past).toEqual([]);
  });

  it("drops a selected/editing node reference that the remote change removed", () => {
    useEditorStore.getState().selectNode("root");
    useEditorStore.getState().setEditingNode("root");

    // Remote change removes "root" entirely (e.g. another user deleted it).
    useEditorStore.getState().applyRemoteContent([makeNode("other")], []);

    const state = useEditorStore.getState();
    expect(state.selectedNodeId).toBeNull();
    expect(state.editingNodeId).toBeNull();
  });

  it("keeps a selected/editing node reference that still exists after the remote change", () => {
    useEditorStore.getState().selectNode("root");
    useEditorStore.getState().applyRemoteContent([makeNode("root"), makeNode("a")], []);

    expect(useEditorStore.getState().selectedNodeId).toBe("root");
  });

  it("does nothing when read-only", () => {
    load([makeNode("root")], [], true);
    useEditorStore.getState().applyRemoteContent([makeNode("root"), makeNode("a")], []);
    expect(useEditorStore.getState().nodes).toHaveLength(1);
  });
});

describe("editor-store addRootNode placement (new idea at the cursor)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });
  afterEach(() => {
    clearLastCanvasPoint();
  });

  it("centers the new idea on an explicitly passed point (pane double-click)", () => {
    const id = useEditorStore.getState().addRootNode({ x: 300, y: 200 });
    const node = useEditorStore.getState().nodes.find((n) => n.id === id)!;
    expect(node.position).toEqual({
      x: 300 - ROOT_AT_CURSOR_OFFSET.x,
      y: 200 - ROOT_AT_CURSOR_OFFSET.y,
    });
  });

  it("falls back to the cursor's last tracked canvas position when no point is passed", () => {
    setLastCanvasPoint({ x: -80, y: 40 });
    const id = useEditorStore.getState().addRootNode();
    const node = useEditorStore.getState().nodes.find((n) => n.id === id)!;
    expect(node.position).toEqual({
      x: -80 - ROOT_AT_CURSOR_OFFSET.x,
      y: 40 - ROOT_AT_CURSOR_OFFSET.y,
    });
  });

  it("an explicit point wins over the tracked cursor position", () => {
    setLastCanvasPoint({ x: 999, y: 999 });
    const id = useEditorStore.getState().addRootNode({ x: 10, y: 10 });
    const node = useEditorStore.getState().nodes.find((n) => n.id === id)!;
    expect(node.position.x).toBe(10 - ROOT_AT_CURSOR_OFFSET.x);
  });

  it("keeps the below-everything fallback when the cursor was never over the canvas", () => {
    const id = useEditorStore.getState().addRootNode();
    const node = useEditorStore.getState().nodes.find((n) => n.id === id)!;
    // Existing single node sits at (0,0) — fallback places the new root 160 below.
    expect(node.position).toEqual({ x: 0, y: 160 });
  });
});

describe("editor-store addLinkEdge / removeLinkEdge (free-form connections)", () => {
  beforeEach(() => {
    load([makeNode("root"), makeNode("a"), makeNode("b")], [makeEdge("root", "a")]);
  });

  it("creates a link edge between two unconnected nodes", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b");
    expect(id).not.toBeNull();

    const state = useEditorStore.getState();
    const edge = state.edges.find((e) => e.id === id);
    expect(edge?.data?.kind).toBe("link");
    expect(edge?.source).toBe("a");
    expect(edge?.target).toBe("b");
    expect(state.dirty).toBe(true);
  });

  it("stores the dragged handle ids on the new link edge", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b", "top", "bottom");
    const edge = useEditorStore.getState().edges.find((e) => e.id === id);
    expect(edge?.sourceHandle).toBe("top");
    expect(edge?.targetHandle).toBe("bottom");
  });

  it("rejects a self-loop", () => {
    const before = useEditorStore.getState().edges.length;
    const id = useEditorStore.getState().addLinkEdge("a", "a");
    expect(id).toBeNull();
    expect(useEditorStore.getState().edges).toHaveLength(before);
  });

  it("rejects a duplicate connection between an already-connected pair", () => {
    const before = useEditorStore.getState().edges.length;
    const id = useEditorStore.getState().addLinkEdge("root", "a"); // already hierarchy-connected
    expect(id).toBeNull();
    expect(useEditorStore.getState().edges).toHaveLength(before);
  });

  it("rejects connecting to a node that doesn't exist", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "nope");
    expect(id).toBeNull();
  });

  it("does nothing and returns null when read-only", () => {
    load([makeNode("root"), makeNode("a"), makeNode("b")], [makeEdge("root", "a")], true);
    const id = useEditorStore.getState().addLinkEdge("a", "b");
    expect(id).toBeNull();
  });

  it("removeLinkEdge deletes only the targeted link edge", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().removeLinkEdge(id);

    const state = useEditorStore.getState();
    expect(state.edges.some((e) => e.id === id)).toBe(false);
    expect(state.edges.some((e) => e.source === "root" && e.target === "a")).toBe(true);
  });

  it("removeLinkEdge refuses to delete a hierarchy edge", () => {
    const hierarchyEdgeId = useEditorStore.getState().edges[0].id;
    useEditorStore.getState().removeLinkEdge(hierarchyEdgeId);
    expect(useEditorStore.getState().edges.some((e) => e.id === hierarchyEdgeId)).toBe(true);
  });

  it("addLinkEdge/removeLinkEdge are each one Undo away", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().edges.some((e) => e.id === id)).toBe(false);

    useEditorStore.getState().redo();
    useEditorStore.getState().removeLinkEdge(id);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().edges.some((e) => e.id === id)).toBe(true);
  });
});

describe("editor-store addChildNode position override (drag-to-empty-canvas)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("places the new child at the given point instead of the computed offset", () => {
    const id = useEditorStore.getState().addChildNode("root", { x: 500, y: 400 })!;
    const node = useEditorStore.getState().nodes.find((n) => n.id === id);
    expect(node?.position).toEqual({ x: 500, y: 400 });
  });

  it("still connects the new child to its parent with a hierarchy edge", () => {
    const id = useEditorStore.getState().addChildNode("root", { x: 500, y: 400 })!;
    const edge = useEditorStore.getState().edges.find((e) => e.target === id);
    expect(edge?.source).toBe("root");
    expect(edge?.data?.kind).toBeUndefined(); // hierarchy, not a link
  });

  it("falls back to the computed offset when no point is given", () => {
    const id = useEditorStore.getState().addChildNode("root")!;
    const node = useEditorStore.getState().nodes.find((n) => n.id === id);
    expect(node?.position).not.toEqual({ x: 500, y: 400 });
  });
});

describe("editor-store reconnectLinkEdge (dragging an existing connection's end)", () => {
  beforeEach(() => {
    load([makeNode("root"), makeNode("a"), makeNode("b"), makeNode("c")], [makeEdge("root", "a")]);
  });

  it("re-targets a link edge's source and target", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().reconnectLinkEdge(id, "a", "c");

    const edge = useEditorStore.getState().edges.find((e) => e.id === id);
    expect(edge?.source).toBe("a");
    expect(edge?.target).toBe("c");
  });

  it("refuses to reconnect a hierarchy edge", () => {
    const hierarchyEdgeId = useEditorStore.getState().edges[0].id;
    useEditorStore.getState().reconnectLinkEdge(hierarchyEdgeId, "b", "c");

    const edge = useEditorStore.getState().edges.find((e) => e.id === hierarchyEdgeId);
    expect(edge?.source).toBe("root");
    expect(edge?.target).toBe("a");
  });

  it("rejects a self-loop", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().reconnectLinkEdge(id, "c", "c");

    const edge = useEditorStore.getState().edges.find((e) => e.id === id);
    expect(edge?.source).toBe("a");
    expect(edge?.target).toBe("b");
  });

  it("rejects reconnecting onto a pair that's already connected", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().reconnectLinkEdge(id, "root", "a"); // already hierarchy-connected

    const edge = useEditorStore.getState().edges.find((e) => e.id === id);
    expect(edge?.source).toBe("a");
    expect(edge?.target).toBe("b");
  });

  it("does nothing when read-only", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    load([makeNode("root"), makeNode("a"), makeNode("b"), makeNode("c")], useEditorStore.getState().edges, true);
    useEditorStore.getState().reconnectLinkEdge(id, "a", "c");

    const edge = useEditorStore.getState().edges.find((e) => e.id === id);
    expect(edge?.source).toBe("a");
    expect(edge?.target).toBe("b");
  });

  it("is one Undo away", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().reconnectLinkEdge(id, "a", "c");
    useEditorStore.getState().undo();

    const edge = useEditorStore.getState().edges.find((e) => e.id === id);
    expect(edge?.target).toBe("b");
  });
});
