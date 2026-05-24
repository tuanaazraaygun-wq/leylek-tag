import type { Metadata } from "next";

import { AdminNotificationCenterDashboard } from "@/components/admin-notification-center-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · Bildirim Merkezi",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — taslak bildirim oluşturma (gerçek gönderim yok). */
export default function AdminNotificationCenterPage() {
  return (
    <SupportAdminErrorBoundary>
      <AdminNotificationCenterDashboard />
    </SupportAdminErrorBoundary>
  );
}
