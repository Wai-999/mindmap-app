import { describe, it, expect } from "vitest";

import { exportToSlides } from "@/lib/mindmap/to-slides";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string, label: string, note?: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label, note } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

describe("exportToSlides", () => {
  it("produces one slide per node in pre-order, across a multi-root forest", () => {
    const nodes = [
      makeNode("root", "Root"),
      makeNode("a", "A"),
      makeNode("a1", "A1"),
      makeNode("root2", "Root2"),
      makeNode("b", "B"),
    ];
    const edges = [
      makeEdge("root", "a"),
      makeEdge("a", "a1"),
      makeEdge("root2", "b"),
    ];

    const slides = exportToSlides({ nodes, edges });

    expect(slides.map((s) => s.nodeId)).toEqual(["root", "a", "a1", "root2", "b"]);
    expect(slides.map((s) => s.depth)).toEqual([0, 1, 2, 0, 1]);
  });

  it("includes note text on the slide", () => {
    const nodes = [makeNode("root", "Root", "Some **note**")];
    const slides = exportToSlides({ nodes, edges: [] });
    expect(slides[0].note).toBe("Some **note**");
  });

  it("falls back to a placeholder label for an untitled node", () => {
    const nodes = [makeNode("root", "")];
    const slides = exportToSlides({ nodes, edges: [] });
    expect(slides[0].label).toBe("Untitled idea");
  });

  it("picks the first image-mimeType attachment for a node, ignoring non-image ones", () => {
    const nodes = [makeNode("root", "Root")];
    const slides = exportToSlides(
      { nodes, edges: [] },
      [
        { nodeId: "root", url: "/doc.pdf", mimeType: "application/pdf" },
        { nodeId: "root", url: "/photo.png", mimeType: "image/png" },
      ],
    );
    expect(slides[0].imageAttachmentUrl).toBe("/photo.png");
  });

  it("leaves imageAttachmentUrl undefined when there are no image attachments", () => {
    const nodes = [makeNode("root", "Root")];
    const slides = exportToSlides({ nodes, edges: [] }, []);
    expect(slides[0].imageAttachmentUrl).toBeUndefined();
  });
});
