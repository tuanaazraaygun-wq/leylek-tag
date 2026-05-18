export type UserSiteProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  city: string;
  created_at: string;
  updated_at: string;
};

export function isUserSiteProfileIncomplete(row: UserSiteProfileRow | null): boolean {
  if (!row) return true;
  return !String(row.full_name ?? "").trim() || !String(row.city ?? "").trim();
}
