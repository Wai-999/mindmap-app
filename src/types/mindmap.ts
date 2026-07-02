import type { Node, Edge } from "@xyflow/react";
import type { z } from "zod";

import type {
  nodeDataSchema,
  nodeShapeSchema,
  nodeSizeSchema,
  edgeDataSchema,
  mindmapContentSchema,
} from "@/lib/validations/mindmap";

export type MindmapNodeData = z.infer<typeof nodeDataSchema>;
export type NodeShape = z.infer<typeof nodeShapeSchema>;
export type NodeSize = z.infer<typeof nodeSizeSchema>;
export type MindmapEdgeData = z.infer<typeof edgeDataSchema>;

export type MindmapNode = Node<MindmapNodeData, "mindmapNode">;
export type MindmapEdge = Edge<MindmapEdgeData, "mindmapEdge">;

export type MindmapContent = z.infer<typeof mindmapContentSchema>;

export interface MindmapSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  thumbnail: string | null;
  folderId: string | null;
  tags: TagSummary[];
}

export interface FolderSummary {
  id: string;
  name: string;
}

export interface TagSummary {
  id: string;
  name: string;
}

export interface AttachmentRecord {
  id: string;
  nodeId: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}
