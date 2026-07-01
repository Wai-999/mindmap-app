import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export const moveMindmapSchema = z.object({
  folderId: z.string().nullable(),
});

// Full replace, not incremental add/remove — the client always sends the complete
// desired tag-name list, capped to keep a single request bounded.
export const setMindmapTagsSchema = z.object({
  tagNames: z.array(z.string().trim().min(1).max(50)).max(20),
});
