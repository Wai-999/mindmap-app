import { describe, it, expect } from "vitest";

import { nodeDataSchema } from "@/lib/validations/mindmap";

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
