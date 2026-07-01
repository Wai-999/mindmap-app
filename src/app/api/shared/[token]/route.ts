import type { NextRequest } from "next/server";

import { resolveShareAccess } from "@/lib/permissions";
import { jsonOk, jsonError, jsonConflict, jsonValidationError } from "@/lib/api-response";
import { decodeContent } from "@/lib/mindmap/content-codec";
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

  return jsonOk({
    mindmap: {
      id: result.mindmap.id,
      title: result.mindmap.title,
      content: decodeContent(result.mindmap.content),
      updatedAt: result.mindmap.updatedAt.toISOString(),
    },
    permission: result.permission,
  });
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

  const updateResult = await applyMindmapUpdate(result.mindmap, parsed.data);
  if (!updateResult.ok) {
    return jsonConflict("Conflict: mindmap was modified elsewhere", {
      content: updateResult.content,
      updatedAt: updateResult.updatedAt,
    });
  }

  return jsonOk({ updatedAt: updateResult.updatedAt });
}
