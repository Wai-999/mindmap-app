"use client";

import { memo, useEffect, useRef } from "react";
import { Handle, Position, NodeResizer, useConnection, type NodeProps } from "@xyflow/react";
import {
  ChevronRight,
  Info,
  StickyNote,
  CheckSquare,
  Square,
  ImageIcon,
  File as FileIcon,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import type { MindmapNode as MindmapNodeType, NodeSize } from "@/types/mindmap";
import { useEditorStore } from "@/store/editor-store";
import { getChildIds, getDescendantIds } from "@/lib/mindmap/tree-utils";
import { useRemoteSelectors } from "@/components/editor/collab/use-remote-selectors";
import { consumeEditClickPoint } from "@/lib/mindmap/canvas-cursor";
import { cn } from "@/lib/utils";

// A freshly-focused contentEditable places its caret at the browser's own default
// spot (typically the very start), ignoring wherever the double-click that opened
// editing actually landed — jarring when editing the middle of a longer label.
// Reproduces the click here instead, once the element is actually focused and
// consumeEditClickPoint has a point to give (nothing to do for a keyboard-triggered
// edit, e.g. Enter on a selected node, which never recorded one). Both APIs are
// declared non-optional in this project's lib.dom.d.ts, but no engine ships both —
// Chromium/WebKit have caretRangeFromPoint, Firefox has the standards-track
// caretPositionFromPoint — hence the runtime `typeof` checks rather than trusting
// the types.
function placeCaretAtClickPoint(el: HTMLElement) {
  const point = consumeEditClickPoint();
  if (!point) return;

  const selection = window.getSelection();
  if (!selection) return;

  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(point.x, point.y);
    if (!range || !el.contains(range.startContainer)) return;
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(point.x, point.y);
    if (!pos || !el.contains(pos.offsetNode)) return;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// One invisible ~10px strip per side, together covering the node's whole border.
// Inline styles (not classes) because they must override React Flow's default handle
// CSS (6px dot, 50% offset, translate centering) property-for-property.
const STRIP_BASE: React.CSSProperties = {
  position: "absolute",
  transform: "none",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  cursor: "crosshair",
};

const HANDLE_STRIPS: { id: string; position: Position; style: React.CSSProperties }[] = [
  { id: "top", position: Position.Top, style: { ...STRIP_BASE, top: -5, left: 0, width: "100%", height: 10 } },
  { id: "bottom", position: Position.Bottom, style: { ...STRIP_BASE, bottom: -5, top: "auto", left: 0, width: "100%", height: 10 } },
  { id: "left", position: Position.Left, style: { ...STRIP_BASE, left: -5, top: 0, width: 10, height: "100%" } },
  { id: "right", position: Position.Right, style: { ...STRIP_BASE, right: -5, left: "auto", top: 0, width: 10, height: "100%" } },
];

// Three idea sizes scale the label text, the card's width bounds, and its padding
// together, so a node reads as visually bigger/smaller without any change to tree or
// link behavior. "medium" is the original look (unchanged from before sizes existed).
const SIZE_TEXT: Record<NodeSize, string> = { small: "text-xs", medium: "text-sm", large: "text-lg" };
const SIZE_WIDTH: Record<NodeSize, string> = {
  small: "min-w-[90px] max-w-[220px]",
  medium: "min-w-[120px] max-w-[280px]",
  large: "min-w-[170px] max-w-[400px]",
};
const SIZE_PAD: Record<NodeSize, string> = { small: "px-3 py-1.5", medium: "px-4 py-2.5", large: "px-5 py-3.5" };
// Rendered display width (px) of a standalone image node at each size — height is
// derived from the image's own aspect ratio (object-contain, capped max-height).
const SIZE_IMAGE_WIDTH: Record<NodeSize, number> = { small: 150, medium: 240, large: 360 };

// Point lists for every non-rectangular shape, in a shared 0-100 viewBox — the same
// technique already established for the diamond: an SVG polygon drawn behind the
// card's content, with preserveAspectRatio="none" so it stretches to whatever the
// node's actual (possibly manually resized) box is, rather than staying square.
const POLYGON_SHAPES = new Set(["diamond", "triangle", "pentagon", "parallelogram", "chevron"]);
const SHAPE_POINTS: Record<string, string> = {
  diamond: "50,3 97,50 50,97 3,50",
  triangle: "50,3 97,97 3,97",
  pentagon: "50,3 96,35 78,89 22,89 4,35",
  parallelogram: "20,10 100,10 80,90 0,90",
  chevron: "0,25 60,25 60,5 100,50 60,95 60,75 0,75",
};

// Perceived-brightness check (YIQ) so a sticky note's text stays legible against
// whichever palette color it's using as its full background fill — the palette
// (see NODE_COLORS) spans everything from amber to indigo, too wide a range to
// assume one text color always reads well.
function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#1f2937" : "#ffffff";
}

function MindmapNodeImpl({ id }: NodeProps<MindmapNodeType>) {
  // Selection is driven entirely by our own store (selectedNodeId), not React Flow's
  // internal node.selected flag — store actions like addChildNode change selection
  // programmatically without going through RF's click handling, so RF's own flag
  // would drift out of sync (see nodesSelectable={false} on the canvas).
  // Selection is a set now (multi-select via marquee / Cmd-click) — a node is
  // "selected" if it's anywhere in it. `.includes` returns a primitive boolean, so no
  // useShallow guard is needed.
  const selected = useEditorStore((s) => s.selectedNodeIds.includes(id));
  const label = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? "");
  const color = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.color);
  const collapsed = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.collapsed ?? false);
  const shape = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.shape ?? "rounded");
  const size = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.size ?? "medium");
  const icon = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.icon);
  const imageOnly = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.imageOnly ?? false);
  const fileOnly = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.fileOnly ?? false);
  const textOnly = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.textOnly ?? false);
  const sticky = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.sticky ?? false);
  // Explicit dimensions once an image node has been manually resized (NodeResizer
  // writes these top-level props via onNodesChange). Undefined until first resize —
  // the node is content-sized (image at its preset width) up to that point.
  const explicitWidth = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.width);
  const explicitHeight = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.height);
  const note = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.note);
  const task = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.task);
  // First image attachment only — a small cover thumbnail, not a gallery, matching
  // the note/task indicators' "presence, not full content" treatment. The full list
  // (with the rest, if any) stays in the inspector panel.
  const imageUrl = useEditorStore(
    (s) => s.attachments.find((a) => a.nodeId === id && a.mimeType.startsWith("image/"))?.url,
  );
  // A fileOnly node's own (non-image) upload — just its size, to show alongside
  // the filename already carried in the node's label.
  const fileSize = useEditorStore((s) => s.attachments.find((a) => a.nodeId === id)?.size);
  const childCount = useEditorStore((s) => getChildIds(s.edges, id).length);
  const hiddenDescendantCount = useEditorStore((s) =>
    collapsed ? getDescendantIds(s.edges, id).length : 0,
  );
  const isEditing = useEditorStore((s) => s.editingNodeId === id);
  // Colors of remote collaborators (if any) who currently have this node selected —
  // [] in solo mode. Only the first is rendered as a ring; simultaneous multi-user
  // selection of the same node is rare enough that stacking several rings isn't
  // worth the extra visual complexity.
  const remoteSelectorColors = useRemoteSelectors(id);
  // True while the user is dragging a connection that started on a DIFFERENT node —
  // used to turn this node's entire body into a drop target for the duration, so a
  // link can end anywhere on the node, not just on its border strips.
  const isConnectionTarget = useConnection(
    (c) => c.inProgress && c.fromNode?.id !== id,
  );

  const readOnly = useEditorStore((s) => s.readOnly);
  const setEditingNode = useEditorStore((s) => s.setEditingNode);
  const setInspectorNode = useEditorStore((s) => s.setInspectorNode);
  const updateNodeLabel = useEditorStore((s) => s.updateNodeLabel);
  const toggleCollapsed = useEditorStore((s) => s.toggleCollapsed);
  const commitBeforeDrag = useEditorStore((s) => s.commitBeforeDrag);
  const addDirectionalNode = useEditorStore((s) => s.addDirectionalNode);

  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing || !editableRef.current) return;
    const el = editableRef.current;
    // React Flow renders a freshly-added node with `visibility: hidden` until its
    // ResizeObserver measures it a frame or two later — focusing before then is a
    // silent no-op, so retry across frames until the focus actually lands. Budget is
    // generous (not just 2-3 frames) since real-time collaboration adds background
    // work (WebSocket messages, Storage sync) competing for the same event loop.
    let frame: number;
    let attempts = 0;
    const tryFocus = () => {
      el.focus();
      if (document.activeElement !== el) {
        if (attempts++ < 60) frame = requestAnimationFrame(tryFocus);
        return;
      }
      placeCaretAtClickPoint(el);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [isEditing, id]);

  function commitEdit() {
    const text = editableRef.current?.textContent?.trim() ?? "";
    updateNodeLabel(id, text);
    setEditingNode(null);
  }

  // Shared by both render paths: the four invisible border strips that let a
  // connection start from anywhere on the perimeter, plus the whole-node drop target
  // shown only while another node's connection drag is in progress.
  const connectionHandles = (
    <>
      {HANDLE_STRIPS.map((strip) => (
        <Handle key={strip.id} type="source" id={strip.id} position={strip.position} style={strip.style} />
      ))}
      {isConnectionTarget && (
        <Handle
          type="target"
          id="drop"
          position={Position.Left}
          isConnectableStart={false}
          style={{
            position: "absolute",
            inset: 0,
            transform: "none",
            width: "100%",
            height: "100%",
            borderRadius: 12,
            background: "transparent",
            border: "none",
            zIndex: 10,
          }}
        />
      )}
    </>
  );

  const infoButton = (
    <button
      type="button"
      className="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
      onClick={(e) => {
        e.stopPropagation();
        setInspectorNode(id);
      }}
      aria-label="Open details"
    >
      <Info className="size-3.5" />
    </button>
  );

  // One-tap "add something in this exact direction," shown only while selected —
  // complements (doesn't replace) dragging from the border strips above. Left/right
  // add a real hierarchy child on that explicit side; up/down add a link connection,
  // since the LR tree layout has no vertical-branching concept. Positioned further
  // out than the existing corner info button and the right-side collapse toggle so
  // none of the three ever overlap.
  const directionalArrows = selected && !readOnly && (
    <>
      <button
        type="button"
        className="absolute -top-9 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          addDirectionalNode(id, "up");
        }}
        aria-label="Add idea above"
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        className="absolute -bottom-9 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          addDirectionalNode(id, "down");
        }}
        aria-label="Add idea below"
      >
        <ArrowDown className="size-3.5" />
      </button>
      <button
        type="button"
        className="absolute top-1/2 -left-9 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          addDirectionalNode(id, "left");
        }}
        aria-label="Add idea to the left"
      >
        <ArrowLeft className="size-3.5" />
      </button>
      <button
        type="button"
        className="absolute top-1/2 -right-9 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          addDirectionalNode(id, "right");
        }}
        aria-label="Add idea to the right"
      >
        <ArrowRight className="size-3.5" />
      </button>
    </>
  );

  // A standalone image node: just the uploaded image (or a placeholder until the
  // upload lands), no label/dot/card chrome. Still fully a node — draggable,
  // connectable via the shared strips, selectable, deletable, and freely resizable
  // by dragging its corner handles (NodeResizer), which keeps the image's aspect
  // ratio. Until the first manual resize it's content-sized at the S/M/L preset
  // width; after, it fills the explicit width/height React Flow sets on the node.
  if (imageOnly) {
    const hasExplicitSize = explicitWidth != null && explicitHeight != null;
    return (
      <div
        className={cn("group relative", hasExplicitSize && "size-full")}
        style={{
          boxShadow: remoteSelectorColors[0]
            ? `0 0 0 2px var(--card), 0 0 0 4px ${remoteSelectorColors[0]}`
            : selected
              ? `0 0 0 2px ${color ?? "var(--primary)"}`
              : undefined,
          borderRadius: 12,
        }}
      >
        {connectionHandles}
        {imageUrl ? (
          // Private, per-node upload from local storage — never optimizable via
          // next/image's remote loader, hence a plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label || "Image"}
            // max-w-none overrides Tailwind Preflight's `img { max-width: 100% }`,
            // which would otherwise cap the image to its parent's width — and the
            // parent is shrink-to-fit around this very image, so with NodeResizer's
            // absolutely-positioned controls also present that resolves to 0 and the
            // node never measures itself out of React Flow's initial hidden state.
            className={cn(
              "block max-w-none rounded-xl object-contain",
              hasExplicitSize ? "size-full" : "max-h-[420px]",
            )}
            style={hasExplicitSize ? undefined : { width: SIZE_IMAGE_WIDTH[size] }}
            draggable={false}
          />
        ) : (
          <div
            className={cn(
              "text-muted-foreground flex items-center justify-center rounded-xl border border-dashed",
              hasExplicitSize ? "size-full" : "h-32",
            )}
            style={hasExplicitSize ? undefined : { width: SIZE_IMAGE_WIDTH[size] }}
          >
            <ImageIcon className="size-6 animate-pulse" />
          </div>
        )}
        {infoButton}
        {directionalArrows}
        {/* Rendered LAST so its corner handles sit above the connection strips in
            DOM order — the strips have pointer-events:all and would otherwise
            intercept a corner drag (starting a new connection instead of resizing).
            Handles are enlarged and given a high z-index for the same reason: the
            default 5px handle is too easily covered by the 10px-thick strips. */}
        {selected && !readOnly && (
          <NodeResizer
            color={color ?? "var(--primary)"}
            keepAspectRatio
            minWidth={60}
            minHeight={40}
            handleStyle={{ width: 12, height: 12, borderRadius: 3, zIndex: 20 }}
            // One undo entry per whole resize gesture, not one per pointer-move
            // frame — same treatment as a node drag (commitBeforeDrag on start).
            onResizeStart={commitBeforeDrag}
          />
        )}
      </div>
    );
  }

  // A generic file node: a compact chip (icon + filename + size), the non-image
  // counterpart of imageOnly — both created through the same "Add file" upload
  // button (see addFileNode), split only by whether the upload was an image. The
  // file itself lives in the usual attachments list; opening/downloading it is
  // done from there (Open details), same as any other attachment.
  if (fileOnly) {
    const bytes = fileSize ?? 0;
    const sizeLabel =
      bytes < 1024
        ? `${bytes} B`
        : bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(1)} KB`
          : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return (
      <div
        className="group relative flex items-center gap-2 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
        style={{
          borderColor: selected ? (color ?? "var(--primary)") : "transparent",
          boxShadow: remoteSelectorColors[0]
            ? `0 0 0 2px var(--card), 0 0 0 4px ${remoteSelectorColors[0]}`
            : undefined,
        }}
      >
        {connectionHandles}
        <FileIcon className="text-muted-foreground size-5 shrink-0" />
        <div className="min-w-0">
          <div className="max-w-[180px] truncate text-sm font-medium">{label || "Untitled file"}</div>
          {fileSize != null && <div className="text-muted-foreground text-xs">{sizeLabel}</div>}
        </div>
        {infoButton}
        {directionalArrows}
      </div>
    );
  }

  // A standalone free-floating text node: just the label itself, no card
  // background/border/shadow or color dot — mirrors the imageOnly branch above
  // (same "hide all chrome, keep everything else" shape). Editing works exactly
  // like the label in the main render path below (click/double-click to edit,
  // Enter/Escape to commit).
  if (textOnly) {
    const hasExplicitSize = explicitWidth != null && explicitHeight != null;
    return (
      <div
        className={cn("group relative", hasExplicitSize && "size-full")}
        style={{
          boxShadow: remoteSelectorColors[0]
            ? `0 0 0 2px var(--card), 0 0 0 4px ${remoteSelectorColors[0]}`
            : undefined,
          borderRadius: 8,
        }}
      >
        {connectionHandles}
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            className={cn(
              "leading-snug outline-none",
              SIZE_TEXT[size],
              hasExplicitSize ? "size-full" : cn("min-w-[4ch]", SIZE_WIDTH[size]),
            )}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLDivElement).blur();
              }
              e.stopPropagation();
            }}
          >
            {label}
          </div>
        ) : (
          <span
            className={cn(
              "block leading-snug break-words",
              SIZE_TEXT[size],
              hasExplicitSize ? "size-full" : SIZE_WIDTH[size],
              !label && "text-muted-foreground italic",
            )}
          >
            {label || "Empty text"}
          </span>
        )}
        {infoButton}
        {directionalArrows}
        {selected && !readOnly && (
          <NodeResizer
            color={color ?? "var(--primary)"}
            minWidth={40}
            minHeight={24}
            handleStyle={{ width: 12, height: 12, borderRadius: 3, zIndex: 20 }}
            onResizeStart={commitBeforeDrag}
          />
        )}
      </div>
    );
  }

  // A solid-color sticky note: the node's own color IS the whole visible fill,
  // full-bleed, with no card border/shadow — unlike every other node kind, where
  // color is just a small accent (dot, border, edge stroke). Text color is
  // computed for contrast against whichever palette color this note has.
  if (sticky) {
    const hasExplicitSize = explicitWidth != null && explicitHeight != null;
    const bg = color ?? "#f59e0b";
    const textColor = readableTextColor(bg);
    return (
      <div
        className={cn("group relative rounded-lg p-4", hasExplicitSize && "size-full")}
        style={{
          backgroundColor: bg,
          color: textColor,
          boxShadow: remoteSelectorColors[0]
            ? `0 0 0 2px var(--card), 0 0 0 4px ${remoteSelectorColors[0]}`
            : selected
              ? `0 0 0 2px var(--card), 0 0 0 4px ${bg}`
              : undefined,
        }}
      >
        {connectionHandles}
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            className={cn(
              "leading-snug outline-none",
              SIZE_TEXT[size],
              hasExplicitSize ? "size-full" : cn("min-w-[6ch]", SIZE_WIDTH[size]),
            )}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLDivElement).blur();
              }
              e.stopPropagation();
            }}
          >
            {label}
          </div>
        ) : (
          <span
            className={cn(
              "block leading-snug break-words",
              SIZE_TEXT[size],
              hasExplicitSize ? "size-full" : SIZE_WIDTH[size],
              !label && "italic opacity-60",
            )}
          >
            {label || "Empty note"}
          </span>
        )}
        {infoButton}
        {directionalArrows}
        {selected && !readOnly && (
          <NodeResizer
            color={textColor}
            minWidth={100}
            minHeight={80}
            handleStyle={{ width: 12, height: 12, borderRadius: 3, zIndex: 20 }}
            onResizeStart={commitBeforeDrag}
          />
        )}
      </div>
    );
  }

  const isPolygon = POLYGON_SHAPES.has(shape);
  // Same explicit-dimensions convention as the image node above: undefined until the
  // card is manually resized (NodeResizer below), content-sized via the S/M/L preset
  // up to that point. Once resized, the preset's own min/max-width bounds no longer
  // apply — the whole point of dragging a handle is to go past them either way.
  const hasExplicitSize = explicitWidth != null && explicitHeight != null;

  return (
    <div
      className={cn(
        "group relative text-card-foreground shadow-sm transition-shadow",
        hasExplicitSize ? "size-full" : SIZE_WIDTH[size],
        SIZE_TEXT[size],
        isPolygon
          ? "bg-transparent px-9 py-7"
          : cn(
              "border-2 bg-card",
              SIZE_PAD[size],
              shape === "rectangle" ? "rounded-none" : shape === "pill" ? "rounded-full" : "rounded-xl",
            ),
        selected ? "shadow-md" : "hover:shadow-md",
      )}
      style={{
        // A polygon's outline is drawn by its own SVG below instead — this div stays
        // borderless so no rectangular edge shows through its points.
        borderColor: isPolygon ? undefined : selected ? (color ?? "var(--primary)") : "transparent",
        // Ring sits outside the node's own border (a card-colored gap, then the
        // collaborator's color) so local selection and remote selection never visually
        // collide, even when both are true at once.
        boxShadow: remoteSelectorColors[0]
          ? `0 0 0 2px var(--card), 0 0 0 4px ${remoteSelectorColors[0]}`
          : undefined,
      }}
    >
      {isPolygon && (
        // A rectangular border can't follow a diagonal-edged shape, so the
        // shape/fill/stroke are drawn here instead, sized to the card's own
        // bounding box — the actual content (and the connection handles below,
        // which anchor to that same box) stays in normal, unrotated layout on top.
        <svg
          className="pointer-events-none absolute inset-0 -z-10 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            points={SHAPE_POINTS[shape]}
            className="fill-card"
            stroke={selected ? (color ?? "var(--primary)") : "transparent"}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Border-perimeter connection strips + whole-node drop target (see the
          connectionHandles definition above — shared with the image-only path). */}
      {connectionHandles}

      {imageUrl &&
        (shape === "rounded" || shape === "rectangle" ? (
          // Bleeds to the card's own edges (negative margin cancels the card's own
          // padding) and nests inside its rounding — 10px vs. the card's 12px
          // (rounded-xl) accounts for the 2px border between the two. Private,
          // per-node upload from local storage — never optimizable via next/image's
          // remote loader, hence plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className={cn(
              "-mx-4 -mt-2.5 mb-2 h-24 w-[calc(100%+2rem)] object-cover",
              shape === "rectangle" ? "rounded-none" : "rounded-t-[10px]",
            )}
          />
        ) : (
          // Pill/polygon outlines don't have a flat top edge to bleed a rectangular
          // image into — an inset thumbnail avoids the two shapes visibly clashing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="mb-2 h-16 w-full rounded-md object-cover" />
        ))}

      <div className="flex items-center gap-2">
        {icon ? (
          // An emoji/icon replaces the color dot when set — a bigger, at-a-glance
          // marker. leading-none keeps it vertically centered with the label text.
          <span className="shrink-0 text-base leading-none select-none" aria-hidden="true">
            {icon}
          </span>
        ) : (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
          />
        )}
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            className="min-w-[2ch] flex-1 leading-snug outline-none"
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLDivElement).blur();
              }
              e.stopPropagation();
            }}
          >
            {label}
          </div>
        ) : (
          <span
            className={cn(
              "flex-1 leading-snug break-words",
              !label && "text-muted-foreground italic",
            )}
          >
            {label || "Empty idea"}
          </span>
        )}
      </div>

      {(note || task) && (
        <div className="mt-1.5 flex items-center gap-2 pl-4 text-muted-foreground">
          {note && <StickyNote className="size-3" aria-label="Has a note" />}
          {task &&
            (task.done ? (
              <CheckSquare className="size-3 text-primary" aria-label="Task done" />
            ) : (
              <Square className="size-3" aria-label="Task not done" />
            ))}
        </div>
      )}

      {infoButton}

      {childCount > 0 && (
        <button
          type="button"
          className={cn(
            "absolute top-1/2 -right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground",
            collapsed && "border-primary text-primary",
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed(id);
          }}
          aria-label={collapsed ? "Expand branch" : "Collapse branch"}
        >
          {collapsed ? (
            <span className="text-[10px] font-semibold">{hiddenDescendantCount}</span>
          ) : (
            <ChevronRight className="size-3.5 -rotate-90" />
          )}
        </button>
      )}

      {/* Same treatment as the image node's resizer above: rendered LAST so its
          corner handles sit above the connection strips (which would otherwise
          intercept a corner drag as a new connection instead of a resize). No
          keepAspectRatio — unlike an image, a text card's width and height are
          independent. */}
      {selected && !readOnly && (
        <NodeResizer
          color={color ?? "var(--primary)"}
          minWidth={100}
          minHeight={44}
          handleStyle={{ width: 12, height: 12, borderRadius: 3, zIndex: 20 }}
          onResizeStart={commitBeforeDrag}
        />
      )}
    </div>
  );
}

export const MindmapNode = memo(MindmapNodeImpl);
