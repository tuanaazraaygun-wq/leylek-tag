import type { Metadata } from "next";

import { AdminOperationsMapDashboard } from "@/components/admin-operations-map-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · Operasyon Haritası",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — anonim yoğunluk demo shell (Faz 0; canlı veri yok). */
export default function AdminOperationsMapPage() {
  return (
    <SupportAdminErrorBoundary>
      <AdminOperationsMapDashboard />
    </SupportAdminErrorBoundary>
  );
}
