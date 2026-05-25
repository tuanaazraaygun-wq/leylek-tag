import type { Metadata } from "next";

import { AdminAnalyticsShellDashboard } from "@/components/admin-analytics-shell-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · Analytics Center",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — read-only demo analytics shell (Faz 1B; gerçek veri yok). */
export default function AdminAnalyticsCenterPage() {
  return (
    <SupportAdminErrorBoundary>
      <AdminAnalyticsShellDashboard />
    </SupportAdminErrorBoundary>
  );
}
