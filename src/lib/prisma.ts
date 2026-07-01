import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Prisma's `mode: "insensitive"` filter option is Postgres-only (SQLite ignores/
// rejects it) — callers doing a case-insensitive `contains` search need to branch on
// this, since SQLite's own `LIKE` is already case-insensitive for ASCII by default.
export function isPostgres(): boolean {
  return (process.env.DATABASE_URL ?? "").startsWith("postgres");
}
