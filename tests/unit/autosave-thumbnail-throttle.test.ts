import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useEditorStore } from "@/store/editor-store";
import { forceSave } from "@/store/autosave";
import { roomActiveRef, isElectedSaverRef } from "@/lib/liveblocks/collab-state";
import type { MindmapNode } from "@/types/mindmap";

const captureThumbnailMock = vi.fn();
vi.mock("@/lib/mindmap/capture-thumbnail", () => ({
  captureThumbnail: () => captureThumbnailMock(),
}));

function makeNode(id: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: id } };
}

// Rasterizing the whole canvas on every single save was visibly janky (the reported
// "smoother autosave" complaint) — this module's own lastThumbnailAt is only reset by
// re-importing it, hence this living in its own file rather than alongside the other
// autosave tests, so the very first save in the suite deterministically captures.
describe("autosave thumbnail throttle", () => {
  beforeEach(() => {
    useEditorStore.getState().loadMindmap({
      id: "m1",
      title: "Test",
      nodes: [makeNode("root")],
      edges: [],
      updatedAt: new Date().toISOString(),
    });
    roomActiveRef.current = false;
    isElectedSaverRef.current = () => true;
    captureThumbnailMock.mockReset().mockResolvedValue("data:image/jpeg;base64,abc");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ updatedAt: new Date().toISOString() }),
      } as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures a thumbnail on the first save", async () => {
    useEditorStore.setState({ dirty: true, revision: 1 });
    await forceSave("/api/mindmaps/m1");
    expect(captureThumbnailMock).toHaveBeenCalledTimes(1);
  });

  it("skips the capture on a second save shortly after (still sends the PATCH itself)", async () => {
    useEditorStore.setState({ dirty: true, revision: 1 });
    await forceSave("/api/mindmaps/m1");
    captureThumbnailMock.mockClear();

    useEditorStore.setState({ dirty: true, revision: 2, lastSyncedUpdatedAt: new Date().toISOString() });
    await forceSave("/api/mindmaps/m1");

    expect(captureThumbnailMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string);
    expect(secondCallBody.thumbnail).toBeNull();
  });
});
