import { test, expect } from "@playwright/test";
import { uniqueEmail, TEST_PASSWORD } from "./fixtures";

test("a VIEW share link is read-only and an EDIT link is editable, both for a logged-out visitor", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  const email = uniqueEmail("share-test");
  await ownerPage.goto("/register");
  await ownerPage.getByLabel("Name").fill("Share Owner");
  await ownerPage.getByLabel("Email").fill(email);
  await ownerPage.getByLabel("Password").fill(TEST_PASSWORD);
  await ownerPage.getByRole("button", { name: "Create account" }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard$/);

  await ownerPage.getByRole("button", { name: "New mindmap" }).click();
  await expect(ownerPage).toHaveURL(/\/mindmap\//);
  await expect(ownerPage.locator(".react-flow__node")).toHaveCount(1);

  await ownerPage.getByRole("button", { name: "Share" }).click();

  // Create the default VIEW link.
  await ownerPage.getByRole("button", { name: "Create link" }).click();
  const viewRow = ownerPage.getByTestId("share-link-row").filter({ hasText: "View only" });
  await expect(viewRow).toBeVisible();
  const viewPath = await viewRow.getByTestId("share-link-path").textContent();

  // Switch the permission selector to EDIT and create a second link.
  await ownerPage.getByRole("combobox").click();
  await ownerPage.getByRole("option", { name: "Can edit" }).click();
  await ownerPage.getByRole("button", { name: "Create link" }).click();
  const editRow = ownerPage.getByTestId("share-link-row").filter({ hasText: "Can edit" });
  await expect(editRow).toBeVisible();
  const editPath = await editRow.getByTestId("share-link-path").textContent();

  await ownerContext.close();

  // --- Logged-out visitor opens the VIEW link ---
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  await guestPage.goto(viewPath!);
  await expect(guestPage.getByText("View only")).toBeVisible();
  await expect(guestPage.locator(".react-flow__node")).toHaveCount(1);
  await expect(guestPage.getByRole("button", { name: "Add child" })).toHaveCount(0);

  // Double-clicking a node must not open an editable field for a VIEW-only visitor.
  await guestPage.locator(".react-flow__node").first().dblclick();
  await expect(guestPage.locator('[contenteditable="true"]')).toHaveCount(0);

  // --- Same logged-out visitor opens the EDIT link ---
  await guestPage.goto(editPath!);
  await expect(guestPage.getByText("Can edit")).toBeVisible();

  const editableRoot = guestPage.locator(".react-flow__node").first();
  await editableRoot.click();
  await guestPage.keyboard.press("Tab");
  const guestEditable = guestPage.locator('[contenteditable="true"]');
  await expect(guestEditable).toBeFocused();
  await guestPage.keyboard.type("Guest edit");
  await guestPage.locator(".react-flow__pane").click({ position: { x: 50, y: 50 } });

  await expect(guestPage.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

  await guestPage.reload();
  await expect(guestPage.getByText("Guest edit")).toBeVisible();

  await guestContext.close();
});

test("an unknown share token shows a not-found state", async ({ page }) => {
  await page.goto("/shared/this-token-does-not-exist");
  await expect(page.getByText(/not found/i)).toBeVisible();
});
