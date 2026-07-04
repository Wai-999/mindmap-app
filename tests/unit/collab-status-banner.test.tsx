import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CollabStatusBanner } from "@/components/editor/collab/collab-status-banner";

const mockUseLiveblocksStore = vi.fn();
vi.mock("@/store/liveblocks-store", () => ({
  useLiveblocksStore: (selector: (state: { liveblocks: { status: string } }) => unknown) =>
    mockUseLiveblocksStore(selector),
}));

function setStatus(status: string) {
  mockUseLiveblocksStore.mockImplementation(
    (selector: (state: { liveblocks: { status: string } }) => unknown) => selector({ liveblocks: { status } }),
  );
}

// Liveblocks' own connection status, surfaced as a banner so a dropped socket
// isn't silent — see the component for why this matters. Each status value maps
// to exactly one of: nothing, a reconnecting indicator, or a disconnected one.
describe("CollabStatusBanner", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing while connected", () => {
    setStatus("connected");
    const { container } = render(<CollabStatusBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing during the initial handshake or first connect attempt", () => {
    for (const status of ["initial", "connecting"]) {
      setStatus(status);
      const { container } = render(<CollabStatusBanner />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it("shows a reconnecting indicator when the socket drops but is retrying", () => {
    setStatus("reconnecting");
    render(<CollabStatusBanner />);
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it("shows a disconnected indicator, reassuring that local edits still save", () => {
    setStatus("disconnected");
    render(<CollabStatusBanner />);
    expect(screen.getByText(/Not connected/i)).toBeInTheDocument();
    expect(screen.getByText(/still save normally/i)).toBeInTheDocument();
  });
});
