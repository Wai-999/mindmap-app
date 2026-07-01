import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Points at the exact same throwaway SQLite file global-setup.ts creates and
// playwright.config.ts's webServer runs against — lets a spec reach into the DB for
// things a browser can't observe directly, like a password reset token that would
// otherwise only ever be emailed.
const dbPath = path.join(__dirname, ".tmp", "e2e.db");

export const e2eDb = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});
