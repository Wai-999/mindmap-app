import type { MindmapContent } from "@/types/mindmap";
import { walkForestPreOrder } from "@/lib/mindmap/walk-tree";

// Depth -> Word heading level. One Heading1 per primary idea, not a hard section
// break — keeps this structurally analogous to how to-markdown.ts already treats
// multiple roots as a flat run of depth-0 bullets, rather than introducing a concept
// (sections) that doesn't exist anywhere else in the export story. Beyond the deepest
// heading level, later depths fall back to an indented bullet paragraph.
//
// Dynamically imported — docx is a fairly large dependency only needed when a user
// actually exports to Word, so it's kept out of the editor's main bundle.
export async function exportToDocx(title: string, content: MindmapContent): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");

  const HEADING_LEVELS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ] as const;

  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  walkForestPreOrder(content.nodes, content.edges, (node, depth) => {
    const text = node.data.label || "Untitled";
    const headingLevel = HEADING_LEVELS[depth];

    paragraphs.push(
      headingLevel
        ? new Paragraph({ text, heading: headingLevel })
        : new Paragraph({ text: `• ${text}`, indent: { left: depth * 360 } }),
    );
  });

  const doc = new Document({
    title,
    sections: [{ children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: "" })] }],
  });

  return Packer.toBlob(doc);
}
