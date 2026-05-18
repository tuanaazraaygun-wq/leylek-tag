import Link from "next/link";
import { BrandingImage } from "@/components/branding-image";
import { Container } from "@/components/container";
import { BRANDING_PATHS, LEGACY_FALLBACK_ICON } from "@/lib/branding-assets";
import { SUPPORT_EMAIL } from "@/lib/site-contact";

const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG web sitesinden mesaj")}`;
const feedbackMailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG destek · geri bildirim")}`;

const productLinks = [
  { href: "/sehir-ici", label: "Şehir içi" },
  { href: "/sehirler-arasi", label: "Şehirler arası" },
  { href: "/muhabbet", label: "Leylek Teklifi" },
  { href: "/indir", label: "Mobil vitrin" },
  { href: "/guvenlik", label: "Güvenlik" },
] as const;

const legalLinks = [
  { href: "/gizlilik-politikasi", label: "Gizlilik Politikası" },
  { href: "/kullanim-sartlari", label: "Kullanım Şartları" },
  { href: "/kvkk", label: "KVKK" },
  { href: "/hesap-silme", label: "Hesap Silme" },
  { href: "/delete-account", label: "İngilizce hesap silme" },
] as const;

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer-shell relative isolate overflow-hidden border-t border-white/[0.05] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-14 md:pb-20 md:pt-16 lg:pt-[4.85rem]">
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,14,30,0.92)_0%,#020710_48%,#010205_100%)]" aria-hidden />
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent opacity-90 blur-[0.5px]"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent opacity-60"
        aria-hidden
      />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_62%_at_18%_0%,rgba(0,214,255,0.06),transparent_55%)] opacity-90" aria-hidden />
      <span className="subtle-grid pointer-events-none absolute inset-0 opacity-[0.06] md:opacity-[0.07]" aria-hidden />

      <Container className="relative">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-14 xl:gap-x-14">
          <div className="lg:col-span-3">
            <Link href="/" className="group inline-flex flex-col rounded-2xl outline-none ring-offset-[#020710] focus-visible:ring-2 focus-visible:ring-cyan-400/50" aria-label="Leylek TAG ana sayfa">
              <div className="flex items-center gap-3.5 rounded-2xl p-1 transition duration-300 ease-out group-hover:bg-white/[0.03]">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.9375rem] border border-white/[0.1] bg-white/[0.05] shadow-[0_16px_42px_-14px_rgba(0,114,255,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-300 group-hover:border-cyan-400/28">
                  <BrandingImage
                    sources={[BRANDING_PATHS.logoMark, BRANDING_PATHS.logoMarkPngFallback, LEGACY_FALLBACK_ICON]}
                    alt=""
                    width={52}
                    height={52}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </span>
                <span className="text-left leading-tight">
                  <span className="flex flex-wrap items-baseline gap-x-1 font-black tracking-tight text-white">
                    <span className="text-[1.15rem] sm:text-xl">Leylek</span>
                    <span className="bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0072FF] bg-clip-text text-[1.15rem] text-transparent sm:text-xl">
                      TAG
                    </span>
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Ürün vitrini</span>
                  <span className="mt-3 block max-w-[11rem] text-[10px] font-medium leading-relaxed text-slate-500">
                    Toplulukla birlikte gelişen güven odaklı mobil deneyim
                  </span>
                </span>
              </div>
              <p className="mt-6 max-w-sm text-[13px] font-normal leading-[1.75] text-slate-400">
                Leylek TAG; rota netliği, karşılıklı onay ve QR doğrulama katmanlarıyla yolculuk paylaşımını ürünleştirir. Web görünümü süreci şeffaf
                gösterir; tam akış uygulamada ilerler.
              </p>
            </Link>
          </div>

          <nav className="min-w-0 lg:col-span-3" aria-labelledby="footer-product-heading">
            <h2 id="footer-product-heading" className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/76">
              Ürün
            </h2>
            <ul className="mt-5 space-y-3.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13.75px] font-medium text-slate-200 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="min-w-0 lg:col-span-3" aria-labelledby="footer-legal-heading">
            <h2 id="footer-legal-heading" className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/76">
              Yasal
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13.75px] font-medium leading-relaxed text-slate-400 transition hover:text-slate-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 lg:col-span-3">
            <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] px-6 py-6 shadow-[0_26px_64px_-32px_rgba(0,198,255,0.42),inset_0_1px_0_rgba(255,255,255,0.052)] backdrop-blur-md lg:rounded-[1.375rem] lg:py-7">
              <span
                className="pointer-events-none absolute inset-px rounded-[1.285rem] bg-gradient-to-br from-cyan-400/[0.07] via-transparent to-violet-500/[0.05] lg:rounded-[calc(1.375rem-1px)]"
                aria-hidden
              />
              <h2 className="relative text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/76">Destek</h2>
              <p className="relative mt-4 text-[14px] font-semibold leading-snug tracking-tight text-white">
                Leylek TAG ekibine yazabilirsin.
                <span className="mt-3 block font-normal leading-[1.7] tracking-normal text-slate-400">
                  Geri bildirimin bizim için önemli.
                </span>
              </p>
              <Link
                href={feedbackMailHref}
                className="relative mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-cyan-400/28 bg-white/[0.04] px-4 py-2.5 text-center text-[12.5px] font-semibold tracking-wide text-white transition hover:border-cyan-300/52 hover:bg-white/[0.07]"
              >
                Destek · geri bildirim
              </Link>
              <Link
                href={mailHref}
                className="relative mt-2.5 flex min-h-[44px] flex-wrap items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium tracking-wide text-cyan-100/92 underline-offset-4 transition hover:text-white hover:underline"
              >
                {SUPPORT_EMAIL}
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mt-14 border-t border-white/[0.046] pt-9 md:mt-[3.85rem] md:pt-11">
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/18 to-transparent"
            aria-hidden
          />
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
            <div className="min-w-0 space-y-2.5">
              <p className="text-[12px] font-medium leading-relaxed tracking-wide text-slate-400">
                © {currentYear} Leylek TAG
              </p>
              <p className="max-w-xl text-[12px] font-normal leading-[1.76] text-slate-500">
                Beta süreci · Topluluk odaklı · Web bilgi vitrini · Uygulamada süreç
              </p>
              <p className="max-w-xl text-[12px] font-normal leading-[1.74] text-slate-600">
                Tüm hakları saklıdır.
              </p>
            </div>
            <Link
              href="/"
              className="shrink-0 text-[12px] font-medium text-slate-500 underline-offset-4 transition hover:text-cyan-200/92 hover:underline md:text-right"
            >
              Ana sayfaya git
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
