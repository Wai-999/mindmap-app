"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { useEditorStore } from "@/store/editor-store";
import { exportToSlides, type AttachmentLike } from "@/lib/mindmap/to-slides";
import { Button } from "@/components/ui/button";

interface PresentationOverlayProps {
  endpoint: string;
  onClose: () => void;
}

// Full-screen slideshow, one slide per node in depth-first order across every primary
// idea (see lib/mindmap/to-slides.ts, shared with Phase 14's PPTX export). Reads
// nodes/edges live from the store, so edits made while presenting show up immediately.
export function PresentationOverlay({ endpoint, onClose }: PresentationOverlayProps) {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const [attachments, setAttachments] = useState<AttachmentLike[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch(`${endpoint}/attachments`)
      .then((res) => (res.ok ? res.json() : { attachments: [] }))
      .then((data: { attachments?: AttachmentLike[] }) => setAttachments(data.attachments ?? []))
      .catch(() => setAttachments([]));
  }, [endpoint]);

  const slides = useMemo(() => exportToSlides({ nodes, edges }, attachments), [nodes, edges, attachments]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <span className="text-muted-foreground text-sm">
          {index + 1} / {slides.length}
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Exit presentation">
          <X className="size-5" />
        </Button>
      </div>

      {/* Click-to-advance area — a plain div, not a <button>, since it contains the
          prev/next buttons below and nesting interactive elements is invalid HTML.
          Keyboard navigation (arrows/space/escape) is handled globally above. */}
      <div
        className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 px-12 text-center"
        onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
      >
        <h1 className="text-4xl font-semibold text-balance">{slide.label}</h1>
        {slide.imageAttachmentUrl && (
          // Attachment origin is this app's own API route, not a remote source worth
          // routing through next/image's optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.imageAttachmentUrl}
            alt=""
            className="max-h-64 rounded-lg object-contain shadow-sm"
          />
        )}
        {slide.note && (
          <div className="text-muted-foreground max-w-2xl text-left text-lg break-words [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown>{slide.note}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-6">
        <Button
          variant="outline"
          size="icon"
          disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i - 1);
          }}
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={index === slides.length - 1}
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i + 1);
          }}
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
