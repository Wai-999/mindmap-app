"use client";

import { useReactFlow } from "@xyflow/react";
import { Download, FileJson, FileText, Image as ImageIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { exportCanvasAsImage } from "@/lib/export/to-image";
import { exportToJson } from "@/lib/export/to-json";
import { exportToMarkdown } from "@/lib/export/to-markdown";
import { downloadTextFile, slugifyFilename } from "@/lib/export/download";

export function ExportMenu() {
  const title = useEditorStore((s) => s.title);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const reactFlowInstance = useReactFlow();

  const filename = slugifyFilename(title);

  async function handleExportImage(format: "png" | "svg") {
    await exportCanvasAsImage(reactFlowInstance, format, filename);
  }

  function handleExportJson() {
    downloadTextFile(`${filename}.json`, exportToJson(title, { nodes, edges }), "application/json");
  }

  function handleExportMarkdown() {
    downloadTextFile(`${filename}.md`, exportToMarkdown({ nodes, edges }), "text/markdown");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Export"
          title="Export"
        >
          <Download className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onClick={() => handleExportImage("png")}>
          <ImageIcon /> Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportImage("svg")}>
          <ImageIcon /> Export as SVG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJson}>
          <FileJson /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMarkdown}>
          <FileText /> Export as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
