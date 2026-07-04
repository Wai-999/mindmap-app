import { describe, it, expect } from "vitest";

import { computeViewportCenter } from "@/lib/mindmap/viewport-center";

describe("computeViewportCenter (Insert menu lands new nodes mid-viewport)", () => {
  it("converts the pane's screen-space middle to flow coordinates at 1x zoom, no pan", () => {
    const result = computeViewportCenter({ width: 800, height: 600 }, { x: 0, y: 0, zoom: 1 });
    expect(result).toEqual({ x: 400, y: 300 });
  });

  it("accounts for pan offset", () => {
    const result = computeViewportCenter({ width: 800, height: 600 }, { x: 100, y: 50, zoom: 1 });
    expect(result).toEqual({ x: 300, y: 250 });
  });

  it("accounts for zoom, e.g. zoomed out shows a wider flow-space area", () => {
    const result = computeViewportCenter({ width: 800, height: 600 }, { x: 0, y: 0, zoom: 0.5 });
    expect(result).toEqual({ x: 800, y: 600 });
  });

  it("returns undefined when the pane hasn't been measured yet (width/height undefined)", () => {
    expect(computeViewportCenter({ width: undefined, height: 600 }, { x: 0, y: 0, zoom: 1 })).toBeUndefined();
    expect(computeViewportCenter({ width: 800, height: undefined }, { x: 0, y: 0, zoom: 1 })).toBeUndefined();
  });

  it("returns undefined when the pane is measured as zero-sized", () => {
    expect(computeViewportCenter({ width: 0, height: 600 }, { x: 0, y: 0, zoom: 1 })).toBeUndefined();
  });

  it("returns undefined for a zero or non-finite zoom instead of dividing by it", () => {
    expect(computeViewportCenter({ width: 800, height: 600 }, { x: 0, y: 0, zoom: 0 })).toBeUndefined();
    expect(computeViewportCenter({ width: 800, height: 600 }, { x: 0, y: 0, zoom: NaN })).toBeUndefined();
    expect(computeViewportCenter({ width: 800, height: 600 }, { x: 0, y: 0, zoom: Infinity })).toBeUndefined();
  });
});
