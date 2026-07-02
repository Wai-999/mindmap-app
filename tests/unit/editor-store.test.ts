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

describe("editor-store addChildNode position override (Tab/Enter still use the computed default)", () => {
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

describe("editor-store addLinkedNode (drag-to-empty-canvas)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("places the new node at the given point", () => {
    const id = useEditorStore.getState().addLinkedNode("root", { x: 500, y: 400 })!;
    const node = useEditorStore.getState().nodes.find((n) => n.id === id);
    expect(node?.position).toEqual({ x: 500, y: 400 });
  });

  it("connects it to the source node with a link edge, not a hierarchy edge", () => {
    const id = useEditorStore.getState().addLinkedNode("root", { x: 500, y: 400 })!;
    const edge = useEditorStore.getState().edges.find((e) => e.target === id);
    expect(edge?.source).toBe("root");
    expect(edge?.data?.kind).toBe("link");
  });

  it("selects and enters edit mode on the new node", () => {
    const id = useEditorStore.getState().addLinkedNode("root", { x: 500, y: 400 })!;
    const state = useEditorStore.getState();
    expect(state.selectedNodeId).toBe(id);
    expect(state.editingNodeId).toBe(id);
  });

  it("returns null and does nothing when the source node doesn't exist", () => {
    const before = useEditorStore.getState().nodes.length;
    const id = useEditorStore.getState().addLinkedNode("nope", { x: 0, y: 0 });
    expect(id).toBeNull();
    expect(useEditorStore.getState().nodes).toHaveLength(before);
  });

  it("does nothing and returns null when read-only", () => {
    load([makeNode("root")], [], true);
    const id = useEditorStore.getState().addLinkedNode("root", { x: 0, y: 0 });
    expect(id).toBeNull();
  });

  it("is one Undo away (both the node and the link edge)", () => {
    const before = useEditorStore.getState().nodes.length;
    const id = useEditorStore.getState().addLinkedNode("root", { x: 500, y: 400 })!;
    useEditorStore.getState().undo();

    const state = useEditorStore.getState();
    expect(state.nodes).toHaveLength(before);
    expect(state.edges.some((e) => e.target === id)).toBe(false);
  });
});

describe("editor-store updateNodeSize", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("sets the node's size and marks the canvas dirty", () => {
    useEditorStore.getState().updateNodeSize("root", "large");
    const node = useEditorStore.getState().nodes.find((n) => n.id === "root");
    expect(node?.data.size).toBe("large");
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it("clearing back to undefined (the medium default) is one Undo away", () => {
    useEditorStore.getState().updateNodeSize("root", "small");
    useEditorStore.getState().updateNodeSize("root", undefined);
    expect(useEditorStore.getState().nodes.find((n) => n.id === "root")?.data.size).toBeUndefined();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes.find((n) => n.id === "root")?.data.size).toBe("small");
  });

  it("does nothing when read-only", () => {
    load([makeNode("root")], [], true);
    useEditorStore.getState().updateNodeSize("root", "large");
    expect(useEditorStore.getState().nodes.find((n) => n.id === "root")?.data.size).toBeUndefined();
  });
});

describe("editor-store addImageNode (upload image onto canvas)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
    clearLastCanvasPoint();
  });

  it("creates a parentless imageOnly node carrying the filename as its label", () => {
    const id = useEditorStore.getState().addImageNode("photo.png", { x: 300, y: 200 })!;
    const state = useEditorStore.getState();
    const node = state.nodes.find((n) => n.id === id);

    expect(node?.data.imageOnly).toBe(true);
    expect(node?.data.label).toBe("photo.png");
    // Parentless — it's a standalone element, so it reads as a forest root.
    expect(isRootNode(state.edges, id!)).toBe(true);
    expect(node?.position).toEqual({
      x: 300 - ROOT_AT_CURSOR_OFFSET.x,
      y: 200 - ROOT_AT_CURSOR_OFFSET.y,
    });
  });

  it("selects the new image node but does NOT enter edit mode (no text to type)", () => {
    const id = useEditorStore.getState().addImageNode("photo.png", { x: 0, y: 0 });
    const state = useEditorStore.getState();
    expect(state.selectedNodeId).toBe(id);
    expect(state.editingNodeId).toBeNull();
  });

  it("does nothing and returns null when read-only", () => {
    load([makeNode("root")], [], true);
    const id = useEditorStore.getState().addImageNode("photo.png", { x: 0, y: 0 });
    expect(id).toBeNull();
    expect(useEditorStore.getState().nodes).toHaveLength(1);
  });

  it("is one Undo away", () => {
    const before = useEditorStore.getState().nodes.length;
    useEditorStore.getState().addImageNode("photo.png", { x: 0, y: 0 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes).toHaveLength(before);
  });
});

describe("editor-store onNodesChange (resize vs measurement noise)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("marks the canvas dirty on a NodeResizer resize (dimensions change with setAttributes)", () => {
    const revBefore = useEditorStore.getState().revision;
    useEditorStore.getState().onNodesChange([
      {
        id: "root",
        type: "dimensions",
        setAttributes: true,
        dimensions: { width: 320, height: 180 },
        resizing: true,
      },
    ]);
    const state = useEditorStore.getState();
    expect(state.dirty).toBe(true);
    expect(state.revision).toBe(revBefore + 1);
  });

  it("does NOT dirty the canvas on a measurement-only dimensions change (no setAttributes)", () => {
    // These fire constantly from React Flow's ResizeObserver — treating them as edits
    // would autosave-storm and mark a pristine just-loaded canvas dirty.
    const revBefore = useEditorStore.getState().revision;
    useEditorStore.getState().onNodesChange([
      { id: "root", type: "dimensions", dimensions: { width: 120, height: 40 } },
    ]);
    const state = useEditorStore.getState();
    expect(state.dirty).toBe(false);
    expect(state.revision).toBe(revBefore);
  });
});

describe("editor-store reconnectLinkEdge (dragging an existing connection's end)", () => {
  beforeEach(() => {
    load([makeNode("root"), makeNode("a"), makeNode("b"), makeNode("c")], [makeEdge("root", "a")]);
  });

  it("re-targets a link edge's source and target", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().reconnectLinkEdge(id, "a", "c");

    const edges = useEditorStore.getState().edges;
    expect(edges.find((e) => e.id === id)).toBeUndefined(); // old id retired, see below
    const edge = edges.find((e) => e.source === "a" && e.target === "c");
    expect(edge).toBeDefined();
  });

  it("regenerates the edge's id from its new endpoints, so a later edge freshly created between the original pair doesn't collide with it", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!; // id derived from (a, b)
    useEditorStore.getState().reconnectLinkEdge(id, "a", "c"); // now (a, c) — id must follow
    const newId = useEditorStore.getState().addLinkEdge("a", "b")!; // (a, b) is free again

    // The reconnected edge vacated the id derived from (a, b), so the fresh edge is free
    // to reuse it — that's expected. What must never happen is two edges sharing one id.
    const state = useEditorStore.getState();
    const ids = state.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.edges.some((e) => e.id === newId && e.source === "a" && e.target === "b")).toBe(true);
    expect(state.edges.some((e) => e.id !== newId && e.source === "a" && e.target === "c")).toBe(true);
  });

  it("moves edge selection over to the new id when reconnecting the currently-selected edge", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().selectEdge(id);
    useEditorStore.getState().reconnectLinkEdge(id, "a", "c");

    const state = useEditorStore.getState();
    expect(state.selectedEdgeId).not.toBe(id);
    expect(state.selectedEdgeId).toBe(state.edges.find((e) => e.source === "a" && e.target === "c")?.id);
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

describe("editor-store updateNodeShape", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("sets a node's shape", () => {
    useEditorStore.getState().updateNodeShape("root", "diamond");
    expect(useEditorStore.getState().nodes[0].data.shape).toBe("diamond");
  });

  it("clears back to the default (rounded) by setting undefined", () => {
    useEditorStore.getState().updateNodeShape("root", "pill");
    useEditorStore.getState().updateNodeShape("root", undefined);
    expect(useEditorStore.getState().nodes[0].data.shape).toBeUndefined();
  });

  it("does nothing when read-only", () => {
    load([makeNode("root")], [], true);
    useEditorStore.getState().updateNodeShape("root", "diamond");
    expect(useEditorStore.getState().nodes[0].data.shape).toBeUndefined();
  });

  it("is one Undo away", () => {
    useEditorStore.getState().updateNodeShape("root", "rectangle");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes[0].data.shape).toBeUndefined();
  });
});

describe("editor-store selectNode / selectEdge mutual exclusivity", () => {
  beforeEach(() => {
    load([makeNode("root"), makeNode("a"), makeNode("b")], [makeEdge("root", "a")]);
  });

  it("selecting a node clears an edge selection", () => {
    useEditorStore.getState().selectEdge("some-edge");
    useEditorStore.getState().selectNode("a");

    const state = useEditorStore.getState();
    expect(state.selectedNodeId).toBe("a");
    expect(state.selectedEdgeId).toBeNull();
  });

  it("selecting an edge clears a node selection", () => {
    useEditorStore.getState().selectNode("a");
    useEditorStore.getState().selectEdge("some-edge");

    const state = useEditorStore.getState();
    expect(state.selectedEdgeId).toBe("some-edge");
    expect(state.selectedNodeId).toBeNull();
  });

  it("deselecting a node (null) also clears the edge selection", () => {
    useEditorStore.getState().selectEdge("some-edge");
    useEditorStore.getState().selectNode(null);
    expect(useEditorStore.getState().selectedEdgeId).toBeNull();
  });

  it("removeLinkEdge clears the selection if the removed edge was selected", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().selectEdge(id);
    useEditorStore.getState().removeLinkEdge(id);
    expect(useEditorStore.getState().selectedEdgeId).toBeNull();
  });

  it("deleteNodeAndSubtree clears the edge selection if the selected edge touched the deleted node", () => {
    const id = useEditorStore.getState().addLinkEdge("a", "b")!;
    useEditorStore.getState().selectEdge(id);
    useEditorStore.getState().deleteNodeAndSubtree("b");
    expect(useEditorStore.getState().selectedEdgeId).toBeNull();
  });
});

describe("editor-store multi-select + bulk actions", () => {
  beforeEach(() => {
    load(
      [makeNode("root"), makeNode("a"), makeNode("b"), makeNode("c")],
      [makeEdge("root", "a"), makeEdge("root", "b"), makeEdge("a", "c")],
    );
  });

  it("setSelectedNodeIds sets the set and the primary (last) node", () => {
    useEditorStore.getState().setSelectedNodeIds(["a", "b"]);
    const s = useEditorStore.getState();
    expect(s.selectedNodeIds).toEqual(["a", "b"]);
    expect(s.selectedNodeId).toBe("b");
  });

  it("selectNode collapses a multi-selection down to one node", () => {
    useEditorStore.getState().setSelectedNodeIds(["a", "b"]);
    useEditorStore.getState().selectNode("root");
    const s = useEditorStore.getState();
    expect(s.selectedNodeIds).toEqual(["root"]);
    expect(s.selectedNodeId).toBe("root");
  });

  it("updateSelectedNodesColor recolors every selected node in one undo step", () => {
    useEditorStore.getState().setSelectedNodeIds(["a", "b"]);
    useEditorStore.getState().updateSelectedNodesColor("#123456");
    let s = useEditorStore.getState();
    expect(s.nodes.find((n) => n.id === "a")?.data.color).toBe("#123456");
    expect(s.nodes.find((n) => n.id === "b")?.data.color).toBe("#123456");
    expect(s.nodes.find((n) => n.id === "root")?.data.color).not.toBe("#123456");

    useEditorStore.getState().undo();
    s = useEditorStore.getState();
    expect(s.nodes.find((n) => n.id === "a")?.data.color).not.toBe("#123456");
  });

  it("deleteSelectedNodes removes every selected node and its subtree (a is deleted with c)", () => {
    useEditorStore.getState().setSelectedNodeIds(["a", "b"]);
    useEditorStore.getState().deleteSelectedNodes();
    const ids = useEditorStore.getState().nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["root"]);
    expect(useEditorStore.getState().selectedNodeIds).toEqual([]);
  });

  it("deleteSelectedNodes is one undo step", () => {
    useEditorStore.getState().setSelectedNodeIds(["a", "b"]);
    useEditorStore.getState().deleteSelectedNodes();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes).toHaveLength(4);
  });

  it("bulk actions do nothing when read-only", () => {
    load([makeNode("root"), makeNode("a")], [], true);
    useEditorStore.setState({ selectedNodeIds: ["a"], selectedNodeId: "a" });
    useEditorStore.getState().deleteSelectedNodes();
    expect(useEditorStore.getState().nodes).toHaveLength(2);
  });
});

describe("editor-store updateNodeIcon", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("sets and clears an emoji icon, each one undo step", () => {
    useEditorStore.getState().updateNodeIcon("root", "🔥");
    expect(useEditorStore.getState().nodes.find((n) => n.id === "root")?.data.icon).toBe("🔥");

    useEditorStore.getState().updateNodeIcon("root", undefined);
    expect(useEditorStore.getState().nodes.find((n) => n.id === "root")?.data.icon).toBeUndefined();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().nodes.find((n) => n.id === "root")?.data.icon).toBe("🔥");
  });
});

describe("editor-store focus mode", () => {
  beforeEach(() => {
    load([makeNode("root"), makeNode("a")], [makeEdge("root", "a")]);
  });

  it("setFocusedNode sets and clears the focused node", () => {
    useEditorStore.getState().setFocusedNode("a");
    expect(useEditorStore.getState().focusedNodeId).toBe("a");
    useEditorStore.getState().setFocusedNode(null);
    expect(useEditorStore.getState().focusedNodeId).toBeNull();
  });

  it("deleting the focused node clears focus", () => {
    useEditorStore.getState().setFocusedNode("a");
    useEditorStore.getState().deleteNodeAndSubtree("a");
    expect(useEditorStore.getState().focusedNodeId).toBeNull();
  });
});

describe("editor-store addChildNode smart auto-placement (left/right)", () => {
  beforeEach(() => {
    load([makeNode("root")], []);
  });

  it("a root's first child goes to the right of it", () => {
    const id = useEditorStore.getState().addChildNode("root")!;
    const node = useEditorStore.getState().nodes.find((n) => n.id === id);
    expect(node?.position.x).toBeGreaterThan(0);
  });

  it("a root's second child alternates to the left", () => {
    useEditorStore.getState().addChildNode("root");
    const secondId = useEditorStore.getState().addChildNode("root")!;
    const node = useEditorStore.getState().nodes.find((n) => n.id === secondId);
    expect(node?.position.x).toBeLessThan(0);
  });

  it("a deeper node's children all continue the same side as their own branch, not alternating", () => {
    const leftChildId = useEditorStore.getState().addChildNode("root")!; // right (1st)
    useEditorStore.getState().addChildNode("root"); // left (2nd) — call it "leftBranch"
    const state1 = useEditorStore.getState();
    const leftBranchId = state1.nodes.find((n) => n.position.x < 0 && n.id !== "root")!.id;

    const grandchild1 = useEditorStore.getState().addChildNode(leftBranchId)!;
    const grandchild2 = useEditorStore.getState().addChildNode(leftBranchId)!;

    const state2 = useEditorStore.getState();
    const g1 = state2.nodes.find((n) => n.id === grandchild1)!;
    const g2 = state2.nodes.find((n) => n.id === grandchild2)!;
    const leftBranch = state2.nodes.find((n) => n.id === leftBranchId)!;

    // Both grandchildren continue further left of their own (already-left) parent —
    // neither alternates back to the right.
    expect(g1.position.x).toBeLessThan(leftBranch.position.x);
    expect(g2.position.x).toBeLessThan(leftBranch.position.x);
    // Sanity: the right-side sibling from step 1 is untouched by any of this.
    expect(state2.nodes.find((n) => n.id === leftChildId)!.position.x).toBeGreaterThan(0);
  });

  it("stacks same-side siblings vertically independent of the other side's count", () => {
    const rightId = useEditorStore.getState().addChildNode("root")!; // right
    useEditorStore.getState().addChildNode("root"); // left
    const rightId2 = useEditorStore.getState().addChildNode("root")!; // right again (3rd overall)

    const state = useEditorStore.getState();
    const r1 = state.nodes.find((n) => n.id === rightId)!;
    const r2 = state.nodes.find((n) => n.id === rightId2)!;
    expect(r1.position.x).toBe(r2.position.x); // same side, same horizontal offset
    expect(r1.position.y).not.toBe(r2.position.y); // stacked, not overlapping
  });

  it("an explicit drop point (drag-to-empty-canvas) infers its side from where it landed, not the alternation rule", () => {
    // Even though this would normally be the root's "first child -> right" case, an
    // explicit point to the LEFT must be respected as-is.
    const id = useEditorStore.getState().addChildNode("root", { x: -300, y: 50 })!;
    const node = useEditorStore.getState().nodes.find((n) => n.id === id);
    expect(node?.position).toEqual({ x: -300, y: 50 });
  });
});
