import { mindmapContentSchema } from "@/lib/validations/mindmap";
import type { MindmapContent } from "@/types/mindmap";

// Bumped whenever the stored envelope needs an explicit upcast step in
// decodeContent below (e.g. a breaking change to the node/edge shape) — plain
// additive/optional fields don't need a bump, since the existing zod schema
// already reads those as absent.
export const CONTENT_FORMAT_VERSION = 1;

// Thrown by decodeContent for anything it can't confidently read as real
// content. Callers MUST surface this as an actual error (a page error boundary,
// or a 500 API response) rather than substituting an empty mindmap — silently
// doing that would let the very next autosave overwrite the real, still-intact
// stored row with that empty content the moment the user made any edit at all.
export class MindmapContentDecodeError extends Error {
  constructor(cause?: unknown) {
    super("Mindmap content could not be decoded");
    this.name = "MindmapContentDecodeError";
    this.cause = cause;
  }
}

export function encodeContent(content: MindmapContent): string {
  return JSON.stringify({ version: CONTENT_FORMAT_VERSION, content });
}

// Every mindmap saved before this versioned envelope existed has its raw
// {nodes, edges, viewport} shape stored directly at the top level (no `version`
// key) — falling back to reading it that way keeps those rows loading exactly
// as they always did, with no migration step required.
export function decodeContent(raw: string): MindmapContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new MindmapContentDecodeError(cause);
  }

  const envelope = parsed as { version?: unknown; content?: unknown } | null;
  const candidate =
    envelope && typeof envelope === "object" && "version" in envelope ? envelope.content : parsed;

  const result = mindmapContentSchema.safeParse(candidate);
  if (!result.success) throw new MindmapContentDecodeError(result.error);
  return result.data;
}
