import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Reuses the VerificationToken model Auth.js's Prisma adapter contract already
// requires (identifier/token/expires) — no new migration needed, and it's exactly
// the "single-use, expiring, keyed by email" shape a password reset token needs.
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");

  // Only one valid reset link per email at a time — an older, still-unused link
  // from an earlier request shouldn't remain usable once a new one is issued.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  return token;
}

// Single-use: the token row is deleted as soon as it's looked up, regardless of
// whether it turns out to be expired, so a leaked or expired link can never be
// retried. Returns the email it was issued for, or null if invalid/expired.
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;

  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  if (record.expires < new Date()) return null;
  return record.identifier;
}
