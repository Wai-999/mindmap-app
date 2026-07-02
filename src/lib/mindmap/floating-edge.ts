import { Position } from "@xyflow/react";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

// Where the line from this rect's center toward `target` crosses the rect's border.
// Standard React Flow floating-edges math: normalize the center-to-center vector by
// the rect's half-extents (L1), which maps the rectangle border to the unit diamond
// and back — cheap, and always lands exactly on the border.
export function getRectIntersection(rect: Rect, target: Point): Point {
  const w = rect.width / 2;
  const h = rect.height / 2;
  const cx = rect.x + w;
  const cy = rect.y + h;

  const dx = (target.x - cx) / (2 * w) - (target.y - cy) / (2 * h);
  const dy = (target.x - cx) / (2 * w) + (target.y - cy) / (2 * h);
  const scale = 1 / (Math.abs(dx) + Math.abs(dy) || 1);
  const nx = scale * dx;
  const ny = scale * dy;

  return {
    x: w * (nx + ny) + cx,
    y: h * (-nx + ny) + cy,
  };
}

// Which side of the rect a border point sits on — getBezierPath needs a Position per
// endpoint to know which way the curve should leave the node.
export function getSideForPoint(rect: Rect, point: Point): Position {
  const left = Math.abs(point.x - rect.x);
  const right = Math.abs(point.x - (rect.x + rect.width));
  const top = Math.abs(point.y - rect.y);
  const bottom = Math.abs(point.y - (rect.y + rect.height));
  const min = Math.min(left, right, top, bottom);

  if (min === left) return Position.Left;
  if (min === right) return Position.Right;
  if (min === top) return Position.Top;
  return Position.Bottom;
}

export interface FloatingEdgeParams {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePosition: Position;
  targetPosition: Position;
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// Both endpoints of a free-form link edge: each sits on its own node's border, facing
// the other node's center — so the connection visually rotates around the node as
// either end is dragged, instead of staying pinned to one fixed side.
//
// sourceAimPoint overrides what the SOURCE side aims at (normally the target's own
// center) — used when several sibling edges leave the same node toward roughly the
// same side, so they all aim at their group's shared centroid instead of each
// competing for its own slightly different exit point on a small parent (see
// shared-edge-anchor.ts). The target side is unaffected: it always aims back at the
// real source center, since a target only has ever the one incoming edge in practice.
export function getFloatingEdgeParams(
  source: Rect,
  target: Rect,
  sourceAimPoint?: Point,
): FloatingEdgeParams {
  const sourcePoint = getRectIntersection(source, sourceAimPoint ?? center(target));
  const targetPoint = getRectIntersection(target, center(source));

  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    sourcePosition: getSideForPoint(source, sourcePoint),
    targetPosition: getSideForPoint(target, targetPoint),
  };
}
