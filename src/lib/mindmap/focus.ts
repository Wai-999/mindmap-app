import type { MindmapEdge } from "@/types/mindmap";
import { getSubtreeIds } from "@/lib/mindmap/tree-utils";

// Focus mode isolates one node's hierarchy subtree (it stays lit while everything else
// dims). Both the canvas (dimming nodes) and every edge component need the same set of
// "focused" node ids, so this memoizes it per (edges array, focused node) pair — keyed
// on the edges array's identity via a WeakMap, so it's computed once per focus change
// and recomputed automatically whenever the edges array changes (any edit). Returns
// null when nothing is focused.
const cache = new WeakMap<MindmapEdge[], Map<string, ReadonlySet<string>>>();

export function getFocusedSubtree(
  edges: MindmapEdge[],
  focusedNodeId: string | null,
): ReadonlySet<string> | null {
  if (!focusedNodeId) return null;

  let byNode = cache.get(edges);
  if (!byNode) {
    byNode = new Map();
    cache.set(edges, byNode);
  }
  let set = byNode.get(focusedNodeId);
  if (!set) {
    set = new Set(getSubtreeIds(edges, focusedNodeId));
    byNode.set(focusedNodeId, set);
  }
  return set;
}
