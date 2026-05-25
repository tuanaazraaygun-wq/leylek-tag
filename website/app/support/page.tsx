import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { SUPPORT_EMAIL } from "@/lib/site-contact";

const supportMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG · Destek talebi")}`;

const supportSections = [
  {
    title: "Hesap ve giriş desteği",
    body: "Kayıt, oturum açma, profil ve hesap ayarlarıyla ilgili sorularınız için destek ekibimize yazabilirsiniz.",
  },
  {
    title: "Yol paylaşımı ve eşleşme desteği",
    body: "Rota, teklif, onay ve eşleşme akışı hakkında bilgi veya yaşadığınız süreç sorunları için bize ulaşın.",
  },
  {
    title: "QR doğrulama desteği",
    body: "Yolculuk başlangıcı ve QR doğrulama adımlarıyla ilgili teknik veya kullanım sorularında yardımcı oluruz.",
  },
  {
    title: "Güven Al ve canlı görüşme desteği",
    body: "Güven Al özellikleri ve uygulama içi canlı görüşme akışı hakkında destek taleplerinizi iletebilirsiniz.",
  },
  {
    title: "KVKK, gizlilik ve hesap silme talepleri",
    body: "Kişisel veriler, gizlilik politikası ve hesap silme süreçleri için aşağıdaki yasal sayfaları inceleyebilir veya e-posta ile başvurabilirsiniz.",
  },
] as const;

const legalResourceLinks = [
  { href: "/gizlilik-politikasi", label: "Gizlilik Politikası" },
  { href: "/privacy", label: "Privacy Policy (EN)" },
  { href: "/kvkk", label: "KVKK" },
  { href: "/kullanim-sartlari", label: "Kullanım Şartları" },
  { href: "/hesap-silme", label: "Hesap Silme" },
  { href: "/delete-account", label: "Account Deletion (EN)" },
] as const;

export const metadata: Metadata = {
  title: "Destek",
  description:
    "Leylek TAG kullanıcı destek, hesap, güvenlik, QR doğrulama ve yolculuk paylaşımı yardım sayfası.",
  alternates: {
    canonical: "/support",
  },
  openGraph: {
    title: "Leylek TAG Destek",
    description:
      "Leylek TAG kullanıcı destek, hesap, güvenlik, QR doğrulama ve yolculuk paylaşımı yardım sayfası.",
    url: "/support",
  },
};

export default function SupportPage() {
  return (
    <section className="py-12 md:py-20">
      <Container>
        <div className="mx-auto max-w-4xl space-y-10 md:space-y-12">
          <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-[22px] md:p-10">
            <Link
              href="/"
              className="text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
            >
              ← Anasayfaya dön
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400/90">
              Kullanıcı desteği
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl md:leading-tight">
              Leylek TAG Destek
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              Yol paylaşımı, hesap, güvenlik ve doğrulama süreçleri için destek.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={supportMailto}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#00C6FF] to-[#0072FF] px-6 py-3 text-center text-sm font-bold tracking-wide text-white shadow-[0_12px_40px_rgba(0,114,255,0.35)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Destek e-postası gönder
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-sm font-semibold text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </header>

          <div className="grid gap-5 sm:grid-cols-2">
            {supportSections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px] md:p-6"
              >
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 md:text-[15px]">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-[18px] md:p-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400/90">
              Yasal ve hesap kaynakları
            </h2>
            <ul className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {legalResourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-semibold text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <footer className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-5 text-sm leading-relaxed text-slate-400 md:px-8 md:py-6">
            <p className="font-semibold text-slate-300">Yasal not</p>
            <p className="mt-3">
              Leylek TAG, kullanıcıların yol masraflarını paylaşmasına yardımcı olan dijital bir yol paylaşım
              platformudur. Ticari taksi veya profesyonel taşımacılık hizmeti sunmaz.
            </p>
          </footer>
        </div>
      </Container>
    </section>
  );
}
