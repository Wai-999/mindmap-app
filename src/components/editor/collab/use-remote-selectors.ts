import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { useLiveblocksStore } from "@/store/liveblocks-store";

export interface RemoteSelector {
  color: string;
  name: string;
}

// zustand/react/shallow's useShallow compares an array's own elements by reference
// — fine for primitives (two equal strings are already Object.is-equal) but useless
// on an array of freshly-built {color, name} objects, since filter/map below would
// construct a brand new object per element every call: two lists with identical
// content never compare equal by reference. That instability fed straight into
// React's own useSyncExternalStore consistency check (it re-invokes the selector
// after render to confirm nothing changed): getSnapshot kept "changing" on every
// check, which React can't distinguish from a real update loop, eventually throwing
// "Maximum update depth exceeded" — reproduced as soon as any collaborator (real or,
// in dev, React StrictMode's intentional double-mount of the room connection)
// selects a node at all (an empty array trivially compares equal; a non-empty one
// never did). Selecting two primitive arrays instead — each safely stabilized by
// useShallow — and only combining them into objects in a memo keyed off those two
// stable references fixes it.
export function useRemoteSelectors(nodeId: string): RemoteSelector[] {
  const colors = useLiveblocksStore(
    useShallow((s) =>
      s.liveblocks.others
        .filter((other) => other.presence.selectedNodeId === nodeId)
        .map((other) => other.presence.color),
    ),
  );
  const names = useLiveblocksStore(
    useShallow((s) =>
      s.liveblocks.others
        .filter((other) => other.presence.selectedNodeId === nodeId)
        .map((other) => other.presence.name),
    ),
  );

  return useMemo(
    () => colors.map((color, i) => ({ color, name: names[i] })),
    [colors, names],
  );
}
