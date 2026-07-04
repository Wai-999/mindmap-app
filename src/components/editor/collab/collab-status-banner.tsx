"use client";

import { WifiOff, RefreshCw } from "lucide-react";

import { useLiveblocksStore } from "@/store/liveblocks-store";

// Surfaces Liveblocks' own connection status as a visible banner. Without this, a
// dropped socket just silently stops syncing — presence avatars quietly vanish and
// remote edits stop arriving — with no signal that anything's wrong. Always
// rendered (like FocusModeBanner): a no-op whenever Liveblocks isn't configured or
// the connection is healthy, since `liveblocks.status` simply never leaves
// "initial" in that case.
export function CollabStatusBanner() {
  const status = useLiveblocksStore((s) => s.liveblocks.status);

  if (status !== "reconnecting" && status !== "disconnected") return null;

  return (
    <div className="bg-card absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg">
      {status === "reconnecting" ? (
        <>
          <RefreshCw className="size-3.5 shrink-0 animate-spin text-amber-500" />
          Reconnecting to collaborators…
        </>
      ) : (
        <>
          <WifiOff className="text-destructive size-3.5 shrink-0" />
          Not connected — live collaboration is paused, your own edits still save normally
        </>
      )}
    </div>
  );
}
