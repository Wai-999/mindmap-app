import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("storage (LocalFilesystemAdapter)", () => {
  let tempDir: string;
  const originalEnv = process.env.ATTACHMENT_STORAGE_PATH;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "mindmap-attachments-test-"));
    process.env.ATTACHMENT_STORAGE_PATH = tempDir;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env.ATTACHMENT_STORAGE_PATH = originalEnv;
  });

  it("saves and reads back a file by key", async () => {
    const { storage } = await import("@/lib/storage");
    await storage.save("abc123", Buffer.from("hello world"));

    const read = await storage.read("abc123");
    expect(read.toString()).toBe("hello world");
  });

  it("creates the storage directory on first save if it doesn't exist yet", async () => {
    // mkdtempSync already creates tempDir itself — point at a nested path under it
    // that genuinely doesn't exist yet, to actually exercise mkdir's recursive option.
    const nestedDir = path.join(tempDir, "nested", "attachments");
    process.env.ATTACHMENT_STORAGE_PATH = nestedDir;
    const { storage } = await import("@/lib/storage");
    expect(existsSync(nestedDir)).toBe(false);

    await storage.save("abc123", Buffer.from("data"));
    expect(existsSync(nestedDir)).toBe(true);
  });

  it("deletes a saved file", async () => {
    const { storage } = await import("@/lib/storage");
    await storage.save("to-delete", Buffer.from("data"));

    await storage.delete("to-delete");

    await expect(storage.read("to-delete")).rejects.toThrow();
  });

  it("delete is a no-op (does not throw) for a key that was never saved", async () => {
    const { storage } = await import("@/lib/storage");
    await expect(storage.delete("never-existed")).resolves.not.toThrow();
  });
});
