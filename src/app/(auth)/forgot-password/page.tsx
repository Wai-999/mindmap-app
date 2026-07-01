import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return <ForgotPasswordForm />;
}
