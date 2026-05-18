"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandingImage } from "@/components/branding-image";
import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { NavbarSiteAuthDrawer, NavbarSiteAuthTop } from "@/components/navbar-site-auth";
import { BRANDING_PATHS, LEGACY_FALLBACK_ICON } from "@/lib/branding-assets";

const navItems = [
  { href: "/sehir-ici", label: "Şehir İçi" },
  { href: "/muhabbet", label: "Leylek Teklifi" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > 14);
  }, []);

  useEffect(() => {
    let rafId = 0;
    rafId = window.requestAnimationFrame(() => onScroll());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, [onScroll]);

  return (
    <header className="sticky top-0 z-50 pt-3 sm:pt-3.5">
      <Container className="max-w-[100vw] overflow-x-hidden">
        <div
          className={`relative rounded-[1.125rem] border border-white/[0.085] px-4 py-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[background-color,box-shadow] duration-300 sm:rounded-[1.25rem] sm:px-5 sm:py-3 ${
            scrolled
              ? "bg-black/58 shadow-[0_24px_64px_-24px_rgba(0,114,255,0.22)] ring-1 ring-white/[0.05]"
              : "bg-black/38 ring-1 ring-white/[0.04]"
          }`}
        >
          <div className="flex min-h-[52px] items-center justify-between gap-3 sm:min-h-[56px] sm:gap-4">
            <Link
              href="/"
              className="tap-highlight flex min-h-[48px] min-w-0 max-w-[calc(100%-6.5rem)] flex-1 items-center gap-3 overflow-hidden rounded-xl pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55 sm:max-w-none sm:gap-3.5 sm:pr-0 lg:flex-none lg:gap-4"
              aria-label="Leylek TAG ana sayfa"
            >
              <span className="relative shrink-0">
                <span className="absolute inset-[-1px] rounded-[0.9375rem] bg-gradient-to-tr from-[#00C6FF]/28 via-[#5b8dff]/28 to-[#6C63FF]/22 blur-[10px]" />
                <span className="relative flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-[0.9375rem] border border-white/[0.14] bg-white/[0.07] shadow-[0_14px_32px_-6px_rgba(0,114,255,0.2)] sm:h-[54px] sm:w-[54px] md:h-[58px] md:w-[58px]">
                  <BrandingImage
                    sources={[BRANDING_PATHS.logoMark, BRANDING_PATHS.logoMarkPngFallback, LEGACY_FALLBACK_ICON]}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover [filter:drop-shadow(0_0_6px_rgba(0,198,255,0.22))]"
                    priority
                    unoptimized
                  />
                </span>
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span className="flex flex-wrap items-baseline gap-x-1 font-black tracking-tight text-white">
                  <span className="text-lg sm:text-xl md:text-[1.375rem]">Leylek</span>
                  <span className="bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0072FF] bg-clip-text text-lg text-transparent sm:text-xl md:text-[1.375rem]">
                    TAG
                  </span>
                </span>
                <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400/95 sm:text-[11px] sm:tracking-[0.22em]">
                  Güvenli yolculuk paylaşımı
                </span>
              </span>
            </Link>

            <nav className="hidden min-w-0 items-center gap-0.5 lg:flex" aria-label="Ana menü">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                    pathname === item.href
                      ? "bg-cyan-300/[0.12] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.18)]"
                      : "text-slate-300/92 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <NavbarSiteAuthTop />
              <ButtonLink
                href="/indir"
                className="hidden !min-h-[44px] whitespace-nowrap !rounded-full !px-4 !py-2.5 !text-[13px] !shadow-[0_10px_28px_-6px_rgba(0,198,255,0.35)] hover:!shadow-[0_14px_36px_-4px_rgba(0,198,255,0.42)] sm:inline-flex"
              >
                Uygulamayı İndir
              </ButtonLink>
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.06] text-white transition-all duration-300 hover:bg-white/[0.1] active:scale-[0.97] lg:hidden"
                aria-label="Mobil menüyü aç"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((current) => !current)}
              >
                <span className="grid gap-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </Container>

      {isOpen ? (
        <Container className="mt-3 overflow-x-hidden pb-4 lg:hidden">
          <nav className="glass-panel grid gap-2 rounded-2xl p-3" aria-label="Mobil menü">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  pathname === item.href ? "bg-cyan-300/14 text-cyan-100" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <NavbarSiteAuthDrawer onNavigate={() => setIsOpen(false)} />
            <ButtonLink href="/indir" className="mt-1 w-full !py-3" onClick={() => setIsOpen(false)}>
              Uygulamayı İndir
            </ButtonLink>
          </nav>
        </Container>
      ) : null}
    </header>
  );
}
