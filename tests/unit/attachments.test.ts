import { describe, it, expect } from "vitest";

import { isInlineSafeMimeType } from "@/lib/mindmap/attachments";

describe("isInlineSafeMimeType (attachment inline-render allowlist)", () => {
  it("allows common image types and PDF", () => {
    for (const mime of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf"]) {
      expect(isInlineSafeMimeType(mime)).toBe(true);
    }
  });

  it("rejects HTML and SVG — the classic stored-XSS-via-upload vector", () => {
    expect(isInlineSafeMimeType("text/html")).toBe(false);
    expect(isInlineSafeMimeType("image/svg+xml")).toBe(false);
  });

  it("rejects arbitrary/unknown types, matching the 'add any file' upload feature", () => {
    expect(isInlineSafeMimeType("application/octet-stream")).toBe(false);
    expect(isInlineSafeMimeType("application/zip")).toBe(false);
    expect(isInlineSafeMimeType("")).toBe(false);
  });
});
