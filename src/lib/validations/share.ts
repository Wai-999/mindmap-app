import { z } from "zod";

export const sharePermissionSchema = z.enum(["VIEW", "EDIT"]);

export const createShareLinkSchema = z.object({
  permission: sharePermissionSchema.default("VIEW"),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export const updateShareLinkSchema = z.object({
  permission: sharePermissionSchema.optional(),
  revoke: z.boolean().optional(),
});
