// @vitest-environment node
//
// docx/to-docx.ts touches no DOM APIs, and jsdom's own Blob shim in this environment
// has no .arrayBuffer()/.text()/.stream() at all — running this file under Node's
// environment instead gets a fully-featured native Blob to actually read the output.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import { exportToDocx } from "@/lib/export/to-docx";
import type { MindmapNode, MindmapEdge } from "@/types/mindmap";

function makeNode(id: string, label: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x: 0, y: 0 }, data: { label } };
}
function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

// .docx is a zip container — assert on structure (heading count, presence of every
// node's text) rather than deep XML content, which is the practical ceiling for
// testing a binary Office format without a full round-trip parser.
async function readDocumentXml(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("word/document.xml missing from docx output");
  return xml;
}

describe("exportToDocx", () => {
  it("produces a valid, non-empty docx blob", async () => {
    const nodes = [makeNode("root", "Root Idea")];
    const blob = await exportToDocx("Test", { nodes, edges: [] });

    expect(blob.size).toBeGreaterThan(0);
    const xml = await readDocumentXml(blob);
    expect(xml).toContain("Root Idea");
  });

  it("uses one Heading1 per primary idea, not a hard section break, for a multi-root forest", async () => {
    const nodes = [makeNode("root1", "First Idea"), makeNode("root2", "Second Idea")];
    const blob = await exportToDocx("Test", { nodes, edges: [] });
    const xml = await readDocumentXml(blob);

    const heading1Count = (xml.match(/Heading1/g) ?? []).length;
    expect(heading1Count).toBe(2);
    expect(xml).toContain("First Idea");
    expect(xml).toContain("Second Idea");
    // No hard section break — exactly one <w:sectPr> (the doc's own trailing section
    // properties), not one per root.
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(1);
  });

  it("maps depth to increasing heading levels for a nested tree", async () => {
    const nodes = [makeNode("root", "Root"), makeNode("a", "Child"), makeNode("a1", "Grandchild")];
    const edges = [makeEdge("root", "a"), makeEdge("a", "a1")];
    const blob = await exportToDocx("Test", { nodes, edges });
    const xml = await readDocumentXml(blob);

    expect(xml).toContain("Heading1");
    expect(xml).toContain("Heading2");
    expect(xml).toContain("Heading3");
  });

  it("produces a single empty paragraph for an empty mindmap, without throwing", async () => {
    const blob = await exportToDocx("Empty", { nodes: [], edges: [] });
    expect(blob.size).toBeGreaterThan(0);
  });
});
