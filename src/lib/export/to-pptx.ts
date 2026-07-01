import type { MindmapContent } from "@/types/mindmap";
import { exportToSlides, type AttachmentLike, type Slide } from "@/lib/mindmap/to-slides";

// One slide per node, in the same depth-first order as the live presentation overlay
// (both consume lib/mindmap/to-slides.ts) — title is the node's label, body is its
// note as plain text (mapping Markdown to PPTX rich-text runs is a bigger lift than
// scoped here), and the first image attachment (if any) sits below the text.
//
// Dynamically imported — pptxgenjs is a fairly large dependency only needed when a
// user actually exports to PowerPoint, so it's kept out of the editor's main bundle.
export async function exportToPptx(
  title: string,
  content: MindmapContent,
  attachments: AttachmentLike[],
): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.title = title;

  const slides = exportToSlides(content, attachments);
  const slidesToRender: Slide[] = slides.length > 0 ? slides : [{ nodeId: "", label: title, depth: 0 }];

  for (const slide of slidesToRender) {
    const pptxSlide = pptx.addSlide();
    pptxSlide.addText(slide.label, { x: 0.5, y: 0.4, w: "90%", fontSize: 28, bold: true });

    if (slide.note) {
      pptxSlide.addText(slide.note, {
        x: 0.5,
        y: 1.3,
        w: "90%",
        h: 3,
        fontSize: 16,
        color: "444444",
      });
    }

    if (slide.imageAttachmentUrl) {
      pptxSlide.addImage({ path: slide.imageAttachmentUrl, x: 0.5, y: 4.2, w: 4, h: 2.2 });
    }
  }

  const output = await pptx.write();
  return output as Blob;
}
