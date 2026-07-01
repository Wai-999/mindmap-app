import { describe, it, expect, vi, beforeEach } from "vitest";

import { getOwnedMindmap, resolveShareAccess } from "@/lib/permissions";

const mindmapFindUnique = vi.fn();
const shareLinkFindUnique = vi.fn();

// vi.mock calls are hoisted above imports by Vitest's transform, so this applies
// before lib/permissions.ts (and its own import of lib/prisma) ever runs.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mindmap: { findUnique: (...args: unknown[]) => mindmapFindUnique(...args) },
    shareLink: { findUnique: (...args: unknown[]) => shareLinkFindUnique(...args) },
  },
}));

describe("getOwnedMindmap", () => {
  beforeEach(() => mindmapFindUnique.mockReset());

  it("returns the mindmap when the user owns it", async () => {
    mindmapFindUnique.mockResolvedValue({ id: "m1", ownerId: "u1" });
    expect(await getOwnedMindmap("u1", "m1")).toEqual({ id: "m1", ownerId: "u1" });
  });

  it("returns null when the mindmap doesn't exist", async () => {
    mindmapFindUnique.mockResolvedValue(null);
    expect(await getOwnedMindmap("u1", "missing")).toBeNull();
  });

  it("returns null when the mindmap exists but belongs to someone else", async () => {
    mindmapFindUnique.mockResolvedValue({ id: "m1", ownerId: "someone-else" });
    expect(await getOwnedMindmap("u1", "m1")).toBeNull();
  });
});

describe("resolveShareAccess", () => {
  beforeEach(() => shareLinkFindUnique.mockReset());

  it("returns not_found when the token doesn't exist", async () => {
    shareLinkFindUnique.mockResolvedValue(null);
    expect(await resolveShareAccess("bad-token")).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns expired when the link was revoked", async () => {
    shareLinkFindUnique.mockResolvedValue({
      token: "t1",
      permission: "VIEW",
      revokedAt: new Date(),
      expiresAt: null,
      mindmap: { id: "m1" },
    });
    expect(await resolveShareAccess("t1")).toEqual({ ok: false, reason: "expired" });
  });

  it("returns expired when the expiry date has passed", async () => {
    shareLinkFindUnique.mockResolvedValue({
      token: "t1",
      permission: "VIEW",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      mindmap: { id: "m1" },
    });
    expect(await resolveShareAccess("t1")).toEqual({ ok: false, reason: "expired" });
  });

  it("treats a future expiry date as still valid", async () => {
    shareLinkFindUnique.mockResolvedValue({
      token: "t1",
      permission: "VIEW",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      mindmap: { id: "m1" },
    });
    expect((await resolveShareAccess("t1")).ok).toBe(true);
  });

  it("returns the mindmap and permission for a valid link", async () => {
    const shareLink = {
      token: "t1",
      permission: "EDIT",
      revokedAt: null,
      expiresAt: null,
      mindmap: { id: "m1", title: "Test" },
    };
    shareLinkFindUnique.mockResolvedValue(shareLink);

    const result = await resolveShareAccess("t1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.permission).toBe("EDIT");
      expect(result.mindmap).toEqual({ id: "m1", title: "Test" });
    }
  });
});
