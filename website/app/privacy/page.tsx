import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { privacyPolicyDocument } from "@/lib/privacy-policy-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Leylek TAG Privacy Policy: user data, location, ride matching, chat security, analytics, crash logs, and support contact.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Leylek TAG | Privacy Policy",
    description:
      "How Leylek TAG collects and uses location, matching, chat, analytics, and support data.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalPage document={privacyPolicyDocument} />;
}
