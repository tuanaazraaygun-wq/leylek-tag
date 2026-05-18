import { redirect } from "next/navigation";

import { ADMIN_SUPPORT_ROUTE_PATH } from "@/lib/site-origin";

/** Eski adres; kesin tek callback path `ADMIN_SUPPORT_ROUTE_PATH` (OAuth / magic link). */
export default function LegacyAdminSupportRedirect() {
  redirect(ADMIN_SUPPORT_ROUTE_PATH);
}
