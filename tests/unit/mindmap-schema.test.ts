import { describe, it, expect } from "vitest";

import { nodeDataSchema, mindmapNodeSchema } from "@/lib/validations/mindmap";

describe("nodeDataSchema (note/task fields)", () => {
  it("accepts a node with no note/task (both optional)", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea" }).success).toBe(true);
  });

  it("accepts a valid note and task", () => {
    const result = nodeDataSchema.safeParse({
      label: "Idea",
      note: "Some **markdown** note",
      task: { done: false, dueDate: "2026-08-01", priority: "high" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a task with only the required `done` field", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", task: { done: true } }).success).toBe(true);
  });

  it("rejects a note longer than the cap", () => {
    const result = nodeDataSchema.safeParse({ label: "Idea", note: "x".repeat(10_001) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid task priority", () => {
    const result = nodeDataSchema.safeParse({
      label: "Idea",
      task: { done: false, priority: "urgent" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a task missing the required `done` field", () => {
    const result = nodeDataSchema.safeParse({ label: "Idea", task: { priority: "low" } });
    expect(result.success).toBe(false);
  });
});

describe("nodeDataSchema (size / imageOnly fields)", () => {
  it("accepts each valid size", () => {
    for (const size of ["small", "medium", "large"] as const) {
      expect(nodeDataSchema.safeParse({ label: "Idea", size }).success).toBe(true);
    }
  });

  it("rejects an unknown size", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", size: "huge" }).success).toBe(false);
  });

  it("accepts an imageOnly node (label kept as the filename)", () => {
    const result = nodeDataSchema.safeParse({ label: "photo.png", imageOnly: true });
    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean imageOnly", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", imageOnly: "yes" }).success).toBe(false);
  });
});

describe("nodeDataSchema (textOnly field)", () => {
  it("accepts a textOnly node", () => {
    const result = nodeDataSchema.safeParse({ label: "Just a note", textOnly: true });
    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean textOnly", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", textOnly: "yes" }).success).toBe(false);
  });
});

describe("nodeDataSchema (sticky field)", () => {
  it("accepts a sticky node", () => {
    const result = nodeDataSchema.safeParse({ label: "Remember this", sticky: true, color: "#f59e0b" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean sticky", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", sticky: "yes" }).success).toBe(false);
  });
});

describe("nodeDataSchema (fileOnly field)", () => {
  it("accepts a fileOnly node (label kept as the filename)", () => {
    const result = nodeDataSchema.safeParse({ label: "report.pdf", fileOnly: true });
    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean fileOnly", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", fileOnly: "yes" }).success).toBe(false);
  });
});

describe("nodeDataSchema (expanded shape library)", () => {
  it("accepts every shape, including the newly added polygon ones", () => {
    const shapes = [
      "rounded",
      "rectangle",
      "pill",
      "diamond",
      "triangle",
      "pentagon",
      "parallelogram",
      "chevron",
    ] as const;
    for (const shape of shapes) {
      expect(nodeDataSchema.safeParse({ label: "Idea", shape }).success).toBe(true);
    }
  });

  it("rejects an unknown shape", () => {
    expect(nodeDataSchema.safeParse({ label: "Idea", shape: "hexagon" }).success).toBe(false);
  });
});

describe("mindmapNodeSchema (explicit width/height from resizing)", () => {
  const base = {
    id: "n1",
    type: "mindmapNode" as const,
    position: { x: 0, y: 0 },
    data: { label: "x" },
  };

  it("accepts a node with no width/height (content-sized, the common case)", () => {
    expect(mindmapNodeSchema.safeParse(base).success).toBe(true);
  });

  it("preserves width/height through a parse (so a resize survives save/reload)", () => {
    const result = mindmapNodeSchema.safeParse({ ...base, width: 320, height: 180 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBe(320);
      expect(result.data.height).toBe(180);
    }
  });

  it("rejects a non-positive dimension", () => {
    expect(mindmapNodeSchema.safeParse({ ...base, width: 0, height: 100 }).success).toBe(false);
    expect(mindmapNodeSchema.safeParse({ ...base, width: -5, height: 100 }).success).toBe(false);
  });
});
