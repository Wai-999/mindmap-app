import { describe, it, expect } from "vitest";

import { isElectedSaver } from "@/lib/liveblocks/elect-saver";

describe("isElectedSaver", () => {
  it("is always true when solo (no other connections)", () => {
    expect(isElectedSaver(5, [])).toBe(true);
  });

  it("is true when self has the lowest connectionId among everyone present", () => {
    expect(isElectedSaver(1, [2, 3, 4])).toBe(true);
  });

  it("is false when at least one other connection has a lower id", () => {
    expect(isElectedSaver(3, [1, 4, 5])).toBe(false);
  });

  it("is false when tied for lowest with someone else (ties never elect self)", () => {
    expect(isElectedSaver(2, [2, 5])).toBe(false);
  });

  it("self-heals: becomes true once the lower-id connection disconnects", () => {
    const allConnections = [1, 4, 7];
    expect(isElectedSaver(4, allConnections)).toBe(false);

    const afterConnection1Leaves = [7];
    expect(isElectedSaver(4, afterConnection1Leaves)).toBe(true);
  });
});
