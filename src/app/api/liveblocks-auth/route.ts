import type { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getOwnedMindmap, resolveShareAccess } from "@/lib/permissions";
import { jsonError, jsonValidationError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { isLiveblocksConfigured, getLiveblocksClient } from "@/lib/liveblocks/config";

const ROOM_PREFIX = "mindmap:";

// Liveblocks' client posts `{ room }` automatically when authEndpoint is a plain URL
// (the owner path, identified by session cookie). The share-link path needs a token
// with no session to derive identity from, so the client there uses the
// function-form authEndpoint to add `token` to this same body (see the room provider
// in a later phase) — both shapes are handled by one route since the permission
// check is identical in spirit to every other mindmap-scoped route in this app.
const bodySchema = z.object({
  room: z.string(),
  token: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // This is a new deployment-optional feature, not a hard dependency — routes that
  // reuse this endpoint must all degrade gracefully when it's absent (see
  // isLiveblocksConfigured's doc comment).
  if (!isLiveblocksConfigured()) {
    return jsonError("Real-time collaboration is not enabled on this deployment.", 404);
  }

  // Newly anonymous-reachable via share tokens — same in-memory, per-process limiter
  // used everywhere else in this app (see README's "Known limitations").
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`liveblocks-auth:${ip}`, 30, 60 * 1000)) {
    return jsonError("Too many requests. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { room, token } = parsed.data;
  if (!room.startsWith(ROOM_PREFIX)) return jsonError("Unknown room", 400);
  const mindmapId = room.slice(ROOM_PREFIX.length);

  const session = await auth();

  let userId: string;
  let isFullAccess: boolean;

  if (session?.user) {
    const mindmap = await getOwnedMindmap(session.user.id, mindmapId);
    if (!mindmap) return jsonError("Not found", 404);
    userId = session.user.id;
    isFullAccess = true;
  } else if (token) {
    const result = await resolveShareAccess(token);
    if (!result.ok || result.mindmap.id !== mindmapId) return jsonError("Not found", 404);
    // Prefixed and namespaced by token, not by any real account — logged-out share
    // visitors have no stable identity beyond the link they opened.
    userId = `anon:${token}`;
    isFullAccess = result.permission === "EDIT";
  } else {
    return jsonError("Unauthorized", 401);
  }

  const liveblocks = getLiveblocksClient();
  const liveblocksSession = liveblocks.prepareSession(userId);
  liveblocksSession.allow(
    room,
    isFullAccess ? liveblocksSession.FULL_ACCESS : liveblocksSession.READ_ACCESS,
  );

  const { status, body: responseBody } = await liveblocksSession.authorize();
  return new Response(responseBody, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
