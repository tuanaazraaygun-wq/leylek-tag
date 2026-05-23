import type { ReactNode } from "react";
import { LEYLEK_ZEKA_CAPABILITIES } from "@/lib/home-operations-feed";

const trustItems = [
  {
    id: "video-trust",
    title: "Görüntülü güven görüşmesi",
    description: "Yolculuk öncesi yüz yüze tanışma adımı",
    status: "Hazır",
    icon: (
      <path
        d="M4 7.5h8.5l2.5-1.8a1 1 0 0 1 1.5.86V16.5a1 1 0 0 1-1.5.86L12.5 15.5H4A1.5 1.5 0 0 1 2.5 14V9A1.5 1.5 0 0 1 4 7.5Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: "comms",
    title: "Sesli ve yazılı iletişim",
    description: "Uygulama içi kontrollü mesajlaşma ve arama",
    status: "Aktif",
    icon: (
      <path
        d="M6 5.5h12A1.5 1.5 0 0 1 19.5 7v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.5V16.5H6A1.5 1.5 0 0 1 4.5 15V7A1.5 1.5 0 0 1 6 5.5Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: "profile",
    title: "Profil görünürlüğü",
    description: "Doğrulanmış profil sinyalleri ve güven katmanı",
    status: "Doğrulandı",
    icon: (
      <>
        <circle cx="12" cy="9" r="3.25" fill="currentColor" />
        <path d="M5.5 18.5c1.4-2.8 3.6-4 6.5-4s5.1 1.2 6.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "route-offer",
    title: "Rota uyumlu öneri teklif",
    description: "Aynı yön ve rota eşleşmesine göre akıllı teklif",
    status: "İzleniyor",
    icon: (
      <path
        d="M5 17.5 10 6.5l4 5.5 5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "qr",
    title: "QR başlangıç/bitiş doğrulaması",
    description: "Yolculuk başlangıç ve bitiş noktasında doğrulama",
    status: "QR aktif",
    icon: (
      <>
        <rect x="5" y="5" width="6" height="6" rx="1" fill="currentColor" />
        <rect x="13" y="5" width="6" height="6" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="5" y="13" width="6" height="6" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="13.5" y="13.5" width="5" height="5" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
];

function TrustProtocolIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/8 text-cyan-200/90">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

export function HomeCommunicationTrust() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-slate-950/30 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/75">
            güven protokolü
          </p>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200/80">
            5 katman aktif
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {trustItems.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-xl border border-white/[0.06] bg-slate-950/40 px-3 py-2.5"
            >
              <TrustProtocolIcon>{item.icon}</TrustProtocolIcon>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-[13px] font-semibold leading-snug text-slate-100">{item.title}</p>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    {item.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-violet-400/12 bg-gradient-to-br from-violet-500/[0.06] to-slate-950/40 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/80">
              leylek zeka
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-100">Operasyon destek katmanı</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Karar vermez; rota, teklif ve güven akışlarında yönlendirme sağlar.
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-violet-100/90">
            Destek
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEYLEK_ZEKA_CAPABILITIES.map((cap) => (
            <li
              key={cap.id}
              className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2"
            >
              <p className="text-[12px] font-semibold text-slate-100">{cap.title}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{cap.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
