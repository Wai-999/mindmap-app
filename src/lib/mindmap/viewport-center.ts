export interface PaneSize {
  width: number | undefined;
  height: number | undefined;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Insert actions land at the middle of whatever's currently visible, instead of
// wherever the cursor last happened to be hovering (the previous default) — reads
// as "insert here, in front of me" regardless of where the mouse drifted before
// opening the Insert menu. Returns undefined (falling back to the caller's own
// default placement) if the pane hasn't been measured yet or zoom is somehow
// non-finite — a stale or zero measurement here would otherwise place the node
// off-screen instead of just landing somewhere less exact.
export function computeViewportCenter(
  pane: PaneSize,
  viewport: Viewport,
): { x: number; y: number } | undefined {
  if (!pane.width || !pane.height) return undefined;
  if (!viewport.zoom || !Number.isFinite(viewport.zoom)) return undefined;
  return {
    x: (pane.width / 2 - viewport.x) / viewport.zoom,
    y: (pane.height / 2 - viewport.y) / viewport.zoom,
  };
}
