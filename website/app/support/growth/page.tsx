import type { Metadata } from "next";

import { AdminGrowthCenterDashboard } from "@/components/admin-growth-center-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · Growth Center",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — Instagram API hazırlık shell (Faz 1; mutation yok). */
export default function AdminGrowthCenterPage() {
  return (
    <SupportAdminErrorBoundary>
      <AdminGrowthCenterDashboard />
    </SupportAdminErrorBoundary>
  );
}
