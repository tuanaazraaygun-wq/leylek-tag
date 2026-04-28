"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

const navItems = [
  { href: "/sehir-ici", label: "Şehir İçi" },
  { href: "/muhabbet", label: "Muhabbet" },
  { href: "/sehirler-arasi", label: "Şehirler Arası" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-midnight/70 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <Container className="flex min-h-[76px] items-center justify-between gap-5">
        <Link href="/" className="flex items-center gap-3" aria-label="Leylek Tag ana sayfa">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/20 bg-white/10 shadow-glow">
            <Image src="/logo-leylek.svg" alt="" width={38} height={38} priority />
          </span>
          <span>
            <span className="block text-base font-black tracking-tight text-white">Leylek Tag</span>
            <span className="block text-xs font-medium text-cyan-100/70">Yolculuk topluluğu</span>
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15 lg:hidden"
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
