"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useEditorStore } from "@/store/editor-store";
import { useLiveblocksStore } from "@/store/liveblocks-store";
import { isElectedSaver } from "@/lib/liveblocks/elect-saver";
import { roomActiveRef, isElectedSaverRef, shareTokenRef } from "@/lib/liveblocks/collab-state";
import { NODE_COLORS } from "@/lib/mindmap/defaults";
import { LiveblocksBridge } from "@/components/editor/collab/liveblocks-bridge";

interface LiveblocksRoomProviderProps {
  roomId: string;
  userName: string;
  // Present only for a logged-out share-link visitor — forwarded to /api/liveblocks-auth
  // alongside the room id, since that visitor has no session to derive identity from.
  shareToken?: string;
  // False for a VIEW-only share-link visitor — forwarded to LiveblocksBridge, which
  // then never attempts to write to Storage on their behalf. The room's own
  // READ_ACCESS grant (decided server-side in /api/liveblocks-auth) is what actually
  // enforces this; this flag just keeps the client honest about it too.
  canWrite?: boolean;
  children: ReactNode;
}

// Only ever mounted when Liveblocks is configured for this deployment (see the boolean
// prop threaded down from the server-rendered mindmap/shared pages) — everything here,
// and everything inside LiveblocksBridge, only exists while this component is mounted,
// which is exactly how the app degrades to today's solo behavior when collaboration
// isn't enabled: by simply never mounting this tree at all.
export function LiveblocksRoomProvider({
  roomId,
  userName,
  shareToken,
  canWrite = true,
  children,
}: LiveblocksRoomProviderProps) {
  const colorRef = useRef<string>(NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)]);

  useEffect(() => {
    shareTokenRef.current = shareToken ?? null;

    // Presence fields must be set before enterRoom, since it captures `initialPresence`
    // from the store's state at that exact moment.
    useLiveblocksStore.setState({ name: userName, color: colorRef.current });

    // LiveblocksBridge is rendered as this component's child below, so its own mount
    // effect (which seeds liveblocks-store's nodes/edges from editor-store) runs before
    // this one, per React's child-before-parent effect ordering — by the time enterRoom
    // reconciles Storage, real content is already in place if the room is empty.
    //
    // @liveblocks/zustand's own .d.ts claims enterRoom(roomId) returns a cleanup
    // function, but the actual shipped implementation (verified by reading the
    // compiled source directly) returns nothing — leaving is done via the separate
    // liveblocks.leaveRoom() method instead. Trusting the type here caused a real
    // runtime crash ("leaveRoom is not a function") caught while testing against a
    // live Liveblocks project, not just types.
    useLiveblocksStore.getState().liveblocks.enterRoom(roomId);
    roomActiveRef.current = true;

    isElectedSaverRef.current = () => {
      const state = useLiveblocksStore.getState();
      const self = state.liveblocks.room?.getSelf();
      if (!self) return true;
      return isElectedSaver(
        self.connectionId,
        state.liveblocks.others.map((other) => other.connectionId),
      );
    };

    return () => {
      useLiveblocksStore.getState().liveblocks.leaveRoom();
      roomActiveRef.current = false;
      isElectedSaverRef.current = () => true;
      shareTokenRef.current = null;
    };
  }, [roomId, userName, shareToken]);

  // One-directional: broadcast this tab's local selection as presence. Remote
  // selections are read back via liveblocks.others, not written here.
  useEffect(() => {
    return useEditorStore.subscribe(
      (s) => s.selectedNodeId,
      (id) => useLiveblocksStore.getState().setSelectedNodeId(id),
    );
  }, []);

  return (
    <>
      <LiveblocksBridge canWrite={canWrite} />
      {children}
    </>
  );
}
