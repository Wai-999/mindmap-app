"use client";

import { useEffect, useState } from "react";
import { X, Paperclip, Upload, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AttachmentRecord {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface NodeInspectorPanelProps {
  // Base API path for this mindmap — /api/mindmaps/{id} for the owner, or
  // /api/shared/{token} for a share-link visitor. /attachments is appended to it.
  endpoint: string;
}

// Side panel for a single node's "content richness" fields — note, task, attachments —
// toggled open via the "i" button on mindmap-node.tsx. Rendered once per editor shell,
// not per node, reading which node is open from the store.
export function NodeInspectorPanel({ endpoint }: NodeInspectorPanelProps) {
  const nodeId = useEditorStore((s) => s.inspectorNodeId);
  const node = useEditorStore((s) => s.nodes.find((n) => n.id === s.inspectorNodeId));
  const readOnly = useEditorStore((s) => s.readOnly);
  const setInspectorNode = useEditorStore((s) => s.setInspectorNode);
  const updateNodeNote = useEditorStore((s) => s.updateNodeNote);
  const updateNodeTask = useEditorStore((s) => s.updateNodeTask);

  const [noteDraft, setNoteDraft] = useState("");
  const [previewNote, setPreviewNote] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setNoteDraft(node?.data.note ?? "");
    setPreviewNote(false);
    // Intentionally scoped to nodeId only — this should reset the draft when
    // switching which node is inspected, not on every keystroke of the note itself
    // (note is only committed back to the store on blur, see the Textarea below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  useEffect(() => {
    if (!nodeId) return;
    fetch(`${endpoint}/attachments?nodeId=${nodeId}`)
      .then((res) => (res.ok ? res.json() : { attachments: [] }))
      .then((data: { attachments?: AttachmentRecord[] }) => setAttachments(data.attachments ?? []))
      .catch(() => setAttachments([]));
  }, [nodeId, endpoint]);

  if (!nodeId || !node) return null;

  async function handleUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("nodeId", nodeId!);
    formData.append("file", file);
    try {
      const res = await fetch(`${endpoint}/attachments`, { method: "POST", body: formData });
      if (res.ok) {
        const data = (await res.json()) as { attachment: AttachmentRecord };
        setAttachments((prev) => [...prev, data.attachment]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(attachmentId: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    await fetch(`${endpoint}/attachments/${attachmentId}`, { method: "DELETE" }).catch(() => undefined);
  }

  const task = node.data.task;

  return (
    <div className="bg-card absolute top-0 right-0 z-20 flex h-full w-80 flex-col border-l shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="truncate text-sm font-medium">{node.data.label || "Untitled idea"}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => setInspectorNode(null)}
          aria-label="Close inspector"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">Note</span>
            {noteDraft && (
              <button
                type="button"
                className="text-muted-foreground text-xs underline"
                onClick={() => setPreviewNote((v) => !v)}
              >
                {previewNote ? "Edit" : "Preview"}
              </button>
            )}
          </div>
          {previewNote ? (
            <div className="min-h-24 space-y-2 rounded-md border px-3 py-2 text-sm break-words [&_a]:underline [&_strong]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown>{noteDraft || "*No note*"}</ReactMarkdown>
            </div>
          ) : (
            <Textarea
              value={noteDraft}
              disabled={readOnly}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => updateNodeNote(nodeId, noteDraft)}
              placeholder="Add a note (Markdown supported)…"
              className="min-h-24 text-sm"
            />
          )}
        </section>

        <section className="space-y-2">
          <span className="text-muted-foreground text-xs font-medium">Task</span>
          <div className="flex items-center gap-2">
            <Switch
              checked={task?.done ?? false}
              disabled={readOnly}
              onCheckedChange={(done) => updateNodeTask(nodeId, { ...task, done })}
            />
            <span className="text-sm">{task?.done ? "Done" : "Not started"}</span>
          </div>
          {task ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                disabled={readOnly}
                value={task.dueDate ?? ""}
                onChange={(e) =>
                  updateNodeTask(nodeId, { ...task, dueDate: e.target.value || undefined })
                }
                className="h-8 text-xs"
              />
              <Select
                value={task.priority ?? "none"}
                disabled={readOnly}
                onValueChange={(v) =>
                  updateNodeTask(nodeId, {
                    ...task,
                    priority: v === "none" ? undefined : (v as "low" | "medium" | "high"),
                  })
                }
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            !readOnly && (
              <Button variant="outline" size="sm" onClick={() => updateNodeTask(nodeId, { done: false })}>
                Add due date / priority
              </Button>
            )
          )}
        </section>

        <section className="space-y-2">
          <span className="text-muted-foreground text-xs font-medium">Attachments</span>
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1.5 truncate hover:underline"
                >
                  <Paperclip className="size-3 shrink-0" />
                  <span className="truncate">{a.name}</span>
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    aria-label={`Remove ${a.name}`}
                  >
                    <Trash2 className="text-muted-foreground hover:text-destructive size-3" />
                  </button>
                )}
              </li>
            ))}
            {attachments.length === 0 && (
              <li className="text-muted-foreground text-xs">No attachments yet</li>
            )}
          </ul>
          {!readOnly && (
            <label
              className={cn(
                "text-muted-foreground hover:bg-accent flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed py-2 text-xs",
                uploading && "pointer-events-none opacity-50",
              )}
            >
              <Upload className="size-3.5" />
              {uploading ? "Uploading…" : "Upload file"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </section>
      </div>
    </div>
  );
}
