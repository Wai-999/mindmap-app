import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { token, password } = parsed.data;
  if (!rateLimit(`reset-password:${token}`, 10, 15 * 60 * 1000)) {
    return jsonError("Too many attempts. Please try again later.", 429);
  }

  const email = await consumePasswordResetToken(token);
  if (!email) return jsonError("This reset link is invalid or has expired.", 400);

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { email }, data: { password: passwordHash } });

  return jsonOk({ ok: true });
}
