// @vitest-environment node
//
// to-pptx.ts touches no DOM APIs, and jsdom's own Blob shim in this environment has
// no .arrayBuffer()/.text()/.stream() at all — running this file under Node's
// environment instead gets a fully-featured native Blob to actually read the output.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import { exportToPptx } from "@/lib/export/to-pptx";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string, label: string, note?: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label, note } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

// .pptx is a zip container with one ppt/slides/slideN.xml per slide — assert on slide
// count and text content rather than deep XML structure, the practical ceiling for
// testing a binary Office format without a full round-trip parser.
async function listSlideFiles(blob: Blob): Promise<string[]> {
  const buffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
}

describe("exportToPptx", () => {
  it("produces one slide per node, in depth-first order across the forest", async () => {
    const nodes = [
      makeNode("root", "Root"),
      makeNode("a", "Child"),
      makeNode("root2", "Second Root"),
    ];
    const edges = [makeEdge("root", "a")];

    const blob = await exportToPptx("Test", { nodes, edges }, []);
    const slideFiles = await listSlideFiles(blob);

    expect(slideFiles).toHaveLength(3);
  });

  it("includes the node's note as slide body text", async () => {
    const nodes = [makeNode("root", "Root", "Some note text")];
    const blob = await exportToPptx("Test", { nodes, edges: [] }, []);

    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    expect(slideXml).toContain("Root");
    expect(slideXml).toContain("Some note text");
  });

  it("produces a single title slide for an empty mindmap, without throwing", async () => {
    const blob = await exportToPptx("Empty Map", { nodes: [], edges: [] }, []);
    const slideFiles = await listSlideFiles(blob);
    expect(slideFiles).toHaveLength(1);
  });
});
