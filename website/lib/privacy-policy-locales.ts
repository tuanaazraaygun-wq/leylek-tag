import type { LegalSection } from "@/lib/legal-content";
import type { LegalContactBlock, LegalPageDocument } from "@/components/legal-page";

export type PrivacyLocale = "en" | "tr";

export type PrivacyPolicyLocaleContent = LegalPageDocument & {
  locale: PrivacyLocale;
  updatedLabel: string;
  backLabel: string;
  contact: LegalContactBlock;
  meta: {
    title: string;
    description: string;
    canonical: string;
    openGraphTitle: string;
    openGraphDescription: string;
  };
};

export const privacyLanguageSwitch: ReadonlyArray<{
  locale: PrivacyLocale;
  label: string;
  href: string;
}> = [
  { locale: "en", label: "English", href: "/privacy" },
  { locale: "tr", label: "Türkçe", href: "/gizlilik-politikasi" },
];

const sharedContact = {
  company: "Karekod Teknoloji ve Yazılım A.Ş.",
  emails: ["info@karekodteknoloji.com", "support@leylektag.com"] as const,
  phone: "+90 850 307 80 29",
};

export const privacyPolicyByLocale: Record<PrivacyLocale, PrivacyPolicyLocaleContent> = {
  en: {
    locale: "en",
    title: "Data Protection & Privacy Policy",
    updatedAt: "May 2026",
    updatedLabel: "Last updated",
    backLabel: "Back to home",
    intro:
      "Leylek TAG is operated by Karekod Teknoloji ve Yazılım A.Ş. This Privacy Policy explains how personal data is collected, processed, stored, and protected while using the Leylek TAG platform and related mobility services.",
    sections: [
      {
        heading: "Information We Process",
        paragraphs: [
          "As data controller for Leylek TAG, we process personal data that is necessary, proportionate, and relevant to providing a secure mobility matching platform. The categories of data depend on whether you use Leylek TAG as a passenger or driver and which features you enable.",
        ],
        bullets: [
          "Account and identity data (e.g. name, phone number, email) for registration, authentication, and account security",
          "Trip, offer, route, and matching-related information you provide or generate through the service",
          "Device, session, diagnostic, and security event logs required to operate and protect the platform",
          "Driver verification materials where applicable, processed under restricted access controls",
        ],
      },
      {
        heading: "Location Data & Route Visibility",
        paragraphs: [
          "Location data is processed to support route visibility, proximity-aware matching, and active trip operations while you use Leylek TAG.",
          "Location is used for operational purposes connected to an active route or matching context. We do not use location data for continuous background advertising profiling or for selling location histories to third parties.",
          "Processing is limited to what is reasonably necessary for the feature in use, including trips and flows you actively participate in.",
        ],
      },
      {
        heading: "Ride Matching & Trip Operations",
        paragraphs: [
          "Offer, acceptance, trip status, and related operational metadata are processed to facilitate matching between drivers and passengers, present relevant trip context, and maintain the integrity of the platform.",
          "Trip-related information is disclosed only to parties involved in the relevant interaction and, where necessary, to authorised personnel or subprocessors for security, fraud prevention, customer support, or legal compliance.",
        ],
      },
      {
        heading: "Communication & Safety",
        paragraphs: [
          "In-app messaging, notifications, and related communication features (including voice where enabled) are processed to deliver the service you request.",
          "Chat and customer support content may be stored and reviewed for a limited period for safety, abuse prevention, dispute handling, and support quality, in accordance with applicable law and our internal policies.",
        ],
        bullets: [
          "Content may be processed to investigate reports of misuse or policy violations",
          "Retention periods for communications are limited to legitimate operational needs",
        ],
      },
      {
        heading: "Analytics, Diagnostics & Service Reliability",
        paragraphs: [
          "We may process aggregated analytics, diagnostic, performance, and crash data to maintain service reliability, investigate errors, and improve product quality.",
          "This information is used for security and product operations. Personal data is not sold to third parties for their independent advertising or profiling products.",
        ],
      },
      {
        heading: "Data Security",
        paragraphs: [
          "We implement technical and organisational measures designed to protect personal data against unauthorised access, loss, misuse, or alteration.",
        ],
        bullets: [
          "Encryption in transit using industry-standard protocols (HTTPS/TLS)",
          "Access controls, authentication, and role-based restrictions on internal systems",
          "Monitoring, logging, and procedures for fraud prevention and abuse prevention",
          "Incident response practices aligned with operational security requirements",
        ],
      },
      {
        heading: "Data Sharing & Legal Compliance",
        paragraphs: [
          "We do not sell personal data.",
          "Personal data may be shared with infrastructure providers, communications providers, analytics or support vendors acting on our instructions, under contractual safeguards and only for specified purposes.",
          "We may disclose information where required by applicable law, regulation, competent authority request, or court order, or where necessary to protect the rights, safety, and integrity of users and the platform.",
        ],
      },
      {
        heading: "Retention & Account Deletion",
        paragraphs: [
          "Personal data is retained only for as long as necessary for the purposes described in this policy, unless a longer retention period is required or permitted by law (for example, security, accounting, or regulatory obligations).",
          "You may submit an account deletion request through the in-app account deletion flow or via the account deletion pages on this website (/hesap-silme and /delete-account). Following a valid request, data is deleted or anonymised except where retention is legally required.",
        ],
      },
      {
        heading: "Your Privacy Rights",
        paragraphs: [
          "Depending on your location and applicable law—including the Turkish Personal Data Protection Law (KVKK) where it applies—you may have rights to request information, access, rectification, erasure, restriction of processing, or to object to certain processing of your personal data.",
          "To exercise your rights or submit a privacy-related request, contact us using the details in the Contact Information section below. We will respond within timeframes required by applicable law.",
          "You may also use the Turkish-language version of this policy at /gizlilik-politikasi.",
        ],
      },
      {
        heading: "Contact Information",
        paragraphs: [
          "For privacy, data protection, and account-related requests, please contact Karekod Teknoloji ve Yazılım A.Ş. using the channels below.",
        ],
      },
    ] as LegalSection[],
    contact: {
      ...sharedContact,
      label: "Privacy & Support Department",
      dataControllerLabel: "Data controller",
    },
    meta: {
      title: "Data Protection & Privacy Policy",
      description:
        "Leylek TAG Privacy Policy: how Karekod Teknoloji ve Yazılım A.Ş. collects and protects personal data for matching, location, communications, security, and your rights.",
      canonical: "/privacy",
      openGraphTitle: "Leylek TAG | Data Protection & Privacy Policy",
      openGraphDescription:
        "Professional privacy policy for Leylek TAG: location, ride matching, data security, KVKK rights, and contact information.",
    },
  },
  tr: {
    locale: "tr",
    title: "Veri Koruma ve Gizlilik Politikası",
    updatedAt: "Mayıs 2026",
    updatedLabel: "Son güncelleme",
    backLabel: "Ana sayfaya dön",
    intro:
      "Leylek TAG, Karekod Teknoloji ve Yazılım A.Ş. tarafından işletilir. Bu Gizlilik Politikası; Leylek TAG platformu ve ilgili mobilite hizmetleri kullanılırken kişisel verilerin nasıl toplandığını, işlendiğini, saklandığını ve korunduğunu açıklar.",
    sections: [
      {
        heading: "İşlediğimiz Bilgiler",
        paragraphs: [
          "Leylek TAG kapsamında veri sorumlusu olarak; hizmeti güvenli ve amacına uygun sunmak için gerekli, ölçülü ve ilgili kişisel verileri işleriz. İşlenen veri kategorileri; yolcu veya sürücü rolünüze ve kullandığınız özelliklere göre değişir.",
        ],
        bullets: [
          "Kayıt, kimlik doğrulama ve hesap güvenliği için hesap ve kimlik verileri (ad, telefon, e-posta vb.)",
          "Uygulama üzerinden sağladığınız veya oluşan yolculuk, teklif, rota ve eşleşme bilgileri",
          "Platformun işletilmesi ve korunması için gerekli cihaz, oturum ve güvenlik kayıtları",
          "Sürücü doğrulama materyalleri (varsa), kısıtlı erişim kontrolleri altında",
        ],
      },
      {
        heading: "Konum Verisi ve Rota Görünürlüğü",
        paragraphs: [
          "Konum verisi; rota görünürlüğü, yakınlık temelli eşleşme ve aktif yolculuk operasyonlarını desteklemek için işlenir.",
          "Konum; aktif rota veya eşleşme bağlamıyla ilişkili operasyonel amaçlar için kullanılır. Sürekli arka plan reklam profillemesi veya konum geçmişinin üçüncü taraflara satışı amacıyla kullanılmaz.",
          "İşleme, kullandığınız özellik ve aktif olarak katıldığınız akışlar için makul ölçüde sınırlıdır.",
        ],
      },
      {
        heading: "Eşleşme ve Yolculuk Operasyonları",
        paragraphs: [
          "Teklif, kabul, yolculuk durumu ve ilgili operasyonel meta veriler; sürücü ve yolcu eşleşmesini sağlamak, yolculuk bağlamını göstermek ve platform bütünlüğünü korumak için işlenir.",
          "Yolculuk bilgileri yalnızca ilgili taraflarla ve güvenlik, dolandırıcılık önleme, destek veya yasal uyum için gerekli hallerde yetkili personel veya alt işleyicilerle paylaşılır.",
        ],
      },
      {
        heading: "İletişim ve Güvenlik",
        paragraphs: [
          "Uygulama içi mesajlaşma, bildirimler ve ilgili iletişim özellikleri (etkin olduğunda sesli görüşme dahil) talep ettiğiniz hizmeti sunmak için işlenir.",
          "Sohbet ve destek içerikleri; güvenlik, kötüye kullanım önleme, uyuşmazlık yönetimi ve destek kalitesi amacıyla sınırlı süreyle saklanabilir ve incelenebilir.",
        ],
        bullets: [
          "Kötüye kullanım ve politika ihlali bildirimlerinin araştırılması",
          "İletişim verilerinin meşru operasyonel ihtiyaçlarla sınırlı tutulması",
        ],
      },
      {
        heading: "Analitik, Tanılama ve Hizmet Güvenilirliği",
        paragraphs: [
          "Hizmet güvenilirliğini korumak, hataları incelemek ve ürün kalitesini artırmak için toplu analitik, tanılama ve çökme verileri işlenebilir.",
          "Bu veriler güvenlik ve ürün operasyonları için kullanılır. Kişisel veriler, üçüncü tarafların bağımsız reklam veya profilleme ürünleri için satılmaz.",
        ],
      },
      {
        heading: "Veri Güvenliği",
        paragraphs: [
          "Kişisel verileri yetkisiz erişim, kayıp, kötüye kullanım veya değişikliğe karşı korumak için teknik ve idari tedbirler uygulanır.",
        ],
        bullets: [
          "Aktarım sırasında şifreleme (HTTPS/TLS)",
          "Erişim kontrolleri, kimlik doğrulama ve rol bazlı kısıtlamalar",
          "Dolandırıcılık önleme ve kötüye kullanım önleme süreçleri",
          "Operasyonel güvenlik gereksinimleriyle uyumlu olay müdahale uygulamaları",
        ],
      },
      {
        heading: "Veri Paylaşımı ve Yasal Uyum",
        paragraphs: [
          "Kişisel veriler satılmaz.",
          "Barındırma, iletişim, analitik veya destek altyapısı sağlayıcılarıyla, yalnızca belirli amaçlar için ve sözleşmesel güvenceler altında paylaşım yapılabilir.",
          "Yürürlükteki mevzuat, yetkili makam talebi veya mahkeme kararı gereği veya kullanıcıların ve platformun haklarını korumak için gerekli hallerde açıklama yapılabilir.",
        ],
      },
      {
        heading: "Saklama ve Hesap Silme",
        paragraphs: [
          "Kişisel veriler, bu politikada belirtilen amaçlar için gerekli olduğu sürece saklanır; kanunun daha uzun saklamaya izin verdiği haller saklıdır.",
          "Hesap silme talebinizi uygulama içi hesap silme akışı veya web sitemizdeki hesap silme sayfaları (/hesap-silme ve /delete-account) üzerinden iletebilirsiniz. Geçerli talepler sonrasında veriler, yasal zorunluluklar hariç silinir veya anonimleştirilir.",
        ],
      },
      {
        heading: "Gizlilik Haklarınız",
        paragraphs: [
          "Bulunduğunuz ülke ve uygulanabilir mevzuata bağlı olarak—Türkiye’de KVKK dahil—bilgi talep etme, erişim, düzeltme, silme, işlemeyi kısıtlama veya itiraz haklarınız olabilir.",
          "Haklarınızı kullanmak veya gizlilik talebi iletmek için aşağıdaki İletişim bölümündeki kanalları kullanabilirsiniz. Başvurular, mevzuatın öngördüğü süreler içinde yanıtlanır.",
          "İngilizce metin için /privacy sayfasını kullanabilirsiniz.",
        ],
      },
      {
        heading: "İletişim",
        paragraphs: [
          "Gizlilik, veri koruma ve hesapla ilgili talepleriniz için Karekod Teknoloji ve Yazılım A.Ş. ile aşağıdaki kanallardan iletişime geçebilirsiniz.",
        ],
      },
    ] as LegalSection[],
    contact: {
      ...sharedContact,
      label: "Gizlilik ve Destek Birimi",
      dataControllerLabel: "Veri sorumlusu",
    },
    meta: {
      title: "Veri Koruma ve Gizlilik Politikası",
      description:
        "Leylek TAG gizlilik politikası: kişisel verilerin toplanması, konum, eşleşme, güvenlik, KVKK hakları ve iletişim.",
      canonical: "/gizlilik-politikasi",
      openGraphTitle: "Leylek TAG | Veri Koruma ve Gizlilik Politikası",
      openGraphDescription:
        "Leylek TAG için veri koruma ve gizlilik politikası: konum, eşleşme, veri güvenliği ve başvuru hakları.",
    },
  },
};

export function getPrivacyPolicy(locale: PrivacyLocale): PrivacyPolicyLocaleContent {
  return privacyPolicyByLocale[locale];
}
