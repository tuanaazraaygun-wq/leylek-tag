import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Hesap Silme ve Veri Silme",
  description: "Leylek TAG hesap silme ve veri silme aciklama sayfasi.",
};

export default function AccountDeletionPage() {
  return <LegalPage document={legalDocuments["hesap-silme"]} />;
}
