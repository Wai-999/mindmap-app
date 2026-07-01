"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLiveblocksStore } from "@/store/liveblocks-store";

const MAX_VISIBLE = 4;

// Renders nothing when solo (others.length === 0) or when Liveblocks isn't mounted at
// all for this session — this component only ever appears inside LiveblocksRoomProvider.
export function PresenceAvatars() {
  const others = useLiveblocksStore((s) => s.liveblocks.others);
  if (others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - visible.length;

  return (
    <div className="flex -space-x-2">
      {visible.map((other) => {
        const name = other.presence.name || "Guest";
        return (
          <Avatar
            key={other.connectionId}
            className="ring-background size-7 ring-2"
            title={name}
          >
            <AvatarFallback
              className="text-[11px] text-white"
              style={{ backgroundColor: other.presence.color || "var(--muted-foreground)" }}
            >
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 && (
        <Avatar className="ring-background size-7 ring-2">
          <AvatarFallback className="text-[11px]">+{overflow}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
