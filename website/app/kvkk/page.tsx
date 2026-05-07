import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "KVKK Aydinlatma Metni",
  description: "Leylek TAG KVKK aydinlatma metni ve basvuru haklari.",
};

export default function KvkkPage() {
  return <LegalPage document={legalDocuments.kvkk} />;
}
