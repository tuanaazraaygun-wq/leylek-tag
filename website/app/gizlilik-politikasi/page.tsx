import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Gizlilik Politikasi",
  description: "Leylek TAG gizlilik politikasi ve veri isleme bilgilendirmesi.",
};

export default function PrivacyPolicyPage() {
  return <LegalPage document={legalDocuments["gizlilik-politikasi"]} />;
}
