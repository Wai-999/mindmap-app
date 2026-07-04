import { describe, it, expect } from "vitest";
import { Position } from "@xyflow/react";

import {
  getRectIntersection,
  getSideForPoint,
  getFloatingEdgeParams,
  type Rect,
} from "@/lib/mindmap/floating-edge";

// Two default-ish mindmap nodes: 120x40.
const rectAt = (x: number, y: number): Rect => ({ x, y, width: 120, height: 40 });

describe("getRectIntersection", () => {
  const rect = rectAt(0, 0); // center (60, 20)

  it("exits through the right edge midpoint toward a target directly right", () => {
    const p = getRectIntersection(rect, { x: 500, y: 20 });
    expect(p.x).toBeCloseTo(120);
    expect(p.y).toBeCloseTo(20);
  });

  it("exits through the bottom edge midpoint toward a target directly below", () => {
    const p = getRectIntersection(rect, { x: 60, y: 500 });
    expect(p.x).toBeCloseTo(60);
    expect(p.y).toBeCloseTo(40);
  });

  it("snaps a diagonal target to the exact midpoint of whichever side dominates, not a continuous point", () => {
    // Target is down-and-right, but much further right than down — horizontal
    // dominates, so this should land exactly on the right edge's midpoint, not
    // somewhere partway along a diagonal-facing point.
    const p = getRectIntersection(rect, { x: 900, y: 60 });
    expect(p).toEqual({ x: 120, y: 20 });
  });

  it("snaps to the bottom midpoint when the vertical offset dominates instead", () => {
    const p = getRectIntersection(rect, { x: 90, y: 900 });
    expect(p).toEqual({ x: 60, y: 40 });
  });

  it("gives every target in the same direction bucket the identical exit point", () => {
    // Three very differently-positioned targets, all clearly to the right — same
    // deliberate simplification that used to require a separate shared-anchor
    // grouping step now falls out of the cardinal snap for free.
    const right1 = getRectIntersection(rect, { x: 300, y: -200 });
    const right2 = getRectIntersection(rect, { x: 1000, y: 20 });
    const right3 = getRectIntersection(rect, { x: 300, y: 250 });
    expect(right1).toEqual({ x: 120, y: 20 });
    expect(right2).toEqual(right1);
    expect(right3).toEqual(right1);
  });
});

describe("getSideForPoint", () => {
  const rect = rectAt(0, 0);

  it("classifies each edge midpoint to its side", () => {
    expect(getSideForPoint(rect, { x: 0, y: 20 })).toBe(Position.Left);
    expect(getSideForPoint(rect, { x: 120, y: 20 })).toBe(Position.Right);
    expect(getSideForPoint(rect, { x: 60, y: 0 })).toBe(Position.Top);
    expect(getSideForPoint(rect, { x: 60, y: 40 })).toBe(Position.Bottom);
  });
});

describe("getFloatingEdgeParams", () => {
  it("connects facing sides for horizontally separated nodes", () => {
    const params = getFloatingEdgeParams(rectAt(0, 0), rectAt(400, 0));
    expect(params.sourcePosition).toBe(Position.Right);
    expect(params.targetPosition).toBe(Position.Left);
    expect(params.sx).toBeCloseTo(120);
    expect(params.tx).toBeCloseTo(400);
  });

  it("connects facing sides for vertically separated nodes", () => {
    const params = getFloatingEdgeParams(rectAt(0, 0), rectAt(0, 300));
    expect(params.sourcePosition).toBe(Position.Bottom);
    expect(params.targetPosition).toBe(Position.Top);
    expect(params.sy).toBeCloseTo(40);
    expect(params.ty).toBeCloseTo(300);
  });

  it("rotates the anchor points when the target moves to the other side", () => {
    const before = getFloatingEdgeParams(rectAt(0, 0), rectAt(400, 0));
    const after = getFloatingEdgeParams(rectAt(0, 0), rectAt(-400, 0));
    // Same nodes, target dragged from the right side to the left — the source
    // anchor swings from the right border to the left border.
    expect(before.sourcePosition).toBe(Position.Right);
    expect(after.sourcePosition).toBe(Position.Left);
    expect(after.sx).toBeCloseTo(0);
  });

  it("gives two edges from the same source toward the same side the identical exit point, with no separate grouping step", () => {
    // Two very differently-positioned targets, both clearly below the source —
    // each edge is computed fully independently, yet both source anchors land on
    // the exact same point since it depends only on the dominant side.
    const toNear = getFloatingEdgeParams(rectAt(0, 0), rectAt(-50, 300));
    const toFar = getFloatingEdgeParams(rectAt(0, 0), rectAt(50, 900));

    expect(toNear.sourcePosition).toBe(Position.Bottom);
    expect(toFar.sourcePosition).toBe(Position.Bottom);
    expect(toNear.sx).toBeCloseTo(toFar.sx);
    expect(toNear.sy).toBeCloseTo(toFar.sy);
  });
});
