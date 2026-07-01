import { useShallow } from "zustand/react/shallow";

import { useLiveblocksStore } from "@/store/liveblocks-store";

// Colors of other connected collaborators who currently have this specific node
// selected — used to render a per-collaborator ring, distinct from this tab's own
// local selection styling. Empty when solo or when Liveblocks isn't mounted.
// useShallow avoids a re-render on every liveblocks store update: without it, the
// filter/map below would return a new array reference every time, even when nothing
// relevant to this specific node actually changed.
export function useRemoteSelectors(nodeId: string): string[] {
  return useLiveblocksStore(
    useShallow((s) =>
      s.liveblocks.others
        .filter((other) => other.presence.selectedNodeId === nodeId)
        .map((other) => other.presence.color),
    ),
  );
}
