import { tree as d3Tree, stratify } from "d3-hierarchy";

import type { MindmapNode, MindmapEdge } from "@/types/mindmap";
import { getParentId, getRootNodes, getSubtreeIds } from "@/lib/mindmap/tree-utils";
import type { NodePositions } from "@/lib/mindmap/layout-tree";

const RADIUS_STEP = 220; // distance between successive rings (one per depth level)
const CLUSTER_GAP = 160; // gap between adjacent primary ideas' clusters, on top of their radius

interface FlatNode {
  id: string;
  parentId: string | null;
}

// Lays out one root's subtree centered at its own local origin (radius 0 at the
// root), returning both the positions and the cluster's max radius, which the
// forest-combination pass below needs to size a uniform grid.
function layoutOneCluster(
  subNodes: MindmapNode[],
  subEdges: MindmapEdge[],
): { positions: NodePositions; maxRadius: number } {
  const flat: FlatNode[] = subNodes.map((n) => ({ id: n.id, parentId: getParentId(subEdges, n.id) }));
  const stratified = stratify<FlatNode>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(flat);

  const layout = d3Tree<FlatNode>()
    .size([2 * Math.PI, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
  const laidOut = layout(stratified);

  const positions: NodePositions = {};
  let maxRadius = 0;
  laidOut.each((node) => {
    const angle = node.x - Math.PI / 2; // rotate so the first child starts at the top
    const radius = node.depth * RADIUS_STEP;
    maxRadius = Math.max(maxRadius, radius);
    positions[node.data.id] = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });

  return { positions, maxRadius };
}

// Same Reingold–Tilford layout as layout-tree.ts, reinterpreted in polar coordinates.
// A mindmap can hold several independent primary ideas, so each root's subtree becomes
// its own radial cluster, and the clusters are arranged in a roughly-square grid (not
// a row — a long row of circles fights fitView's aspect-ratio fitting as root count
// grows). Cell size is uniform across the grid (sized to the largest cluster present)
// rather than tightly packed per-cluster — a deliberate simplicity trade-off that
// keeps this O(1) to reason about, at the cost of not being maximally compact when
// cluster sizes vary a lot.
export function computeRadialLayout(nodes: MindmapNode[], edges: MindmapEdge[]): NodePositions {
  const roots = getRootNodes(nodes, edges);
  if (roots.length === 0) return {};

  const clusters = roots.map((root) => {
    const ids = new Set(getSubtreeIds(edges, root.id));
    const subNodes = nodes.filter((n) => ids.has(n.id));
    const subEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return layoutOneCluster(subNodes, subEdges);
  });

  const maxRadiusAcrossAllClusters = Math.max(0, ...clusters.map((c) => c.maxRadius));
  const cellSize = 2 * maxRadiusAcrossAllClusters + CLUSTER_GAP;
  const cols = Math.ceil(Math.sqrt(roots.length));

  const positions: NodePositions = {};
  clusters.forEach((cluster, i) => {
    const colIndex = i % cols;
    const rowIndex = Math.floor(i / cols);
    const centerX = colIndex * cellSize;
    const centerY = rowIndex * cellSize;
    for (const [id, pos] of Object.entries(cluster.positions)) {
      positions[id] = { x: pos.x + centerX, y: pos.y + centerY };
    }
  });

  return positions;
}
