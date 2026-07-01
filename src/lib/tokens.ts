import { randomBytes } from "node:crypto";

// 256 bits of entropy, URL-safe, ~43 chars — never derived from predictable data like
// the mindmap id or a timestamp.
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
