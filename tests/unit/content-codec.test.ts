import { describe, it, expect } from "vitest";

import {
  encodeContent,
  decodeContent,
  MindmapContentDecodeError,
  CONTENT_FORMAT_VERSION,
} from "@/lib/mindmap/content-codec";
import type { MindmapContent } from "@/types/mindmap";

const sampleContent: MindmapContent = {
  nodes: [{ id: "root", type: "mindmapNode", position: { x: 0, y: 0 }, data: { label: "Root" } }],
  edges: [],
};

describe("content-codec (versioned envelope, never fails open)", () => {
  it("round-trips content through encode/decode", () => {
    const encoded = encodeContent(sampleContent);
    expect(decodeContent(encoded)).toEqual(sampleContent);
  });

  it("writes a versioned envelope, not the bare content", () => {
    const encoded = encodeContent(sampleContent);
    const parsed = JSON.parse(encoded);
    expect(parsed.version).toBe(CONTENT_FORMAT_VERSION);
    expect(parsed.content).toEqual(sampleContent);
  });

  it("still reads pre-versioning rows (bare content, no envelope) for backward compatibility", () => {
    const legacyRaw = JSON.stringify(sampleContent);
    expect(decodeContent(legacyRaw)).toEqual(sampleContent);
  });

  it("throws MindmapContentDecodeError on invalid JSON, instead of silently returning empty content", () => {
    expect(() => decodeContent("not json{{{")).toThrow(MindmapContentDecodeError);
  });

  it("throws MindmapContentDecodeError when the bare content fails schema validation", () => {
    expect(() => decodeContent(JSON.stringify({ nodes: "not an array" }))).toThrow(
      MindmapContentDecodeError,
    );
  });

  it("throws MindmapContentDecodeError when the enveloped content fails schema validation", () => {
    const badEnvelope = JSON.stringify({ version: CONTENT_FORMAT_VERSION, content: { nodes: 123 } });
    expect(() => decodeContent(badEnvelope)).toThrow(MindmapContentDecodeError);
  });
});
