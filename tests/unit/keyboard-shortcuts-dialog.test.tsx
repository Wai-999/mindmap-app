import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { KeyboardShortcutsDialog } from "@/components/editor/toolbar/keyboard-shortcuts-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

// Sanity coverage for the cheatsheet added alongside arrow-key navigation and
// F2-to-edit (see use-keyboard-shortcuts.ts) — the dialog's own SHORTCUTS list is
// hand-kept in sync with that file rather than generated from it, so at minimum
// this confirms the trigger opens it and the two newest shortcuts are listed.
describe("KeyboardShortcutsDialog", () => {
  afterEach(cleanup);

  function renderDialog() {
    return render(
      <TooltipProvider>
        <KeyboardShortcutsDialog />
      </TooltipProvider>,
    );
  }

  it("stays closed until the trigger button is clicked", () => {
    renderDialog();
    expect(screen.queryByText("Keyboard shortcuts")).not.toBeInTheDocument();
  });

  it("opens on click and lists the arrow-key navigation and rename shortcuts", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByText(/Move selection to the nearest idea/i)).toBeInTheDocument();
    expect(screen.getByText(/Rename the selected idea/i)).toBeInTheDocument();
  });
});
