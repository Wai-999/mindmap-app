import { describe, it, expect } from "vitest";

import { TEMPLATES, getTemplate } from "@/lib/mindmap/templates";
import { mindmapContentSchema } from "@/lib/validations/mindmap";
import { getRootNodes } from "@/lib/mindmap/tree-utils";

describe("mindmap templates", () => {
  it("exposes a non-empty set with unique ids", () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template builds content that passes the content schema", () => {
    for (const template of TEMPLATES) {
      const content = template.build();
      const result = mindmapContentSchema.safeParse(content);
      expect(result.success, `${template.id} should be valid content`).toBe(true);
    }
  });

  it("every template has exactly one root and connects each child to it", () => {
    for (const template of TEMPLATES) {
      const { nodes, edges } = template.build();
      expect(getRootNodes(nodes, edges), `${template.id} single root`).toHaveLength(1);
      // Every non-root node has an incoming hierarchy edge (no orphans).
      const targets = new Set(edges.map((e) => e.target));
      for (const node of nodes) {
        if (node.id !== "root") expect(targets.has(node.id)).toBe(true);
      }
    }
  });

  it("getTemplate resolves a known id and returns undefined for an unknown one", () => {
    expect(getTemplate(TEMPLATES[0].id)?.id).toBe(TEMPLATES[0].id);
    expect(getTemplate("does-not-exist")).toBeUndefined();
  });
});
