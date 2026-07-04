import { describe, it, expect } from "vitest";

import { dynamicFontSize, readableTextColor } from "@/lib/mindmap/node-style";

describe("dynamicFontSize (label text tracks a resized node's own height)", () => {
  it("returns roughly the small-preset size at a small node's typical height", () => {
    expect(dynamicFontSize(36)).toBeCloseTo(11.2, 1);
  });

  it("returns roughly the large-preset size at a large node's typical height", () => {
    expect(dynamicFontSize(76)).toBeCloseTo(19.2, 1);
  });

  it("grows past the large preset as a node is resized bigger", () => {
    expect(dynamicFontSize(200)).toBeGreaterThan(dynamicFontSize(76));
  });

  it("never goes below the 11px floor, even for a tiny/zero height", () => {
    expect(dynamicFontSize(0)).toBe(11);
    expect(dynamicFontSize(-50)).toBe(11);
  });

  it("never exceeds the 96px ceiling, even for a huge height", () => {
    expect(dynamicFontSize(10_000)).toBe(96);
  });
});

describe("readableTextColor (YIQ contrast against a node's background fill)", () => {
  it("picks dark text on a light background", () => {
    expect(readableTextColor("#ffffff")).toBe("#1f2937");
    expect(readableTextColor("#f59e0b")).toBe("#1f2937");
  });

  it("picks light text on a dark background", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#6366f1")).toBe("#ffffff");
  });
});
