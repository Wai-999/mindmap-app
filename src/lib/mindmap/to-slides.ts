import type { MindmapContent } from "@/types/mindmap";
import { walkForestPreOrder } from "@/lib/mindmap/walk-tree";

export interface Slide {
  nodeId: string;
  label: string;
  depth: number;
  note?: string;
  imageAttachmentUrl?: string;
}

// Minimal shape this only needs from an Attachment row — kept decoupled from the
// Prisma type so this stays a pure function, easy to unit-test without a DB.
export interface AttachmentLike {
  nodeId: string;
  url: string;
  mimeType: string;
}

// Depth-first pre-order slide sequence across the whole forest (every root's tree, in
// turn) — one slide per node. Shared by the live presentation overlay and the PPTX
// exporter (Phase 14), so both walk the mindmap in exactly the same order.
export function exportToSlides(
  content: MindmapContent,
  attachments: AttachmentLike[] = [],
): Slide[] {
  const slides: Slide[] = [];

  walkForestPreOrder(content.nodes, content.edges, (node, depth) => {
    // First image attachment for this node, if any — a node could have several
    // attachments, but a slide only has room for one illustrative image.
    const image = attachments.find(
      (a) => a.nodeId === node.id && a.mimeType.startsWith("image/"),
    );

    slides.push({
      nodeId: node.id,
      label: node.data.label || "Untitled idea",
      depth,
      note: node.data.note,
      imageAttachmentUrl: image?.url,
    });
  });

  return slides;
}
