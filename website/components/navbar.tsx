"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

const navItems = [
  { href: "/sehir-ici", label: "Şehir İçi" },
  { href: "/muhabbet", label: "Leylek Teklifi" },
  { href: "/sehirler-arasi", label: "Şehirler Arası" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 max-w-[100vw] overflow-x-hidden border-b border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <Container className="flex min-h-[72px] items-center justify-between gap-3 sm:min-h-[76px] sm:gap-5">
        <Link href="/" className="flex min-h-[48px] min-w-0 items-center gap-2 sm:gap-3" aria-label="Leylek Tag ana sayfa">
          <span className="relative shrink-0">
            <span className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-[#00C6FF] via-[#6C63FF] to-[#FF7A18] opacity-75 blur-md" />
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg ring-2 ring-white/10 sm:h-14 sm:w-14">
              <span
                className="absolute right-1 top-1 z-10 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)] ring-2 ring-black/60"
                aria-hidden="true"
              />
              <Image
                src="/app-icon.png"
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover [filter:drop-shadow(0_0_12px_rgba(0,198,255,0.5))_drop-shadow(0_0_20px_rgba(108,99,255,0.25))]"
                priority
              />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black tracking-tight text-white">Leylek Tag</span>
            <span className="block truncate text-[11px] font-medium text-cyan-100/70 sm:text-xs">
              Yolculuk topluluğu
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Ana menü">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                pathname === item.href
                  ? "bg-cyan-300/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.22)]"
                  : "text-slate-200/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink href="/indir" className="hidden sm:inline-flex">
            Uygulamayı İndir
          </ButtonLink>
          <button
            type="button"
            className="inline-flex h-12 min-h-[48px] w-12 min-w-[48px] items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition-all duration-300 hover:scale-105 hover:bg-white/15 active:scale-95 lg:hidden"
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
      </Container>

      {isOpen ? (
        <Container className="pb-5 lg:hidden">
          <nav className="glass-panel grid gap-2 rounded-3xl p-3" aria-label="Mobil menü">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  pathname === item.href ? "bg-cyan-300/15 text-cyan-100" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink href="/indir" className="mt-1 w-full" onClick={() => setIsOpen(false)}>
              Uygulamayı İndir
            </ButtonLink>
          </nav>
        </Container>
      ) : null}
    </header>
  );
}
