// Plain mutable module-level refs, not React context — autosave.ts and the Liveblocks
// client (created once at module scope) are both outside the component tree, so they
// can't read React state directly. These are set by liveblocks-room-provider.tsx's
// effects and read by autosave.ts and liveblocks-store.ts.

// Whether a Liveblocks room is currently entered for this tab (false in solo mode, or
// whenever Liveblocks isn't configured at all).
export const roomActiveRef = { current: false };

// Recomputed by the room provider on every presence change; defaults to "always true"
// so solo mode (no room) behaves exactly like today with no special-casing needed at
// the one existing autosave call site.
export const isElectedSaverRef = { current: (): boolean => true };

// Share-link token for an anonymous (logged-out) visitor, threaded into the Liveblocks
// auth request body alongside the room id — session-based owners never set this.
export const shareTokenRef: { current: string | null } = { current: null };
