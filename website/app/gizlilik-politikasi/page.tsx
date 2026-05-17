import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "Leylek TAG gizlilik politikası: veri işleme, konum kullanımı, hesap silme ve KVKK başvuru hakları.",
};

export default function PrivacyPolicyPage() {
  return <LegalPage document={legalDocuments["gizlilik-politikasi"]} />;
}
