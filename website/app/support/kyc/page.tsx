import type { Metadata } from "next";

import { KycAdminDashboard } from "@/components/kyc-admin-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · KYC İnceleme",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — salt okunur KYC belge inceleme. */
export default function KycAdminPage() {
  return (
    <SupportAdminErrorBoundary>
      <KycAdminDashboard />
    </SupportAdminErrorBoundary>
  );
}
