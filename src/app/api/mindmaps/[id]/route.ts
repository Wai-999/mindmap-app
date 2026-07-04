import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedMindmap } from "@/lib/permissions";
import { jsonOk, jsonError, jsonConflict, jsonValidationError } from "@/lib/api-response";
import { updateMindmapSchema } from "@/lib/validations/mindmap";
import { decodeContent, MindmapContentDecodeError } from "@/lib/mindmap/content-codec";
import { applyMindmapUpdate } from "@/lib/mindmap/update-content";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  try {
    return jsonOk({
      id: mindmap.id,
      title: mindmap.title,
      content: decodeContent(mindmap.content),
      updatedAt: mindmap.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof MindmapContentDecodeError) {
      return jsonError("This mindmap's saved content could not be read", 500);
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 2_000_000) {
    return jsonError("Payload too large", 413);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMindmapSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const result = await applyMindmapUpdate(mindmap, parsed.data);
    if (!result.ok) {
      return jsonConflict("Conflict: mindmap was modified elsewhere", {
        content: result.content,
        updatedAt: result.updatedAt,
      });
    }

    return jsonOk({ updatedAt: result.updatedAt });
  } catch (err) {
    if (err instanceof MindmapContentDecodeError) {
      return jsonError("This mindmap's saved content could not be read", 500);
    }
    throw err;
  }
}

// Used only by navigator.sendBeacon on page unload/visibility-hidden (see
// store/autosave.ts's flushOnUnload) — sendBeacon can only send POST and can't
// read a response, so this mirrors PATCH's content-save path but skips the
// conflict-retry dance (nothing could act on the result anyway) and always
// answers with a bare 202. The client's own pending-save queue, not this
// response, is what actually guarantees a failed beacon gets retried later.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return new Response(null, { status: 404 });

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 2_000_000) {
    return new Response(null, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMindmapSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  try {
    await applyMindmapUpdate(mindmap, parsed.data);
  } catch {
    // Decode failures on the (rare) 409 path aren't actionable from a beacon —
    // swallow and let a later real PATCH surface the error properly.
  }
  return new Response(null, { status: 202 });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const mindmap = await getOwnedMindmap(session.user.id, id);
  if (!mindmap) return jsonError("Mindmap not found", 404);

  await prisma.mindmap.delete({ where: { id } });
  return jsonOk({ id });
}
