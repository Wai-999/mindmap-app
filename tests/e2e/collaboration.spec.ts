import { test, expect } from "@playwright/test";
import { uniqueEmail, TEST_PASSWORD } from "./fixtures";

// Requires LIVEBLOCKS_SECRET_KEY to be set (in .env, loaded by the dev server this
// suite spins up) — without it, /api/liveblocks-auth 404s, no room is ever entered,
// and this test fails fast rather than silently no-op'ing. Uses two independent
// browser contexts under the same account, exactly like one person open in two tabs —
// each still gets its own Liveblocks connection, which is all real-time sync needs.
test("two connected tabs on the same mindmap sync edits and presence live", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  const email = uniqueEmail("collab-test");
  await ownerPage.goto("/register");
  await ownerPage.getByLabel("Name").fill("Collab Owner");
  await ownerPage.getByLabel("Email").fill(email);
  await ownerPage.getByLabel("Password").fill(TEST_PASSWORD);
  await ownerPage.getByRole("button", { name: "Create account" }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard$/);

  await ownerPage.getByRole("button", { name: "New mindmap" }).click();
  await expect(ownerPage).toHaveURL(/\/mindmap\//);
  await expect(ownerPage.locator(".react-flow__node")).toHaveCount(1);
  const mindmapUrl = ownerPage.url();

  const secondPage = await ownerContext.newPage();
  await secondPage.goto(mindmapUrl);
  await expect(secondPage.locator(".react-flow__node")).toHaveCount(1);

  // Presence: each tab sees exactly one *other* connected collaborator (itself is
  // never included in its own avatar stack).
  await expect(ownerPage.locator('[title^="Collab Owner"]').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(secondPage.locator('[title^="Collab Owner"]').first()).toBeVisible({
    timeout: 10_000,
  });

  // Storage sync: add a child node on the first tab, confirm it appears live on the
  // second without that tab ever reloading or re-fetching.
  const rootNode = ownerPage.locator(".react-flow__node").first();
  await rootNode.click();
  await ownerPage.keyboard.press("Tab");
  const editable = ownerPage.locator('[contenteditable="true"]');
  await expect(editable).toBeFocused();
  await ownerPage.keyboard.type("Synced live");
  await ownerPage.locator(".react-flow__pane").click({ position: { x: 50, y: 50 } });

  // Generous timeouts from here on — this is a real round trip through Liveblocks'
  // actual cloud infrastructure, not a local computation, and network timing varies
  // run to run (observed anywhere from ~1s to ~8s in practice).
  await expect(ownerPage.locator(".react-flow__node")).toHaveCount(2, { timeout: 15_000 });
  await expect(secondPage.getByText("Synced live")).toBeVisible({ timeout: 15_000 });
  await expect(secondPage.locator(".react-flow__node")).toHaveCount(2, { timeout: 15_000 });

  // The edit still lands in the database via the normal autosave path (elected-saver
  // logic notwithstanding — one of the two tabs saves it), confirmed by reloading a
  // third, fresh view of the same mindmap after the "Saved" indicator settles.
  await expect(ownerPage.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await ownerPage.reload();
  await expect(ownerPage.locator(".react-flow__node")).toHaveCount(2, { timeout: 15_000 });
  await expect(ownerPage.getByText("Synced live")).toBeVisible();

  await ownerContext.close();
});
