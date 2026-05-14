import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Hizmet Şartları",
  description: "Leylek Tag hizmet şartları, kullanıcı yükümlülükleri ve ürün kapsamı bilgilendirmesi.",
};

export default function TermsPage() {
  return <LegalPage document={legalDocuments["kullanim-sartlari"]} />;
}
