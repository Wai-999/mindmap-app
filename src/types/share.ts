export type SharePermission = "VIEW" | "EDIT";

export interface ShareLinkSummary {
  id: string;
  token: string;
  permission: SharePermission;
  expiresAt: string | null;
  createdAt: string;
}
