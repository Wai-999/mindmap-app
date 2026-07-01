import { describe, it, expect, vi, beforeEach } from "vitest";

const verificationTokenCreate = vi.fn();
const verificationTokenDeleteMany = vi.fn();
const verificationTokenFindUnique = vi.fn();
const verificationTokenDelete = vi.fn();

// vi.mock calls are hoisted above imports by Vitest's transform, so this applies
// before lib/password-reset.ts (and its own import of lib/prisma) ever runs.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      create: (...args: unknown[]) => verificationTokenCreate(...args),
      deleteMany: (...args: unknown[]) => verificationTokenDeleteMany(...args),
      findUnique: (...args: unknown[]) => verificationTokenFindUnique(...args),
      delete: (...args: unknown[]) => verificationTokenDelete(...args),
    },
  },
}));

import { createPasswordResetToken, consumePasswordResetToken } from "@/lib/password-reset";

describe("createPasswordResetToken", () => {
  beforeEach(() => {
    verificationTokenCreate.mockReset();
    verificationTokenDeleteMany.mockReset();
  });

  it("clears any existing token for the email before issuing a new one", async () => {
    await createPasswordResetToken("a@example.com");

    expect(verificationTokenDeleteMany).toHaveBeenCalledWith({
      where: { identifier: "a@example.com" },
    });
    expect(verificationTokenCreate).toHaveBeenCalledTimes(1);
  });

  it("issues a long, high-entropy token with a ~1 hour expiry", async () => {
    const before = Date.now();
    const token = await createPasswordResetToken("a@example.com");
    const after = Date.now();

    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const createCall = verificationTokenCreate.mock.calls[0][0];
    expect(createCall.data.identifier).toBe("a@example.com");
    expect(createCall.data.token).toBe(token);
    const expiresAt = createCall.data.expires.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + 61 * 60 * 1000);
  });
});

describe("consumePasswordResetToken", () => {
  beforeEach(() => {
    verificationTokenFindUnique.mockReset();
    verificationTokenDelete.mockReset().mockResolvedValue(undefined);
  });

  it("returns null for an unknown token", async () => {
    verificationTokenFindUnique.mockResolvedValue(null);
    const result = await consumePasswordResetToken("nope");
    expect(result).toBeNull();
    expect(verificationTokenDelete).not.toHaveBeenCalled();
  });

  it("returns the email and deletes the token for a valid, unexpired token", async () => {
    verificationTokenFindUnique.mockResolvedValue({
      identifier: "a@example.com",
      token: "tok",
      expires: new Date(Date.now() + 60_000),
    });

    const result = await consumePasswordResetToken("tok");

    expect(result).toBe("a@example.com");
    expect(verificationTokenDelete).toHaveBeenCalledWith({ where: { token: "tok" } });
  });

  it("returns null (and still deletes) for an expired token — single-use, no retry", async () => {
    verificationTokenFindUnique.mockResolvedValue({
      identifier: "a@example.com",
      token: "tok",
      expires: new Date(Date.now() - 60_000),
    });

    const result = await consumePasswordResetToken("tok");

    expect(result).toBeNull();
    expect(verificationTokenDelete).toHaveBeenCalledWith({ where: { token: "tok" } });
  });

  it("does not throw if the token row was already deleted concurrently", async () => {
    verificationTokenFindUnique.mockResolvedValue({
      identifier: "a@example.com",
      token: "tok",
      expires: new Date(Date.now() + 60_000),
    });
    verificationTokenDelete.mockRejectedValue(new Error("Record not found"));

    await expect(consumePasswordResetToken("tok")).resolves.toBe("a@example.com");
  });
});
