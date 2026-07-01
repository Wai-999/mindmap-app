import { mindmapContentSchema } from "@/lib/validations/mindmap";
import type { MindmapContent } from "@/types/mindmap";

export interface ParsedJsonImport {
  title?: string;
  content: MindmapContent;
}

// Accepts either our own { version, title, content } export shape, or a bare
// { nodes, edges } content object (e.g. hand-authored or from another tool) —
// validated against the same schema the server enforces, so a malformed file fails
// with a clear error instead of silently corrupting the canvas.
export function parseJsonImport(raw: string): ParsedJsonImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like valid JSON.");
  }

  const wrapped = data as { content?: unknown; title?: unknown } | null;
  const contentCandidate = wrapped && typeof wrapped === "object" && "content" in wrapped
    ? wrapped.content
    : data;

  const parsed = mindmapContentSchema.safeParse(contentCandidate);
  if (!parsed.success) {
    throw new Error("This JSON doesn't match the expected mindmap format.");
  }

  const title = wrapped && typeof wrapped.title === "string" ? wrapped.title : undefined;
  return { title, content: parsed.data };
}
