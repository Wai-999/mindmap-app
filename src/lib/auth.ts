import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Session } from "next-auth";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";
import { rateLimit } from "@/lib/rate-limit";

// Set only by electron/main.js's spawned local server — this build is one person
// running the app entirely on their own machine, so there's nothing a sign-in
// screen would actually be protecting (see localAuth below). Never set for the
// hosted Vercel deployment or `npm run dev`, both of which keep real accounts.
const LOCAL_NO_AUTH = process.env.LOCAL_NO_AUTH === "true";
const LOCAL_USER_EMAIL = "local@mindmap.app";

async function ensureLocalUser() {
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL, name: "You" },
  });
}

export const { handlers, auth: nextAuthAuth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Keyed by email rather than IP — the Credentials provider's authorize()
        // doesn't reliably expose the request in a way worth depending on, and
        // per-email limiting already stops brute-forcing one account's password.
        if (!rateLimit(`login:${parsed.data.email}`, 10, 15 * 60 * 1000)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.password) return null;

        const isValid = await verifyPassword(parsed.data.password, user.password);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

// Every call site in this project uses the no-argument `await auth()` form (a
// Server Component or Route Handler reading the current session) — this only
// needs to cover that one shape, not the full overloaded signature NextAuth's own
// `auth` supports (middleware wrapping, request-taking variants, etc.), since
// nothing here calls it any other way.
export async function auth(): Promise<Session | null> {
  if (LOCAL_NO_AUTH) {
    const user = await ensureLocalUser();
    return {
      user: { id: user.id, email: user.email, name: user.name },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    };
  }
  return nextAuthAuth();
}
