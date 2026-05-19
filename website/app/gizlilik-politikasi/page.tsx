import type { Metadata } from "next";
import { PrivacyPolicyView } from "@/components/privacy-policy-view";
import { getPrivacyPolicy } from "@/lib/privacy-policy-locales";

const content = getPrivacyPolicy("tr");

export const metadata: Metadata = {
  title: content.meta.title,
  description: content.meta.description,
  alternates: {
    canonical: content.meta.canonical,
    languages: {
      en: "/privacy",
      tr: "/gizlilik-politikasi",
    },
  },
  openGraph: {
    title: content.meta.openGraphTitle,
    description: content.meta.openGraphDescription,
    url: "/gizlilik-politikasi",
    locale: "tr_TR",
    alternateLocale: ["en_US"],
  },
};

export default function GizlilikPolitikasiPage() {
  return <PrivacyPolicyView locale="tr" />;
}
