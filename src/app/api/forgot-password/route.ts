import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`forgot-password:${ip}`, 10, 15 * 60 * 1000)) {
    return jsonError("Too many attempts. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email } = parsed.data;

  // Keyed by email too, on top of the IP limit — stops one attacker from spamming a
  // specific victim's inbox with reset emails from many different IPs.
  if (rateLimit(`forgot-password-email:${email}`, 5, 15 * 60 * 1000)) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Only accounts with a credentials password can reset one this way — an
    // OAuth-only account (once those exist) has nothing here to reset.
    if (user?.password) {
      const token = await createPasswordResetToken(email);
      const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl);
    }
  }

  // Always the same response whether or not the account exists (or the per-email
  // limit just tripped) — this endpoint must never reveal which emails are registered.
  return jsonOk({ ok: true });
}
