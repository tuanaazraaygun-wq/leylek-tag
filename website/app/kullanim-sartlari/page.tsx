import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Kullanim Sartlari",
  description: "Leylek TAG kullanim sartlari ve urun kapsami bilgilendirmesi.",
};

export default function TermsPage() {
  return <LegalPage document={legalDocuments["kullanim-sartlari"]} />;
}
