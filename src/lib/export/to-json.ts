import type { MindmapContent } from "@/types/mindmap";

export interface MindmapJsonExport {
  version: 1;
  title: string;
  content: MindmapContent;
}

export function exportToJson(title: string, content: MindmapContent): string {
  const payload: MindmapJsonExport = { version: 1, title, content };
  return JSON.stringify(payload, null, 2);
}
