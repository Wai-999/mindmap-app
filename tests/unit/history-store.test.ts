import { describe, it, expect, beforeEach } from "vitest";

import { useHistoryStore, type HistorySnapshot } from "@/store/history-store";

function snapshot(label: string): HistorySnapshot {
  return {
    nodes: [
      { id: "n1", type: "mindmapNode", position: { x: 0, y: 0 }, data: { label } },
    ],
    edges: [],
  };
}

describe("history-store", () => {
  beforeEach(() => {
    useHistoryStore.getState().reset();
  });

  it("starts empty", () => {
    const state = useHistoryStore.getState();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("commit pushes onto past and clears any existing future", () => {
    const store = useHistoryStore.getState();
    store.commit(snapshot("a"));
    expect(useHistoryStore.getState().past).toHaveLength(1);

    useHistoryStore.setState({ future: [snapshot("stale-redo")] });
    store.commit(snapshot("b"));
    expect(useHistoryStore.getState().future).toEqual([]);
    expect(useHistoryStore.getState().past).toHaveLength(2);
  });

  it("undo pops the most recent past entry and pushes the current state to future", () => {
    const store = useHistoryStore.getState();
    store.commit(snapshot("a"));
    const current = snapshot("current");

    const restored = store.undo(current);

    expect(restored).toEqual(snapshot("a"));
    expect(useHistoryStore.getState().past).toEqual([]);
    expect(useHistoryStore.getState().future).toEqual([current]);
  });

  it("undo returns null and changes nothing when there is no history", () => {
    const store = useHistoryStore.getState();
    expect(store.undo(snapshot("current"))).toBeNull();
    expect(useHistoryStore.getState().future).toEqual([]);
  });

  it("redo is the exact inverse of undo", () => {
    const store = useHistoryStore.getState();
    store.commit(snapshot("a"));
    const afterA = snapshot("after-a");
    const undone = store.undo(afterA)!;

    const redone = store.redo(undone);

    expect(redone).toEqual(afterA);
    expect(useHistoryStore.getState().past).toEqual([undone]);
    expect(useHistoryStore.getState().future).toEqual([]);
  });

  it("redo returns null when there is nothing to redo", () => {
    const store = useHistoryStore.getState();
    expect(store.redo(snapshot("current"))).toBeNull();
  });

  it("a new commit after an undo permanently discards the stale future", () => {
    const store = useHistoryStore.getState();
    store.commit(snapshot("a"));
    store.undo(snapshot("b")); // future is now [snapshot("b")]
    store.commit(snapshot("c"));

    expect(useHistoryStore.getState().future).toEqual([]);
    // redo should now find nothing, since the branch was discarded.
    expect(store.redo(snapshot("d"))).toBeNull();
  });

  it("caps the past stack at 100 entries, dropping the oldest first", () => {
    const store = useHistoryStore.getState();
    for (let i = 0; i < 105; i++) {
      store.commit(snapshot(`s${i}`));
    }

    const { past } = useHistoryStore.getState();
    expect(past).toHaveLength(100);
    expect(past[0]).toEqual(snapshot("s5"));
    expect(past[past.length - 1]).toEqual(snapshot("s104"));
  });
});
