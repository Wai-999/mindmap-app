// SMTP is optional, same "opt-in, graceful degrade" pattern as Liveblocks — a
// self-hoster without mail infra can still use forgot-password locally: the reset
// link is just logged to the server console instead of emailed.
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email:dev-fallback] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? "Mindmap <noreply@example.com>",
    to: email,
    subject: "Reset your Mindmap password",
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    html: `<p>Someone requested a password reset for this account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  });
}
