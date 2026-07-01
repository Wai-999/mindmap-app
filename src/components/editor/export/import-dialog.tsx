"use client";

import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorStore } from "@/store/editor-store";
import { parseJsonImport } from "@/lib/export/from-json";
import { importFromMarkdown } from "@/lib/export/from-markdown";
import type { MindmapContent } from "@/types/mindmap";

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [markdownText, setMarkdownText] = useState("");
  const replaceContent = useEditorStore((s) => s.replaceContent);

  function finish(content: MindmapContent) {
    replaceContent(content.nodes, content.edges);
    toast.success("Imported — your previous canvas is one Undo away.");
    setOpen(false);
    setJsonText("");
    setMarkdownText("");
  }

  function handleImportJson() {
    try {
      finish(parseJsonImport(jsonText).content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't import that JSON.");
    }
  }

  function handleImportMarkdown() {
    try {
      finish(importFromMarkdown(markdownText));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't import that outline.");
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>, kind: "json" | "markdown") {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      if (kind === "json") setJsonText(text);
      else setMarkdownText(text);
    });
    e.target.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Import"
          title="Import"
        >
          <Upload className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import into this mindmap</DialogTitle>
          <DialogDescription>
            This replaces the current canvas — your previous version stays one Undo away.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="markdown">
          <TabsList className="w-full">
            <TabsTrigger value="markdown" className="flex-1">
              Markdown outline
            </TabsTrigger>
            <TabsTrigger value="json" className="flex-1">
              JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="markdown" className="flex flex-col gap-2">
            <Textarea
              rows={10}
              placeholder={"- Main idea\n  - Sub idea\n    - Detail"}
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <input
                type="file"
                accept=".md,.txt"
                onChange={(e) => handleFileChange(e, "markdown")}
                className="text-muted-foreground min-w-0 flex-1 text-xs"
              />
              <Button onClick={handleImportMarkdown} disabled={!markdownText.trim()}>
                Import
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="json" className="flex flex-col gap-2">
            <Textarea
              rows={10}
              placeholder='{"nodes": [...], "edges": [...]}'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleFileChange(e, "json")}
                className="text-muted-foreground min-w-0 flex-1 text-xs"
              />
              <Button onClick={handleImportJson} disabled={!jsonText.trim()}>
                Import
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
