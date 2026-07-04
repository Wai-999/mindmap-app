import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";

import { useRemoteSelectors } from "@/components/editor/collab/use-remote-selectors";

interface FakeOther {
  presence: { selectedNodeId: string | null; color: string; name: string };
}

const mockUseLiveblocksStore = vi.fn();
vi.mock("@/store/liveblocks-store", () => ({
  useLiveblocksStore: (selector: (state: { liveblocks: { others: FakeOther[] } }) => unknown) =>
    mockUseLiveblocksStore(selector),
}));

function setOthers(others: FakeOther[]) {
  mockUseLiveblocksStore.mockImplementation(
    (selector: (state: { liveblocks: { others: FakeOther[] } }) => unknown) =>
      selector({ liveblocks: { others } }),
  );
}

// Regression coverage for a real crash: the original implementation wrapped a
// selector that built a fresh {color, name} object per element in useShallow,
// which only compares an array's own elements by reference — two lists with
// identical values never matched, so React's useSyncExternalStore consistency
// check saw a "change" on every single render and eventually threw "Maximum
// update depth exceeded". Reproduced live by a second Liveblocks collaborator
// selecting any node at all (see collab-debug investigation). This suite asserts
// the actual fix: re-rendering with equivalent (not just deep-equal, genuinely
// re-derived) presence data returns the same array reference.
describe("useRemoteSelectors (stable output for React's render-consistency check)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("returns an empty array when no one else has this node selected", () => {
    setOthers([]);
    const { result } = renderHook(() => useRemoteSelectors("root"));
    expect(result.current).toEqual([]);
  });

  it("returns color+name for each other collaborator with this node selected", () => {
    setOthers([
      { presence: { selectedNodeId: "root", color: "#ff0000", name: "Ada" } },
      { presence: { selectedNodeId: "other-node", color: "#00ff00", name: "Grace" } },
    ]);
    const { result } = renderHook(() => useRemoteSelectors("root"));
    expect(result.current).toEqual([{ color: "#ff0000", name: "Ada" }]);
  });

  it("keeps the same array reference across re-renders when nothing relevant changed", () => {
    setOthers([{ presence: { selectedNodeId: "root", color: "#ff0000", name: "Ada" } }]);
    const { result, rerender } = renderHook(() => useRemoteSelectors("root"));
    const first = result.current;

    // Re-set with a BRAND NEW array/objects but identical values — simulates a
    // fresh selector invocation on every store read, exactly what previously broke.
    setOthers([{ presence: { selectedNodeId: "root", color: "#ff0000", name: "Ada" } }]);
    rerender();

    expect(result.current).toBe(first);
  });

  it("produces a new reference once the actual selecting collaborators change", () => {
    setOthers([{ presence: { selectedNodeId: "root", color: "#ff0000", name: "Ada" } }]);
    const { result, rerender } = renderHook(() => useRemoteSelectors("root"));
    const first = result.current;

    setOthers([{ presence: { selectedNodeId: "root", color: "#0000ff", name: "Grace" } }]);
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual([{ color: "#0000ff", name: "Grace" }]);
  });
});
