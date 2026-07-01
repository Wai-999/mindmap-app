import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// Deliberately no logged-in redirect (unlike login/register) — a user who suspects
// their account is compromised should be able to follow a reset link and set a new
// password even while an existing session is still active.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
