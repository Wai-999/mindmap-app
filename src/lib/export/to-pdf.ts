import { toPng } from "html-to-image";
import type { ReactFlowInstance } from "@xyflow/react";

const CHROME_SELECTOR =
  ".react-flow__controls, .react-flow__minimap, .react-flow__panel, .react-flow__background";

// Same capture approach as to-image.ts's PNG export (fit-to-view, hide UI chrome,
// rasterize), wrapped into a downloadable PDF sized to the captured canvas's own
// aspect ratio — entirely client-side, no server rendering dependency.
//
// Dynamically imported — jsPDF is only needed when a user actually exports to PDF, so
// it's kept out of the editor's main bundle.
export async function exportCanvasAsPdf(
  reactFlowInstance: ReactFlowInstance,
  filename: string,
): Promise<void> {
  const rfEl = document.querySelector<HTMLElement>(".react-flow");
  if (!rfEl) return;

  const { jsPDF } = await import("jspdf");

  reactFlowInstance.fitView({ padding: 0.15, duration: 0 });
  await new Promise((resolve) => setTimeout(resolve, 100));

  const hiddenEls = Array.from(rfEl.querySelectorAll<HTMLElement>(CHROME_SELECTOR));
  const previousDisplay = hiddenEls.map((el) => el.style.display);
  hiddenEls.forEach((el) => (el.style.display = "none"));

  try {
    const dataUrl = await toPng(rfEl, { backgroundColor: "#ffffff", pixelRatio: 2 });
    const { width, height } = rfEl.getBoundingClientRect();

    const pdf = new jsPDF({
      orientation: width >= height ? "landscape" : "portrait",
      unit: "pt",
      format: [width, height],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
    pdf.save(`${filename}.pdf`);
  } finally {
    hiddenEls.forEach((el, i) => (el.style.display = previousDisplay[i]));
  }
}
