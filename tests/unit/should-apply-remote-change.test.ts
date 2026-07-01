import { describe, it, expect } from "vitest";

import { shouldApplyRemoteChange } from "@/lib/liveblocks/should-apply-remote-change";

describe("shouldApplyRemoteChange", () => {
  it("applies a change whose key differs from the last synced key", () => {
    expect(shouldApplyRemoteChange("b", "a")).toBe(true);
  });

  it("skips a change whose key matches the last synced key (an echo of our own push)", () => {
    expect(shouldApplyRemoteChange("a", "a")).toBe(false);
  });

  it("applies the very first change, when nothing has synced yet", () => {
    expect(shouldApplyRemoteChange("a", null)).toBe(true);
  });
});
