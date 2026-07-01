import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useEditorStore } from "@/store/editor-store";
import { forceSave } from "@/store/autosave";
import { roomActiveRef, isElectedSaverRef } from "@/lib/liveblocks/collab-state";
import type { MindmapNode } from "@/types/mindmap";

function makeNode(id: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: id } };
}

// Covers a real bug caught while testing Phase 11 against two genuinely connected
// Liveblocks clients: a non-elected tab's save-status indicator got stuck on "Unsaved
// changes" forever, because skipping the network call also skipped clearing `dirty`.
describe("autosave + elected-saver interplay", () => {
  beforeEach(() => {
    useEditorStore.getState().loadMindmap({
      id: "m1",
      title: "Test",
      nodes: [makeNode("root")],
      edges: [],
      updatedAt: new Date().toISOString(),
    });
    // loadMindmap resets dirty to false — force it dirty, as a real edit would.
    useEditorStore.setState({ dirty: true, revision: 1 });
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
    vi.unstubAllGlobals();
  });

  it("performs a real save when solo (no room active)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updatedAt: "2024-01-01T00:00:00.000Z" }),
    } as Response);

    await forceSave("/api/mindmaps/m1");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useEditorStore.getState().saveStatus).toBe("saved");
  });

  it("skips the network call but still clears dirty when in a room and not the elected saver", async () => {
    roomActiveRef.current = true;
    isElectedSaverRef.current = () => false;

    await forceSave("/api/mindmaps/m1");

    expect(fetch).not.toHaveBeenCalled();
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useEditorStore.getState().saveStatus).toBe("saved");
  });

  it("still performs a real save when in a room and IS the elected saver", async () => {
    roomActiveRef.current = true;
    isElectedSaverRef.current = () => true;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updatedAt: "2024-01-01T00:00:00.000Z" }),
    } as Response);

    await forceSave("/api/mindmaps/m1");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});
