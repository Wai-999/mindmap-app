import type { MindmapContent } from "@/types/mindmap";

export const NODE_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
] as const;

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 44;

export function emptyMindmapContent(): MindmapContent {
  return { nodes: [], edges: [] };
}

export function createSeedContent(rootLabel = "Main Idea"): MindmapContent {
  return {
    nodes: [
      {
        id: "root",
        type: "mindmapNode",
        position: { x: 0, y: 0 },
        data: { label: rootLabel, color: NODE_COLORS[0] },
      },
    ],
    edges: [],
  };
}
