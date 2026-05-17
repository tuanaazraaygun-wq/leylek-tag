import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description: "Leylek TAG KVKK aydınlatma metni, veri işleme ve başvuru hakları.",
};

export default function KvkkPage() {
  return <LegalPage document={legalDocuments.kvkk} />;
}
