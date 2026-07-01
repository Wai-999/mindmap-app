// Loop-prevention for the editor-store <-> liveblocks-store content bridge. Both
// sides compute a content key (see contentKey below) and share one "last synced key"
// ref: whichever store changes first pushes its content to the other and updates the
// shared key: when that push causes the other store to change too, its own change
// callback sees the key already matches and skips re-applying, breaking the ping-pong
// without needing to track direction or "did I originate this" flags.
export function shouldApplyRemoteChange(newKey: string, lastSyncedKey: string | null): boolean {
  return newKey !== lastSyncedKey;
}
