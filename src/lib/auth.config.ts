import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Prisma/bcrypt imports here (both are Node-only), so this file
// can be imported directly by middleware.ts, which runs on the Edge runtime.
// src/lib/auth.ts extends this with the actual Credentials provider.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = ["/dashboard", "/mindmap"];
      const isProtectedRoute = protectedPrefixes.some((prefix) =>
        request.nextUrl.pathname.startsWith(prefix),
      );

      if (isProtectedRoute) return isLoggedIn;
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
