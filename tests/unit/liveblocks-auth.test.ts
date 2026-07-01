import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const auth = vi.fn();
const getOwnedMindmap = vi.fn();
const resolveShareAccess = vi.fn();
const rateLimit = vi.fn();
const isLiveblocksConfigured = vi.fn();
const allow = vi.fn();
const authorize = vi.fn();
const prepareSession = vi.fn();

// Hoisted above the route import by Vitest's transform, same pattern as
// permissions.test.ts's Prisma mock.
vi.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => auth(...args) }));
vi.mock("@/lib/permissions", () => ({
  getOwnedMindmap: (...args: unknown[]) => getOwnedMindmap(...args),
  resolveShareAccess: (...args: unknown[]) => resolveShareAccess(...args),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));
vi.mock("@/lib/liveblocks/config", () => ({
  isLiveblocksConfigured: () => isLiveblocksConfigured(),
  getLiveblocksClient: () => ({ prepareSession }),
}));

const { POST } = await import("@/app/api/liveblocks-auth/route");

function makeRequest(body: unknown): NextRequest {
  return {
    headers: { get: () => "127.0.0.1" },
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/liveblocks-auth", () => {
  beforeEach(() => {
    auth.mockReset();
    getOwnedMindmap.mockReset();
    resolveShareAccess.mockReset();
    rateLimit.mockReset().mockReturnValue(true);
    isLiveblocksConfigured.mockReset().mockReturnValue(true);
    allow.mockReset();
    authorize.mockReset().mockResolvedValue({ status: 200, body: '{"token":"t"}' });
    prepareSession.mockReset().mockReturnValue({
      FULL_ACCESS: ["*:write"],
      READ_ACCESS: ["*:read"],
      allow,
      authorize,
    });
  });

  it("returns 404 when Liveblocks isn't configured on this deployment", async () => {
    isLiveblocksConfigured.mockReturnValue(false);
    const res = await POST(makeRequest({ room: "mindmap:m1" }));
    expect(res.status).toBe(404);
    expect(prepareSession).not.toHaveBeenCalled();
  });

  it("rate-limits before doing anything else", async () => {
    rateLimit.mockReturnValue(false);
    const res = await POST(makeRequest({ room: "mindmap:m1" }));
    expect(res.status).toBe(429);
  });

  it("grants FULL_ACCESS to the owner via session", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    getOwnedMindmap.mockResolvedValue({ id: "m1", ownerId: "u1" });

    const res = await POST(makeRequest({ room: "mindmap:m1" }));

    expect(res.status).toBe(200);
    expect(prepareSession).toHaveBeenCalledWith("u1");
    expect(allow).toHaveBeenCalledWith("mindmap:m1", ["*:write"]);
  });

  it("returns 404 when the session user doesn't own the mindmap", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    getOwnedMindmap.mockResolvedValue(null);

    const res = await POST(makeRequest({ room: "mindmap:m1" }));
    expect(res.status).toBe(404);
  });

  it("grants READ_ACCESS for a VIEW share token, logged out", async () => {
    auth.mockResolvedValue(null);
    resolveShareAccess.mockResolvedValue({
      ok: true,
      mindmap: { id: "m1" },
      permission: "VIEW",
    });

    const res = await POST(makeRequest({ room: "mindmap:m1", token: "tok" }));

    expect(res.status).toBe(200);
    expect(allow).toHaveBeenCalledWith("mindmap:m1", ["*:read"]);
  });

  it("grants FULL_ACCESS for an EDIT share token, logged out", async () => {
    auth.mockResolvedValue(null);
    resolveShareAccess.mockResolvedValue({
      ok: true,
      mindmap: { id: "m1" },
      permission: "EDIT",
    });

    const res = await POST(makeRequest({ room: "mindmap:m1", token: "tok" }));

    expect(res.status).toBe(200);
    expect(allow).toHaveBeenCalledWith("mindmap:m1", ["*:write"]);
  });

  it("returns 404 when the share token resolves to a different mindmap than the room", async () => {
    auth.mockResolvedValue(null);
    resolveShareAccess.mockResolvedValue({
      ok: true,
      mindmap: { id: "some-other-mindmap" },
      permission: "EDIT",
    });

    const res = await POST(makeRequest({ room: "mindmap:m1", token: "tok" }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when there is neither a session nor a share token", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(makeRequest({ room: "mindmap:m1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed request body", async () => {
    const res = await POST(makeRequest({ notRoom: true }));
    expect(res.status).toBe(400);
  });
});
