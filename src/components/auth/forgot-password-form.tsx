"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  // Only ever populated by the API when SMTP isn't configured and the app isn't
  // running in production — see the route's own comment. Lets local/self-hosted
  // testing work without any mail setup, since there's otherwise nowhere for the
  // link to surface besides the server's own console.
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json().catch(() => null);
    setDevResetUrl(body?.devResetUrl ?? null);
    // Same success state regardless of the response — the endpoint itself never
    // reveals whether the email is registered, so the UI shouldn't either.
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <MailCheck className="text-primary size-8" />
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for that email, we&apos;ve sent a link to reset your password.
            It expires in 1 hour.
          </CardDescription>
        </CardHeader>
        {devResetUrl && (
          <CardContent>
            <div className="bg-muted flex flex-col gap-2 rounded-md p-3 text-sm">
              <p className="text-muted-foreground">
                No email service is configured, so here&apos;s the link directly (dev only —
                this never appears in production):
              </p>
              <Link href={devResetUrl} className="text-foreground break-all underline underline-offset-4">
                {devResetUrl}
              </Link>
            </div>
          </CardContent>
        )}
        <CardFooter>
          <Link href="/login" className="text-foreground text-sm underline underline-offset-4">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset it.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Send reset link
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Remembered it?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
