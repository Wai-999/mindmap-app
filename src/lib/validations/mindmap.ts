import { z } from "zod";

export const taskSchema = z.object({
  done: z.boolean(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

// Absent/"rounded" is the original mindmap look (rounded rectangle). The other three
// cover standard flowchart notation — rectangle (process), pill (start/end
// terminator), diamond (decision) — without forcing that vocabulary on anyone who
// just wants plain mind-mapping.
export const nodeShapeSchema = z.enum(["rounded", "rectangle", "pill", "diamond"]);

// Absent/"medium" is the original node scale. "small"/"large" scale the card's text
// and width together so a mindmap can visually rank ideas (a big central concept vs.
// small supporting details) without changing any of the tree/link semantics.
export const nodeSizeSchema = z.enum(["small", "medium", "large"]);

export const nodeDataSchema = z.object({
  label: z.string().max(2000),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  collapsed: z.boolean().optional(),
  shape: nodeShapeSchema.optional(),
  size: nodeSizeSchema.optional(),
  // Renders the node as just its uploaded image (no label row, color dot, or card
  // chrome) — set when a node is created via "Add image". It's still an ordinary
  // node otherwise (draggable, connectable, deletable), and keeps its label (the
  // original filename) for the outline view, exports, and accessibility.
  imageOnly: z.boolean().optional(),
  // Markdown-capable free text, rendered via react-markdown in the inspector panel
  // and presentation mode. Capped for the same DoS-hardening reason array sizes are.
  note: z.string().max(10_000).optional(),
  task: taskSchema.optional(),
});

export const mindmapNodeSchema = z.object({
  id: z.string(),
  // @xyflow/react's Node<T, "mindmapNode"> requires `type` as a non-optional literal
  // (unlike Edge<T, "mindmapEdge">, which keeps it optional) — required here to match.
  type: z.literal("mindmapNode"),
  position: z.object({ x: z.number(), y: z.number() }),
  // Explicit rendered dimensions, set only when a node is manually resized (currently
  // image nodes, via NodeResizer). React Flow stores these as top-level Node props, so
  // they live here rather than in `data`; capped for the same DoS reason array sizes
  // are. Absent = content-sized (every text node, and an image node until first resize).
  width: z.number().positive().max(10_000).optional(),
  height: z.number().positive().max(10_000).optional(),
  data: nodeDataSchema,
});

export const edgeDataSchema = z.object({
  depth: z.number().optional(),
  colorOverride: z.string().max(20).optional(),
  // Absent/"hierarchy" = a structural parent→child edge (drives layout, export, and
  // subtree delete/collapse). "link" = a free-form relationship line the user drew by
  // dragging between two nodes' handles — purely cosmetic, ignored by every tree-utils
  // helper so it never affects layout, forest-root detection, or cascade delete.
  kind: z.enum(["hierarchy", "link"]).optional(),
});

export const mindmapEdgeSchema = z.object({
  id: z.string(),
  type: z.literal("mindmapEdge").optional(),
  source: z.string(),
  target: z.string(),
  // Which side of the node the connector was dragged from/to (e.g. "top", "bottom") —
  // only ever set on "link" edges, since hierarchy edges always use the default
  // Left/Right handles and render fine without an explicit handle id.
  sourceHandle: z.string().max(20).nullable().optional(),
  targetHandle: z.string().max(20).nullable().optional(),
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
  // Optional starter template id (see lib/mindmap/templates.ts). An unknown id is
  // simply ignored by the create route, which falls back to the default seed.
  templateId: z.string().max(50).optional(),
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
