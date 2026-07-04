import type { NextRequest } from "next/server";

import { resolveShareAccess } from "@/lib/permissions";
import { jsonOk, jsonError, jsonConflict, jsonValidationError } from "@/lib/api-response";
import { decodeContent, MindmapContentDecodeError } from "@/lib/mindmap/content-codec";
import { updateMindmapSchema } from "@/lib/validations/mindmap";
import { applyMindmapUpdate } from "@/lib/mindmap/update-content";

interface RouteParams {
  params: Promise<{ token: string }>;
}

function accessErrorResponse(reason: "not_found" | "expired") {
  return reason === "expired"
    ? jsonError("This link has expired or was revoked", 410)
    : jsonError("Link not found", 404);
}

// No auth required — anyone with the token gets the permission it grants. Never
// returns owner/account info to the anonymous caller.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return accessErrorResponse(result.reason);

  try {
    return jsonOk({
      mindmap: {
        id: result.mindmap.id,
        title: result.mindmap.title,
        content: decodeContent(result.mindmap.content),
        updatedAt: result.mindmap.updatedAt.toISOString(),
      },
      permission: result.permission,
    });
  } catch (err) {
    if (err instanceof MindmapContentDecodeError) {
      return jsonError("This mindmap's saved content could not be read", 500);
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return accessErrorResponse(result.reason);
  if (result.permission !== "EDIT") return jsonError("This link is view-only", 403);

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 2_000_000) {
    return jsonError("Payload too large", 413);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMindmapSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  let updateResult;
  try {
    updateResult = await applyMindmapUpdate(result.mindmap, parsed.data);
  } catch (err) {
    if (err instanceof MindmapContentDecodeError) {
      return jsonError("This mindmap's saved content could not be read", 500);
    }
    throw err;
  }
  if (!updateResult.ok) {
    return jsonConflict("Conflict: mindmap was modified elsewhere", {
      content: updateResult.content,
      updatedAt: updateResult.updatedAt,
    });
  }

  return jsonOk({ updatedAt: updateResult.updatedAt });
}

// Used only by navigator.sendBeacon on page unload/visibility-hidden (see
// store/autosave.ts's flushOnUnload) — sendBeacon can only send POST and can't
// read a response, so this mirrors PATCH's content-save path but skips the
// conflict-retry dance (nothing could act on the result anyway) and always
// answers with a bare 202. The client's own pending-save queue, not this
// response, is what actually guarantees a failed beacon gets retried later.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const result = await resolveShareAccess(token);
  if (!result.ok) return new Response(null, { status: result.reason === "expired" ? 410 : 404 });
  if (result.permission !== "EDIT") return new Response(null, { status: 403 });

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 2_000_000) {
    return new Response(null, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMindmapSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  try {
    await applyMindmapUpdate(result.mindmap, parsed.data);
  } catch {
    // See the owner route's POST handler — not actionable from a beacon.
  }
  return new Response(null, { status: 202 });
}
