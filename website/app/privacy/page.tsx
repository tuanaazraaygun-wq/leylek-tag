import type { Metadata } from "next";
import { PrivacyPolicyView } from "@/components/privacy-policy-view";
import { getPrivacyPolicy } from "@/lib/privacy-policy-locales";

const content = getPrivacyPolicy("en");

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
    url: "/privacy",
    locale: "en_US",
    alternateLocale: ["tr_TR"],
  },
};

export default function PrivacyPage() {
  return <PrivacyPolicyView locale="en" />;
}
