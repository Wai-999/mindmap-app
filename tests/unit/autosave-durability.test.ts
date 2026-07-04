import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useEditorStore } from "@/store/editor-store";
import { forceSave, initAutosave } from "@/store/autosave";
import { roomActiveRef, isElectedSaverRef } from "@/lib/liveblocks/collab-state";
import type { MindmapNode } from "@/types/mindmap";

function makeNode(id: string, label = id): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label } };
}

// Same key format store/autosave.ts's own (unexported) pendingSaveKey builds —
// deliberately duplicated here rather than exported purely for a test, since the
// format itself ("mindmap:pending-save:<endpoint>") is what's under test.
function pendingSaveKey(endpoint: string) {
  return `mindmap:pending-save:${endpoint}`;
}

const endpoint = "/api/mindmaps/m1";

describe("autosave durability (pending-save queue survives a failed/offline save)", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().loadMindmap({
      id: "m1",
      title: "Test",
      nodes: [makeNode("root")],
      edges: [],
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    useEditorStore.setState({ dirty: true, revision: 1 });
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("queues the save when the network call throws outright", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));

    await forceSave(endpoint);

    const queued = localStorage.getItem(pendingSaveKey(endpoint));
    expect(queued).not.toBeNull();
    expect(JSON.parse(queued!).clientUpdatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("queues the save on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    await forceSave(endpoint);

    expect(localStorage.getItem(pendingSaveKey(endpoint))).not.toBeNull();
  });

  it("clears any queued save once a save actually succeeds", async () => {
    localStorage.setItem(
      pendingSaveKey(endpoint),
      JSON.stringify({ content: { nodes: [], edges: [] }, title: "stale", clientUpdatedAt: "x" }),
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updatedAt: "2024-01-02T00:00:00.000Z" }),
    } as Response);

    await forceSave(endpoint);

    expect(localStorage.getItem(pendingSaveKey(endpoint))).toBeNull();
  });

  it("discards a queued save once the server reports a definitive conflict (409, no retry)", async () => {
    localStorage.setItem(
      pendingSaveKey(endpoint),
      JSON.stringify({ content: { nodes: [], edges: [] }, title: "stale", clientUpdatedAt: "x" }),
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ content: { nodes: [], edges: [] }, updatedAt: "2024-01-02T00:00:00.000Z" }),
    } as Response);

    await forceSave(endpoint);

    expect(localStorage.getItem(pendingSaveKey(endpoint))).toBeNull();
  });
});

describe("autosave durability (beforeunload uses sendBeacon, not a plain fetch)", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().loadMindmap({
      id: "m1",
      title: "Test",
      nodes: [makeNode("root")],
      edges: [],
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    useEditorStore.setState({ dirty: true, revision: 1 });
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
  });

  afterEach(() => {
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
    localStorage.clear();
  });

  it("sends via sendBeacon and queues the save, without waiting on a response", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });

    const cleanup = initAutosave(endpoint);
    window.dispatchEvent(new Event("beforeunload"));
    cleanup();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(endpoint);
    expect(localStorage.getItem(pendingSaveKey(endpoint))).not.toBeNull();

    vi.unstubAllGlobals();
  });
});

describe("autosave durability (recovering a queued save on next load)", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("applies the queued content when it still matches the server's current updatedAt", () => {
    localStorage.setItem(
      pendingSaveKey(endpoint),
      JSON.stringify({
        content: { nodes: [makeNode("recovered", "Recovered idea")], edges: [] },
        title: "Recovered title",
        clientUpdatedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    useEditorStore.getState().loadMindmap({
      id: "m1",
      title: "Test",
      nodes: [makeNode("root")],
      edges: [],
      updatedAt: "2024-01-01T00:00:00.000Z", // matches the queued save's clientUpdatedAt
    });

    const cleanup = initAutosave(endpoint);

    const state = useEditorStore.getState();
    expect(state.nodes.map((n) => n.id)).toEqual(["recovered"]);
    expect(state.title).toBe("Recovered title");
    expect(state.dirty).toBe(true); // so the recovered content actually gets (re-)saved
    expect(localStorage.getItem(pendingSaveKey(endpoint))).toBeNull();

    cleanup();
  });

  it("discards a queued save that's gone stale (server has since moved past it)", () => {
    localStorage.setItem(
      pendingSaveKey(endpoint),
      JSON.stringify({
        content: { nodes: [makeNode("recovered")], edges: [] },
        title: "Recovered title",
        clientUpdatedAt: "2023-01-01T00:00:00.000Z", // does NOT match — someone else saved since
      }),
    );
    useEditorStore.getState().loadMindmap({
      id: "m1",
      title: "Test",
      nodes: [makeNode("root")],
      edges: [],
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const cleanup = initAutosave(endpoint);

    const state = useEditorStore.getState();
    expect(state.nodes.map((n) => n.id)).toEqual(["root"]); // untouched, not clobbered by stale data
    expect(localStorage.getItem(pendingSaveKey(endpoint))).toBeNull();

    cleanup();
  });
});
