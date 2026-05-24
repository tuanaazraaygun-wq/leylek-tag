import type { Metadata } from "next";

import { AdminOpsHubDashboard } from "@/components/admin-ops-hub-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · Operasyon Merkezi",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — modül navigasyonu (Faz 0; mutation yok). */
export default function AdminOpsHubPage() {
  return (
    <SupportAdminErrorBoundary>
      <AdminOpsHubDashboard />
    </SupportAdminErrorBoundary>
  );
}
