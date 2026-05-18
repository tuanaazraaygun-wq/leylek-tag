import type { Metadata } from "next";

import { AdminSupportDashboard } from "@/components/admin-support-dashboard";

export const metadata: Metadata = {
  title: "Admin · Destek",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users ile destek kutusu (OAuth / magic link callback path). */
export default function AdminSupportPage() {
  return <AdminSupportDashboard />;
}
