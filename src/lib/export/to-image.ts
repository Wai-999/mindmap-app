import { toPng, toSvg } from "html-to-image";
import type { ReactFlowInstance } from "@xyflow/react";

export type ImageFormat = "png" | "svg";

const CHROME_SELECTOR =
  ".react-flow__controls, .react-flow__minimap, .react-flow__panel, .react-flow__background";

// Fits all content into view, hides UI chrome (controls/minimap/background dots), and
// rasterizes the canvas-only result. Runs entirely client-side — no server rendering
// dependency.
export async function exportCanvasAsImage(
  reactFlowInstance: ReactFlowInstance,
  format: ImageFormat,
  filename: string,
): Promise<void> {
  const rfEl = document.querySelector<HTMLElement>(".react-flow");
  if (!rfEl) return;

  reactFlowInstance.fitView({ padding: 0.15, duration: 0 });
  // Let the fitView reflow apply before we snapshot.
  await new Promise((resolve) => setTimeout(resolve, 100));

  const hiddenEls = Array.from(rfEl.querySelectorAll<HTMLElement>(CHROME_SELECTOR));
  const previousDisplay = hiddenEls.map((el) => el.style.display);
  hiddenEls.forEach((el) => (el.style.display = "none"));

  try {
    const capture = format === "png" ? toPng : toSvg;
    const dataUrl = await capture(rfEl, { backgroundColor: "#ffffff", pixelRatio: 2 });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${filename}.${format}`;
    link.click();
  } finally {
    hiddenEls.forEach((el, i) => (el.style.display = previousDisplay[i]));
  }
}
