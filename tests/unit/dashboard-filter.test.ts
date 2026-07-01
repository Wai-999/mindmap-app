import { describe, it, expect } from "vitest";

import { buildDashboardWhere } from "@/lib/mindmap/dashboard-filter";

describe("buildDashboardWhere", () => {
  it("filters by owner only when no folder/query/tag are given", () => {
    expect(buildDashboardWhere({ ownerId: "u1", isPostgres: false })).toEqual({
      ownerId: "u1",
    });
  });

  it("adds a folderId filter when a folder is given", () => {
    const where = buildDashboardWhere({ ownerId: "u1", folderId: "f1", isPostgres: false });
    expect(where).toEqual({ ownerId: "u1", folderId: "f1" });
  });

  it("adds a case-insensitive title filter on Postgres", () => {
    const where = buildDashboardWhere({ ownerId: "u1", query: "Roadmap", isPostgres: true });
    expect(where).toEqual({
      ownerId: "u1",
      title: { contains: "Roadmap", mode: "insensitive" },
    });
  });

  it("omits the Postgres-only mode option on SQLite", () => {
    const where = buildDashboardWhere({ ownerId: "u1", query: "Roadmap", isPostgres: false });
    expect(where).toEqual({ ownerId: "u1", title: { contains: "Roadmap" } });
  });

  it("trims whitespace from the search query and ignores an empty query", () => {
    const where = buildDashboardWhere({ ownerId: "u1", query: "  ", isPostgres: false });
    expect(where).toEqual({ ownerId: "u1" });
  });

  it("adds a tag filter when a tag is given", () => {
    const where = buildDashboardWhere({ ownerId: "u1", tagId: "t1", isPostgres: false });
    expect(where).toEqual({ ownerId: "u1", tags: { some: { id: "t1" } } });
  });

  it("combines folder, query, and tag filters together", () => {
    const where = buildDashboardWhere({
      ownerId: "u1",
      folderId: "f1",
      query: "plan",
      tagId: "t1",
      isPostgres: true,
    });
    expect(where).toEqual({
      ownerId: "u1",
      folderId: "f1",
      title: { contains: "plan", mode: "insensitive" },
      tags: { some: { id: "t1" } },
    });
  });
});
