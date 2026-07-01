import { describe, it, expect, beforeEach } from "vitest";

import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
import { getRootNodes, isRootNode } from "@/lib/mindmap/tree-utils";
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
