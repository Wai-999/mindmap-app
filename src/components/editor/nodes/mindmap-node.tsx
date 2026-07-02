"use client";

import { memo, useEffect, useRef } from "react";
import { Handle, Position, useConnection, type NodeProps } from "@xyflow/react";
import { ChevronRight, Info, StickyNote, CheckSquare, Square } from "lucide-react";

import type { MindmapNode as MindmapNodeType } from "@/types/mindmap";
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

function MindmapNodeImpl({ id }: NodeProps<MindmapNodeType>) {
  // Selection is driven entirely by our own store (selectedNodeId), not React Flow's
  // internal node.selected flag — store actions like addChildNode change selection
  // programmatically without going through RF's click handling, so RF's own flag
  // would drift out of sync (see nodesSelectable={false} on the canvas).
  const selected = useEditorStore((s) => s.selectedNodeId === id);
  const label = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? "");
  const color = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.color);
  const collapsed = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.collapsed ?? false);
  const shape = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.shape ?? "rounded");
  const note = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.note);
  const task = useEditorStore((s) => s.nodes.find((n) => n.id === id)?.data.task);
  // First image attachment only — a small cover thumbnail, not a gallery, matching
  // the note/task indicators' "presence, not full content" treatment. The full list
  // (with the rest, if any) stays in the inspector panel.
  const imageUrl = useEditorStore(
    (s) => s.attachments.find((a) => a.nodeId === id && a.mimeType.startsWith("image/"))?.url,
  );
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

  const setEditingNode = useEditorStore((s) => s.setEditingNode);
  const setInspectorNode = useEditorStore((s) => s.setInspectorNode);
  const updateNodeLabel = useEditorStore((s) => s.updateNodeLabel);
  const toggleCollapsed = useEditorStore((s) => s.toggleCollapsed);

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

  const isDiamond = shape === "diamond";

  return (
    <div
      className={cn(
        "group relative min-w-[120px] max-w-[280px] text-card-foreground shadow-sm transition-shadow",
        isDiamond
          ? "bg-transparent px-9 py-7"
          : cn(
              "border-2 bg-card px-4 py-2.5",
              shape === "rectangle" ? "rounded-none" : shape === "pill" ? "rounded-full" : "rounded-xl",
            ),
        selected ? "shadow-md" : "hover:shadow-md",
      )}
      style={{
        // The diamond's outline is drawn by its own SVG polygon below instead —
        // this div stays borderless so no rectangular edge shows through its points.
        borderColor: isDiamond ? undefined : selected ? (color ?? "var(--primary)") : "transparent",
        // Ring sits outside the node's own border (a card-colored gap, then the
        // collaborator's color) so local selection and remote selection never visually
        // collide, even when both are true at once.
        boxShadow: remoteSelectorColors[0]
          ? `0 0 0 2px var(--card), 0 0 0 4px ${remoteSelectorColors[0]}`
          : undefined,
      }}
    >
      {isDiamond && (
        // A rectangular border can't follow a diamond's diagonal edges, so the
        // shape/fill/stroke are drawn here instead, sized to the card's own
        // bounding box — the actual content (and the connection handles below,
        // which anchor to that same box) stays in normal, unrotated layout on top.
        <svg
          className="pointer-events-none absolute inset-0 -z-10 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            points="50,3 97,50 50,97 3,50"
            className="fill-card"
            stroke={selected ? (color ?? "var(--primary)") : "transparent"}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Invisible strips covering the node's whole border, one per side, so a
          free-form link drag can start from ANY point on the perimeter (crosshair
          cursor gives the affordance) — the interior stays free for dragging the node
          itself. Ids are kept as the four side names because hierarchy edges anchor to
          "right"/"left" (see the normalization in mindmap-canvas.tsx), and each strip's
          center is exactly that side's midpoint. connectionMode="loose" on the canvas
          lets every strip both start and end a connection. */}
      {HANDLE_STRIPS.map((strip) => (
        <Handle key={strip.id} type="source" id={strip.id} position={strip.position} style={strip.style} />
      ))}

      {/* While a connection drag from another node is in progress, the entire node
          becomes a drop target — the link can end anywhere on the node, not just on a
          border strip. Rendered only during the drag so it never blocks normal
          click/drag/edit interactions; zIndex lifts it above the node's own content,
          since the drop is resolved by hit-testing whatever element is under the
          pointer, and the label/buttons would otherwise swallow it. */}
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
          // Pill/diamond outlines don't have a flat top edge to bleed a rectangular
          // image into — an inset thumbnail avoids the two shapes visibly clashing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="mb-2 h-16 w-full rounded-md object-cover" />
        ))}

      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
        />
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            className="min-w-[2ch] flex-1 text-sm leading-snug outline-none"
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
              "flex-1 text-sm leading-snug break-words",
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
    </div>
  );
}

export const MindmapNode = memo(MindmapNodeImpl);
