import { test, expect } from "@playwright/test";
import { uniqueEmail, TEST_PASSWORD } from "./fixtures";

test("register, create a mindmap, add nodes via keyboard, and confirm persistence across reload", async ({
  page,
}) => {
  const email = uniqueEmail("auth-test");

  await page.goto("/register");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Welcome back/)).toBeVisible();

  await page.getByRole("button", { name: "New mindmap" }).click();
  await expect(page).toHaveURL(/\/mindmap\//);

  const rootNode = page.locator(".react-flow__node").first();
  await expect(rootNode).toBeVisible();
  await rootNode.click();

  // Tab adds a child and immediately enters edit mode on it. The auto-focus happens
  // in a useEffect after React commits the new node, so wait for the contentEditable
  // to actually be focused before typing — otherwise keystrokes can race ahead of it.
  await page.keyboard.press("Tab");
  const editable = page.locator('[contenteditable="true"]');
  await expect(editable).toBeFocused();
  await page.keyboard.type("First branch");
  // Click the pane (not Escape/blur) to commit — matches the interaction path
  // verified to reliably fire the app's onBlur commit handler.
  await page.locator(".react-flow__pane").click({ position: { x: 50, y: 50 } });

  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByText("First branch")).toBeVisible();

  // Wait for the debounced autosave to actually complete.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.reload();

  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByText("First branch")).toBeVisible();
});

test("visiting the dashboard while logged out redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
