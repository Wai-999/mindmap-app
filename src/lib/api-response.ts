import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Carries the server's current state alongside the error so the client can offer a
// meaningful "reload to see the latest version" action instead of a bare failure.
export function jsonConflict(message: string, data: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...data }, { status: 409 });
}

export function jsonValidationError(error: ZodError) {
  return NextResponse.json(
    { error: "validation_error", issues: error.flatten() },
    { status: 400 },
  );
}
