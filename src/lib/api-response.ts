import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonValidationError(error: ZodError) {
  return NextResponse.json(
    { error: "validation_error", issues: error.flatten() },
    { status: 400 },
  );
}
