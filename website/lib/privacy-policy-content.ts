import type { LegalSection } from "@/lib/legal-content";

/** App Store / TestFlight privacy policy URL (`/privacy`). */
export const privacyPolicyDocument = {
  title: "Privacy Policy",
  updatedAt: "May 2026",
  intro:
    "Karekod Teknoloji ve Yazılım A.Ş. (“we”, “us”) operates the Leylek TAG mobile application and leylektag.com. This Privacy Policy explains how we collect, use, and protect information when you use Leylek TAG.",
  sections: [
    {
      heading: "Information We Collect",
      paragraphs: [
        "Depending on how you use Leylek TAG, we may process account and profile details (such as name, phone number, and email), trip and offer information, device identifiers, and technical logs needed to run the service securely.",
      ],
      bullets: [
        "Account registration and authentication data",
        "Trip, route, and matching-related details you provide in the app",
        "Device type, app version, and security-related event logs",
        "Optional driver verification materials when you choose to drive",
      ],
    },
    {
      heading: "Location Data",
      paragraphs: [
        "Location is used to support route visibility, matching, and active trip flows. We do not use location for unrelated advertising profiles.",
        "Background location is not used for continuous tracking outside what is required for an active trip or feature you explicitly use.",
      ],
    },
    {
      heading: "Ride Matching & Trips",
      paragraphs: [
        "Offer, acceptance, and trip status data are processed to connect drivers and passengers, display relevant trip context, and maintain a consistent in-app experience.",
        "This data is shared only between the parties involved in a trip and as needed for platform operations, fraud prevention, and legal compliance.",
      ],
    },
    {
      heading: "Chat & Data Security",
      paragraphs: [
        "In-app messaging and related communication features (including voice where enabled) are processed to deliver the service. Content may be retained for a limited period for safety, abuse prevention, and support investigations.",
      ],
      bullets: [
        "Encrypted transport (HTTPS/TLS) for data in transit",
        "Access controls and role-based restrictions on internal systems",
        "Monitoring for abuse, fraud, and security incidents",
      ],
    },
    {
      heading: "Analytics & Crash Logs",
      paragraphs: [
        "We may collect diagnostic, analytics, and crash information to improve stability, fix errors, and understand how features are used in aggregate.",
        "This information is not sold to third parties for their independent marketing purposes.",
      ],
    },
    {
      heading: "Support Communications",
      paragraphs: [
        "If you contact us by email or in-app support, we process the content of your message and contact details to respond and keep a record of the request.",
        "For product support on the website, you may also reach us at support@leylektag.com.",
      ],
    },
    {
      heading: "Retention & Account Deletion",
      paragraphs: [
        "We retain data only as long as needed for the purposes above, unless a longer period is required by law.",
        "You may request account deletion through the in-app account deletion flow or the account deletion pages linked from our website. After deletion, data is removed or anonymized except where retention is legally required.",
      ],
    },
    {
      heading: "Your Rights & Contact",
      paragraphs: [
        "Depending on applicable law (including Turkish KVKK where relevant), you may have rights to access, correct, delete, or object to certain processing of your personal data.",
        "Privacy and data requests: info@karekodteknoloji.com | +90 850 307 80 29",
        "For a Turkish-language policy with additional local disclosures, see /gizlilik-politikasi on this site.",
      ],
    },
  ] as LegalSection[],
};
