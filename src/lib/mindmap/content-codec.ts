import { mindmapContentSchema } from "@/lib/validations/mindmap";
import type { MindmapContent } from "@/types/mindmap";
import { emptyMindmapContent } from "@/lib/mindmap/defaults";

export function encodeContent(content: MindmapContent): string {
  return JSON.stringify(content);
}

// Never throws — a corrupt/unreadable row degrades to an empty canvas rather than a
// hard 500, since there's no way for the user to recover a raw DB value anyway.
export function decodeContent(raw: string): MindmapContent {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = mindmapContentSchema.safeParse(parsed);
    return result.success ? result.data : emptyMindmapContent();
  } catch {
    return emptyMindmapContent();
  }
}
