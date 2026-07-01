import { Liveblocks } from "@liveblocks/node";

// Real-time collaboration is entirely optional — this app is otherwise fully
// self-hosted (SQLite/Postgres, credentials auth, no external SaaS dependency), and
// Liveblocks is the one exception. Every collaboration feature must check this flag
// and degrade to today's solo behavior when it's false, not assume a key is set.
export function isLiveblocksConfigured(): boolean {
  return Boolean(process.env.LIVEBLOCKS_SECRET_KEY);
}

let client: Liveblocks | null = null;

// Lazily constructed so importing this module has no effect when Liveblocks isn't
// configured. Callers must check isLiveblocksConfigured() first — this throws rather
// than silently returning something unusable if that check was skipped.
export function getLiveblocksClient(): Liveblocks {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    throw new Error("getLiveblocksClient() called without LIVEBLOCKS_SECRET_KEY set");
  }
  if (!client) {
    client = new Liveblocks({ secret });
  }
  return client;
}
