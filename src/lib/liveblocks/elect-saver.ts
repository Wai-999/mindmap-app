// While a Liveblocks room is live, every connected client would otherwise autosave to
// the DB independently (a thundering herd of near-simultaneous PATCH requests for the
// same mindmap). Instead, exactly one client — the one with the numerically-lowest
// connectionId among everyone currently in the room — is responsible for saving.
// Every client computes this locally from its own connectionId and the others it can
// see; it self-heals on disconnect with no coordination primitive needed, since the
// next-lowest id in the remaining set naturally becomes elected on the next check.
export function isElectedSaver(selfConnectionId: number, otherConnectionIds: number[]): boolean {
  return otherConnectionIds.every((id) => selfConnectionId < id);
}
