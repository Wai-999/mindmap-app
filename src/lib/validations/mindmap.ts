import { z } from "zod";

export const nodeDataSchema = z.object({
  label: z.string().max(2000),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  collapsed: z.boolean().optional(),
});

export const mindmapNodeSchema = z.object({
  id: z.string(),
  // @xyflow/react's Node<T, "mindmapNode"> requires `type` as a non-optional literal
  // (unlike Edge<T, "mindmapEdge">, which keeps it optional) — required here to match.
  type: z.literal("mindmapNode"),
  position: z.object({ x: z.number(), y: z.number() }),
  data: nodeDataSchema,
});

export const edgeDataSchema = z.object({
  depth: z.number().optional(),
  colorOverride: z.string().max(20).optional(),
});

export const mindmapEdgeSchema = z.object({
  id: z.string(),
  type: z.literal("mindmapEdge").optional(),
  source: z.string(),
  target: z.string(),
  data: edgeDataSchema.optional(),
});

export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

// Capped array sizes double as basic DoS hardening for the autosave endpoint.
export const mindmapContentSchema = z.object({
  nodes: z.array(mindmapNodeSchema).max(2000),
  edges: z.array(mindmapEdgeSchema).max(4000),
  viewport: viewportSchema.optional(),
});

export type MindmapContentInput = z.infer<typeof mindmapContentSchema>;

export const createMindmapSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const updateMindmapSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: mindmapContentSchema.optional(),
  // ISO timestamp of the version the client last synced. Required (and enforced) only
  // when `content` is present — see lib/mindmap/update-content.ts. Title-only requests
  // (e.g. a dashboard rename) skip the concurrency check entirely since they can't
  // clobber someone else's in-progress canvas edits.
  clientUpdatedAt: z.string().optional(),
  // Size-capped base64 data URL; oversized thumbnails are dropped, not rejected —
  // see the PATCH handler.
  thumbnail: z.string().max(200_000).nullable().optional(),
});
