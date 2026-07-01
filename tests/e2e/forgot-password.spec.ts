import { test, expect } from "@playwright/test";
import { uniqueEmail, TEST_PASSWORD } from "./fixtures";
import { e2eDb } from "./db";

const NEW_PASSWORD = "brandnewpassword456";

test("forgot password: request a reset link, use it to set a new password, then sign in with it", async ({
  browser,
}) => {
  const email = uniqueEmail("forgot-password-test");

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto("/register");
  await ownerPage.getByLabel("Name").fill("Forgot Password Test");
  await ownerPage.getByLabel("Email").fill(email);
  await ownerPage.getByLabel("Password").fill(TEST_PASSWORD);
  await ownerPage.getByRole("button", { name: "Create account" }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard$/);
  await ownerContext.close();

  // A fresh, logged-out context — mirrors how a real visitor would arrive at
  // /forgot-password from a link with no session at all.
  const visitorContext = await browser.newContext();
  const visitorPage = await visitorContext.newPage();

  await visitorPage.goto("/login");
  await visitorPage.getByRole("link", { name: "Forgot password?" }).click();
  await expect(visitorPage).toHaveURL(/\/forgot-password$/);

  await visitorPage.getByLabel("Email").fill(email);
  await visitorPage.getByRole("button", { name: "Send reset link" }).click();
  await expect(visitorPage.getByText("Check your email")).toBeVisible();

  // No SMTP configured in the test environment (nor dev/self-hosted use without it),
  // so the confirmation screen surfaces the link directly instead — assert it's the
  // exact same token that landed in the VerificationToken table.
  const record = await e2eDb.verificationToken.findFirst({ where: { identifier: email } });
  expect(record).not.toBeNull();
  const devLink = visitorPage.getByRole("link", { name: /reset-password\?token=/ });
  await expect(devLink).toHaveAttribute("href", new RegExp(`token=${record!.token}$`));

  await visitorPage.goto(`/reset-password?token=${record!.token}`);
  await visitorPage.getByLabel("New password").fill(NEW_PASSWORD);
  await visitorPage.getByLabel("Confirm password").fill(NEW_PASSWORD);
  await visitorPage.getByRole("button", { name: "Reset password" }).click();

  await expect(visitorPage).toHaveURL(/\/login\?reset=1$/);
  await expect(visitorPage.getByText("Password updated.")).toBeVisible();

  // The old password no longer works...
  await visitorPage.getByLabel("Email").fill(email);
  await visitorPage.getByLabel("Password").fill(TEST_PASSWORD);
  await visitorPage.getByRole("button", { name: "Sign in" }).click();
  await expect(visitorPage.getByText("Invalid email or password.")).toBeVisible();

  // ...but the new one does.
  await visitorPage.getByLabel("Password").fill(NEW_PASSWORD);
  await visitorPage.getByRole("button", { name: "Sign in" }).click();
  await expect(visitorPage).toHaveURL(/\/dashboard$/);

  await visitorContext.close();
});

test("a reset link can only be used once", async ({ browser }) => {
  const email = uniqueEmail("forgot-password-reuse-test");

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto("/register");
  await ownerPage.getByLabel("Name").fill("Reuse Test");
  await ownerPage.getByLabel("Email").fill(email);
  await ownerPage.getByLabel("Password").fill(TEST_PASSWORD);
  await ownerPage.getByRole("button", { name: "Create account" }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard$/);
  await ownerContext.close();

  const visitorContext = await browser.newContext();
  const visitorPage = await visitorContext.newPage();

  await visitorPage.goto("/forgot-password");
  await visitorPage.getByLabel("Email").fill(email);
  await visitorPage.getByRole("button", { name: "Send reset link" }).click();
  await expect(visitorPage.getByText("Check your email")).toBeVisible();

  const record = await e2eDb.verificationToken.findFirst({ where: { identifier: email } });
  const token = record!.token;

  await visitorPage.goto(`/reset-password?token=${token}`);
  await visitorPage.getByLabel("New password").fill(NEW_PASSWORD);
  await visitorPage.getByLabel("Confirm password").fill(NEW_PASSWORD);
  await visitorPage.getByRole("button", { name: "Reset password" }).click();
  await expect(visitorPage).toHaveURL(/\/login\?reset=1$/);

  // Reusing the exact same link a second time must fail, not silently reset again.
  await visitorPage.goto(`/reset-password?token=${token}`);
  await visitorPage.getByLabel("New password").fill("yetanotherpassword789");
  await visitorPage.getByLabel("Confirm password").fill("yetanotherpassword789");
  await visitorPage.getByRole("button", { name: "Reset password" }).click();
  await expect(visitorPage.getByText("This reset link is invalid or has expired.")).toBeVisible();

  await visitorContext.close();
});
