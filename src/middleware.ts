import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// LOCAL_NO_AUTH (set only by electron/main.js's spawned local server) auto-logs
// every request into a single local user — see src/lib/auth.ts. This middleware
// runs on the Edge runtime against the real session cookie/JWT, which the local
// build never issues (there's no real sign-in to produce one), so it would
// otherwise redirect every request to /login regardless of that auto-login.
const nextAuthMiddleware = NextAuth(authConfig).auth;

export default process.env.LOCAL_NO_AUTH === "true" ? () => NextResponse.next() : nextAuthMiddleware;

export const config = {
  matcher: ["/dashboard/:path*", "/mindmap/:path*"],
};
