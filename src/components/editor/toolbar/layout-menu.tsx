"use client";

import { useReactFlow } from "@xyflow/react";
import { LayoutGrid } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";
import { computeTreeLayout } from "@/lib/mindmap/layout-tree";
import { computeRadialLayout } from "@/lib/mindmap/layout-radial";
import type { NodePositions } from "@/lib/mindmap/layout-tree";

export function LayoutMenu() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const applyLayout = useEditorStore((s) => s.applyLayout);
  const { fitView } = useReactFlow();

  function runLayout(compute: () => NodePositions) {
    applyLayout(compute());
    requestAnimationFrame(() => void fitView({ duration: 300, padding: 0.2 }));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Tidy layout"
          title="Tidy layout"
        >
          <LayoutGrid className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onClick={() => runLayout(() => computeTreeLayout(nodes, edges, "LR"))}>
          Tree — left to right
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runLayout(() => computeTreeLayout(nodes, edges, "TB"))}>
          Tree — top to bottom
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runLayout(() => computeRadialLayout(nodes, edges))}>
          Radial
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
