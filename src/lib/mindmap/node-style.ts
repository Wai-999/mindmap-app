// Text size that actually tracks a node's own rendered height, rather than staying
// frozen at whatever the small/medium/large preset picked when the node was created
// — otherwise dragging a node much bigger via NodeResizer leaves its label looking
// tiny and lost inside the now-much-larger box. Linear fit anchored to the preset
// sizes' own typical heights (small ~36px → 12px text, large ~76px → 18px text),
// then keeps extrapolating past them as the box grows or shrinks.
export function dynamicFontSize(height: number): number {
  return Math.min(96, Math.max(11, height * 0.2 + 4));
}

// Perceived-brightness check (YIQ) so a sticky note's text stays legible against
// whichever palette color it's using as its full background fill — the palette
// (see NODE_COLORS) spans everything from amber to indigo, too wide a range to
// assume one text color always reads well.
export function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#1f2937" : "#ffffff";
}
