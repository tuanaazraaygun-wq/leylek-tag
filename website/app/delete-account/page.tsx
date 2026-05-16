import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";

const supportEmail = "support@leylektag.com";
const deletionRequestMailto = `mailto:${supportEmail}?subject=${encodeURIComponent(
  "Leylek TAG — Account Deletion Request",
)}`;

export const metadata: Metadata = {
  title: {
    absolute: "Leylek TAG - Account Deletion",
  },
  description:
    "Request permanent deletion of your Leylek TAG account and personal data securely.",
  alternates: {
    canonical: "/delete-account",
  },
  openGraph: {
    title: "Leylek TAG - Account Deletion",
    description:
      "Request permanent deletion of your Leylek TAG account and personal data securely.",
    url: "/delete-account",
  },
};

export default function DeleteAccountPage() {
  return (
    <section className="py-12 md:py-20">
      <Container>
        <div className="mx-auto max-w-4xl space-y-10 md:space-y-14">
          <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-[22px] md:p-10">
            <Link
              href="/"
              className="text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
            >
              ← Anasayfaya dön
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400/90">
              Privacy &amp; account
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl md:leading-tight">
              Leylek TAG Account Deletion
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              Manage your account and personal data securely.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={deletionRequestMailto}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 px-6 py-3 text-center text-sm font-bold tracking-wide text-white shadow-[0_12px_40px_rgba(220,38,38,0.35)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
              >
                Delete Account Request
              </a>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm font-semibold text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
              >
                {supportEmail}
              </a>
            </div>
          </header>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px] md:p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                  aria-hidden
                >
                  ✓
                </span>
                Verified process
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Deletion requests are handled through official in-app and support channels so your identity and intent stay protected.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px] md:p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
                  aria-hidden
                >
                  ◈
                </span>
                Data retention
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                We delete personal data when no longer needed, except where law or security duties require limited, secure retention.
              </p>
            </article>
            <article className="sm:col-span-2 lg:col-span-1 rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-[20px] md:p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-200"
                  aria-hidden
                >
                  ⧗
                </span>
                Timeline
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Requests are processed within thirty (30) days. You will receive updates through the same channel you used to contact us.
              </p>
            </article>
          </div>

          <div className="grid gap-8 md:grid-cols-2 md:gap-10">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-[18px] md:p-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400/90">English</h2>
              <div className="mt-5 space-y-5 text-sm leading-relaxed text-slate-200 md:text-[15px]">
                <p>
                  Users can permanently request deletion of their Leylek TAG account directly from the mobile application settings
                  page or by contacting support.
                </p>
                <p>Deletion requests are processed within 30 days.</p>
                <p>
                  Personal data is permanently deleted unless retention is legally required for fraud prevention, dispute resolution,
                  financial regulations, or security obligations.
                </p>
                <p>
                  <span className="font-semibold text-white">Support:</span>{" "}
                  <a
                    href={`mailto:${supportEmail}`}
                    className="font-semibold text-cyan-300 underline-offset-2 hover:underline"
                  >
                    {supportEmail}
                  </a>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-[18px] md:p-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400/90">Türkçe</h2>
              <div className="mt-5 space-y-5 text-sm leading-relaxed text-slate-200 md:text-[15px]">
                <p>
                  Leylek TAG hesabınızı silmek için mobil uygulama içerisindeki Ayarlar &gt; Hesap Silme alanını kullanabilir veya{" "}
                  <a
                    href={`mailto:${supportEmail}`}
                    className="font-semibold text-cyan-300 underline-offset-2 hover:underline"
                  >
                    {supportEmail}
                  </a>{" "}
                  adresinden destek ekibimize ulaşabilirsiniz.
                </p>
                <p>Hesap silme talepleri en geç 30 gün içerisinde işleme alınır.</p>
                <p>
                  Yasal yükümlülükler, güvenlik, dolandırıcılık önleme ve finansal kayıt gereksinimleri kapsamındaki veriler gerekli
                  süre boyunca güvenli şekilde saklanabilir.
                </p>
              </div>
            </div>
          </div>

          <footer className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-center text-xs leading-relaxed text-slate-400 md:px-8 md:text-sm">
            This page describes how to request account deletion for Leylek TAG. For other legal notices, please refer to the Privacy
            Policy and Terms of Use on this website. Karekod Teknoloji ve Yazılım A.Ş. operates Leylek TAG with a commitment to
            lawful, transparent data handling.
          </footer>
        </div>
      </Container>
    </section>
  );
}
