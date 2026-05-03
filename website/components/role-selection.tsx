"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/container";

const roles = [
  {
    href: "/sehir-ici",
    label: "Yolcuyum",
    badge: "Yolculuk teklifi aç",
    description: "Şehir içi veya şehir dışı yolculuk teklifini aç; güvenli eşleşme ve QR adımlarını incele.",
    gradient: "from-[#00C6FF]/90 to-[#0072FF]/90",
    ring: "from-[#00C6FF] to-[#0072FF]",
    hoverGlow: "hover:shadow-[0_0_48px_rgba(0,198,255,0.32)]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" aria-hidden="true">
        <path
          d="M12 11a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0H4z"
          fill="currentColor"
          className="text-white"
        />
      </svg>
    ),
  },
  {
    href: "/indir",
    label: "Sürücüyüm",
    badge: "Boş koltuğunu paylaş",
    description: "Uygulamayı indir; boş koltuğunu şehir içi veya şehir dışı teklifle paylaş.",
    gradient: "from-[#43E97B]/90 to-[#38F9D7]/90",
    ring: "from-[#43E97B] to-[#38F9D7]",
    hoverGlow: "hover:shadow-[0_0_48px_rgba(108,99,255,0.3)]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-10 w-10 sm:h-11 sm:w-11 text-white" fill="none" aria-hidden="true">
        <path
          d="M5 17h14l-1-6H6l-1 6zM6 11l1.5-4h9L18 11M7 17v2M17 17v2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="18" r="1.5" fill="currentColor" />
        <circle cx="16" cy="18" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
] as const;

export function RoleSelection() {
  const pathname = usePathname();

  return (
    <section className="relative py-10 sm:py-14 md:py-20" aria-labelledby="role-selection-heading">
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <Container className="max-w-4xl text-center">
        <h2
          id="role-selection-heading"
          className="break-words text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl"
        >
          Bugün nasıl teklif oluşturmak istersin?
        </h2>
        <p className="mx-auto mt-3 max-w-lg break-words text-base leading-relaxed text-white/80 sm:text-lg">
          Rolünü seç; yolculuk teklifi veya boş koltuk paylaşımına uygun akışa geç.
        </p>
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-6 md:max-w-none md:grid-cols-2 md:gap-8">
          {roles.map((role) => {
            const isSelected = pathname === role.href;
            return (
              <Link
                key={role.href}
                href={role.href}
                aria-current={isSelected ? "page" : undefined}
                className={`tap-highlight group relative flex min-h-[11rem] cursor-pointer flex-col overflow-hidden rounded-2xl border p-5 text-left shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 ease-out hover:scale-[1.05] hover:brightness-110 active:scale-[0.98] active:ring-2 active:ring-white/35 sm:p-6 md:min-h-0 md:p-8 ${
                  isSelected
                    ? "border-white/10 bg-white/10 ring-2 ring-cyan-400"
                    : "border-white/10 bg-white/5"
                } ${role.hoverGlow} hover:border-white/20`}
              >
                <div
                  className={`pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-gradient-to-br ${role.ring} blur-2xl transition-opacity duration-300 ease-out group-hover:opacity-80 ${isSelected ? "opacity-60" : "opacity-28"}`}
                />
                <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${role.gradient} text-4xl shadow-lg ring-2 transition-all duration-300 ease-out group-hover:scale-105 group-hover:shadow-[0_0_28px_rgba(255,255,255,0.2)] md:h-[4.5rem] md:w-[4.5rem] ${isSelected ? "ring-white/45" : "ring-white/20"}`}
                  >
                    {role.icon}
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                    {role.badge}
                  </span>
                </div>
                <h3 className="relative break-words text-xl font-black tracking-tight text-white sm:text-2xl">{role.label}</h3>
                <p className="relative mt-2 break-words text-sm leading-relaxed text-white/80 sm:text-base">{role.description}</p>
                <span className="relative mt-5 inline-flex items-center text-sm font-bold text-white/90">
                  Devam et
                  <svg
                    className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
