import type { Metadata } from "next";

import { AdminSocialStudioDashboard } from "@/components/admin-social-studio-dashboard";
import { SupportAdminErrorBoundary } from "@/components/support-admin-error-boundary";

export const metadata: Metadata = {
  title: "Admin · Sosyal Medya Studio",
  robots: { index: false, follow: false },
};

/** Supabase Auth + admin_users — statik sosyal içerik taslakları (paylaşım yok). */
export default function AdminSocialStudioPage() {
  return (
    <SupportAdminErrorBoundary>
      <AdminSocialStudioDashboard />
    </SupportAdminErrorBoundary>
  );
}
