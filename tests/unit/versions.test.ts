import { describe, it, expect, vi, beforeEach } from "vitest";

const mindmapVersionCreate = vi.fn();
const mindmapVersionFindMany = vi.fn();
const mindmapVersionDeleteMany = vi.fn();

// vi.mock calls are hoisted above imports by Vitest's transform, so this applies
// before lib/mindmap/versions.ts (and its own import of lib/prisma) ever runs.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mindmapVersion: {
      create: (...args: unknown[]) => mindmapVersionCreate(...args),
      findMany: (...args: unknown[]) => mindmapVersionFindMany(...args),
      deleteMany: (...args: unknown[]) => mindmapVersionDeleteMany(...args),
    },
  },
}));

import { snapshotMindmapVersion, pruneMindmapVersions } from "@/lib/mindmap/versions";

describe("pruneMindmapVersions", () => {
  beforeEach(() => {
    mindmapVersionFindMany.mockReset();
    mindmapVersionDeleteMany.mockReset();
  });

  it("does nothing when there's nothing beyond the cap", async () => {
    mindmapVersionFindMany.mockResolvedValue([]);
    await pruneMindmapVersions("m1");
    expect(mindmapVersionDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes only the versions beyond the cap, oldest first", async () => {
    mindmapVersionFindMany.mockResolvedValue([{ id: "v51" }, { id: "v52" }]);

    await pruneMindmapVersions("m1");

    expect(mindmapVersionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mindmapId: "m1" },
        orderBy: { createdAt: "desc" },
        skip: 50,
      }),
    );
    expect(mindmapVersionDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["v51", "v52"] } },
    });
  });
});

describe("snapshotMindmapVersion", () => {
  beforeEach(() => {
    mindmapVersionCreate.mockReset();
    mindmapVersionFindMany.mockReset().mockResolvedValue([]);
    mindmapVersionDeleteMany.mockReset();
  });

  it("creates a snapshot row and then prunes", async () => {
    await snapshotMindmapVersion("m1", "Title", "{}");

    expect(mindmapVersionCreate).toHaveBeenCalledWith({
      data: { mindmapId: "m1", title: "Title", content: "{}" },
    });
    expect(mindmapVersionFindMany).toHaveBeenCalled();
  });
});
