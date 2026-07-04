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

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// Which of a rect's 4 sides best faces `target`, using whichever axis (horizontal or
// vertical) has the larger separation. Ties (equal separation) resolve to a
// horizontal side, matching the >= below.
function dominantSide(rect: Rect, target: Point): Position {
  const c = center(rect);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left;
  return dy >= 0 ? Position.Bottom : Position.Top;
}

// The exact midpoint of one side of a rect.
function sideMidpoint(rect: Rect, side: Position): Point {
  const c = center(rect);
  switch (side) {
    case Position.Left:
      return { x: rect.x, y: c.y };
    case Position.Right:
      return { x: rect.x + rect.width, y: c.y };
    case Position.Top:
      return { x: c.x, y: rect.y };
    case Position.Bottom:
    default:
      return { x: c.x, y: rect.y + rect.height };
  }
}

// Every connection docks at one of exactly 4 fixed points per node — the midpoint of
// whichever side faces `target` — rather than a continuously-variable point along the
// border. That's a deliberate structure/readability trade: a node reads as a clean
// diagram with at most 4 distinct exit points, however many edges actually leave from
// each, and any two edges leaving toward the same side automatically share the
// identical exit point (it depends only on which side is dominant, not on the
// specific target), no extra grouping logic needed.
export function getRectIntersection(rect: Rect, target: Point): Point {
  return sideMidpoint(rect, dominantSide(rect, target));
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

// Both endpoints of a connection: each sits on its own node's border, at the
// midpoint of whichever side faces the other node — so the connection rotates
// between (at most) 4 fixed docking points as either end moves, instead of staying
// pinned to one fixed side or floating continuously. Any other edges leaving the
// same source toward the same side land on this identical point automatically,
// since it depends only on which side is dominant, not on the specific target.
export function getFloatingEdgeParams(source: Rect, target: Rect): FloatingEdgeParams {
  const sourcePoint = getRectIntersection(source, center(target));
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
