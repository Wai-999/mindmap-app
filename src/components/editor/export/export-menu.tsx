"use client";

import { useReactFlow } from "@xyflow/react";
import { Download, FileJson, FileText, Image as ImageIcon, FileType } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { exportCanvasAsImage } from "@/lib/export/to-image";
import { exportCanvasAsPdf } from "@/lib/export/to-pdf";
import { exportToJson } from "@/lib/export/to-json";
import { exportToMarkdown } from "@/lib/export/to-markdown";
import { exportToDocx } from "@/lib/export/to-docx";
import { exportToPptx } from "@/lib/export/to-pptx";
import { downloadTextFile, downloadBlob, slugifyFilename } from "@/lib/export/download";
import type { AttachmentLike } from "@/lib/mindmap/to-slides";

interface ExportMenuProps {
  // Base API path for this mindmap — needed to fetch attachments for the PPTX export
  // (image slides). The other formats only need local editor-store content.
  endpoint: string;
}

export function ExportMenu({ endpoint }: ExportMenuProps) {
  const title = useEditorStore((s) => s.title);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const reactFlowInstance = useReactFlow();

  const filename = slugifyFilename(title);

  async function handleExportImage(format: "png" | "svg") {
    await exportCanvasAsImage(reactFlowInstance, format, filename);
  }

  async function handleExportPdf() {
    await exportCanvasAsPdf(reactFlowInstance, filename);
  }

  function handleExportJson() {
    downloadTextFile(`${filename}.json`, exportToJson(title, { nodes, edges }), "application/json");
  }

  function handleExportMarkdown() {
    downloadTextFile(`${filename}.md`, exportToMarkdown({ nodes, edges }), "text/markdown");
  }

  async function handleExportDocx() {
    const blob = await exportToDocx(title, { nodes, edges });
    downloadBlob(`${filename}.docx`, blob);
  }

  async function handleExportPptx() {
    const attachments = await fetch(`${endpoint}/attachments`)
      .then((res) => (res.ok ? res.json() : { attachments: [] }))
      .then((data: { attachments?: AttachmentLike[] }) => data.attachments ?? [])
      .catch(() => [] as AttachmentLike[]);
    const blob = await exportToPptx(title, { nodes, edges }, attachments);
    downloadBlob(`${filename}.pptx`, blob);
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
        <DropdownMenuItem onClick={handleExportPdf}>
          <FileType /> Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJson}>
          <FileJson /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMarkdown}>
          <FileText /> Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportDocx}>
          <FileText /> Export as Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPptx}>
          <FileType /> Export as PowerPoint (.pptx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
