import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Hesap Silme ve Veri Silme",
  description:
    "Leylek Tag hesap silme: uygulama içi talep, silinen veriler, süreç ve destek iletişimi.",
};

export default function AccountDeletionPage() {
  return <LegalPage document={legalDocuments["hesap-silme"]} />;
}
