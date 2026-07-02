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

  it("always lands on the rect's border for diagonal targets", () => {
    const p = getRectIntersection(rect, { x: 400, y: 300 });
    const onVerticalEdge = Math.abs(p.x - 0) < 1e-6 || Math.abs(p.x - 120) < 1e-6;
    const onHorizontalEdge = Math.abs(p.y - 0) < 1e-6 || Math.abs(p.y - 40) < 1e-6;
    expect(onVerticalEdge || onHorizontalEdge).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(120);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(40);
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
});
