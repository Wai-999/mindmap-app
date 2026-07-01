import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const testDbPath = path.join(__dirname, "tests/e2e/.tmp/e2e.db");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Tests share one server/database and assert on global state (e.g. "no mindmaps
  // yet"), so they run serially rather than in parallel workers.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: `file:${testDbPath}`,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
