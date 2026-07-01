import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Runs once before the Playwright webServer starts. Gives e2e tests a fresh,
// migrated SQLite database completely separate from local dev data, so tests never
// depend on (or clobber) whatever mindmaps happen to exist in dev.db.
export default function globalSetup() {
  const dbPath = path.join(__dirname, ".tmp", "e2e.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);

  execSync("npx prisma db push --skip-generate", {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "inherit",
  });
}
