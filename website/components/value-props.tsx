/** Premium güven katmanları — featured + uydu kartlar (logic yok, yalnız sunum). */

function VerifiedLinkGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="vp-route-glow" x1="0" y1="56" x2="320" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" stopOpacity={0} />
          <stop offset="0.42" stopColor="#38bdf8" stopOpacity={0.45} />
          <stop offset="0.58" stopColor="#0ea5e9" stopOpacity={0.38} />
          <stop offset="1" stopColor="#38bdf8" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d="M40 74 C 108 74, 120 42, 160 54 C 200 66, 212 92, 280 92"
        stroke="url(#vp-route-glow)"
        strokeWidth="14"
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M40 74 C 108 74, 118 46, 160 54 C 202 62, 214 92, 280 92"
        stroke="#67e8f9"
        strokeOpacity={0.28}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={40} cy={74} r={7} fill="#0c1220" stroke="#7dd3fc" strokeOpacity={0.55} strokeWidth={1.35} />
      <circle cx={280} cy={92} r={7} fill="#0c1220" stroke="#7dd3fc" strokeOpacity={0.55} strokeWidth={1.35} />
      <circle cx={40} cy={74} r={2.75} fill="#a5f3fc" fillOpacity={0.55} />
      <circle cx={280} cy={92} r={2.75} fill="#a5f3fc" fillOpacity={0.55} />
      <path
        d="M157 48h7a8 8 0 0 1 8 8v7.5a9 9 0 0 1-9 9h-12a9 9 0 0 1-9-9V62a14 14 0 1 1 13-13.95Z"
        fill="#08121f"
        stroke="#67e8f9"
        strokeOpacity={0.42}
        strokeWidth={1.15}
      />
      <path
        d="M156 61.75 160.85 67 169.85 54.5"
        stroke="#a5f3fc"
        strokeOpacity={0.88}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HudBaseline({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-full ${className}`} viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden>
      <path d="M0 20h400" stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
      <path
        d="M12 17h52l22-13h118l38 13h154"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphQr({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M5 5h7v7H5V5Zm7 14h7v7h-7v-7Z" opacity={0.95} />
      <path strokeLinecap="round" d="M19 6v12M6 19h6" opacity={0.35} strokeDasharray="1.75 3" />
    </svg>
  );
}

function GlyphRoute({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M4 18h9M4 12h13M4 6h17" opacity={0.35} />
      <circle cx={17} cy={6} r={2.75} opacity={0.85} strokeLinecap="round" />
      <circle cx={10} cy={12} r={2.75} opacity={0.78} strokeLinecap="round" />
      <circle cx={13} cy={18} r={2.75} opacity={0.78} strokeLinecap="round" />
    </svg>
  );
}

function GlyphComms({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 17.75v-11A2 2 0 0 1 8.75 4.75h12.25l-3 3H8.75a1 1 0 0 0-1 1v9"
        opacity={0.88}
      />
      <path strokeLinecap="round" d="M9.75 14.75h11.5a2 2 0 0 0 2-2v-9.5" opacity={0.35} />
    </svg>
  );
}

function GlyphJourneyEnds({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <circle cx={6.5} cy={17} r={3} opacity={0.85} strokeLinecap="round" />
      <circle cx={17.5} cy={7} r={3} opacity={0.85} strokeLinecap="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.75 13.85 10.85-10.7" opacity={0.4} strokeDasharray="2 3" />
    </svg>
  );
}

const secondaryLayers = [
  {
    Icon: GlyphQr,
    title: "QR ile yolculuk doğrulama",
    body:
      "Biniş ve yol sonu için doğrulama akışı; doğrulanmış yolculuk adımlarını güven katmanına bağlar.",
  },
  {
    Icon: GlyphRoute,
    title: "Rota ve teklif şeffaflığı",
    body: "Şeffaf güzergâh ile teklif çerçevesi yan yana okunabilir — rota şeffaflığı, kontrollü eşleşmeyi destekler.",
  },
  {
    Icon: GlyphComms,
    title: "Kontrollü iletişim",
    body: "Eşleşme sonrası kanallar, sürdürülebilir doğrulanmış süreç için sınırlı ve yönlendirilir.",
  },
  {
    Icon: GlyphJourneyEnds,
    title: "Güvenli başlangıç ve bitiş",
    body: "Kontrollü doğrulamalar ile güvenli başlangıç; yol sonunda kapanış adımlarıyla tutarlı bitiş akışı.",
  },
] as const;

export function ValueProps() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6 xl:gap-8">
        <article className="group relative overflow-hidden rounded-[1.4rem] border border-white/[0.068] bg-gradient-to-br from-[#081222]/94 via-[#050a14]/93 to-black/[0.96] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_34px_80px_-42px_rgba(0,198,255,0.42)] ring-1 ring-cyan-400/[0.11] backdrop-blur-[22px] transition-[border-color,box-shadow] duration-500 ease-out md:rounded-[1.55rem] lg:col-span-7 xl:rounded-[1.65rem] hover:border-cyan-400/[0.12] hover:shadow-[0_42px_90px_-40px_rgba(34,211,238,0.26)]">
          <span
            className="pointer-events-none absolute inset-px rounded-[1.385rem] bg-[linear-gradient(145deg,rgba(34,211,238,0.1)_0%,transparent_40%,rgba(59,130,246,0.05)_92%)] opacity-95 md:rounded-[1.535rem]"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-24 left-1/2 h-[19rem] w-[120%] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-8 p-7 sm:p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/28 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/88">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/88" aria-hidden />
                doğrulanmış bağlantı
              </span>
              <span className="rounded-full border border-white/[0.1] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400/95">
                ana güven katmanı
              </span>
            </div>
            <div>
              <h3 className="text-[1.575rem] font-bold leading-[1.12] tracking-tight text-white sm:text-[1.85rem] md:text-[2.05rem]">
                Doğrulanmış kontrollü eşleşme
              </h3>
              <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-slate-300/93">
                Sürücü ile yolcu, doğrulanmış yolculuk öncesi aynı doğrulama akışından geçen bilgileri görür — rota şeffaflığı ve
                teklif bağlamı her iki tarafta hizalı kalır; premium mobilite yaklaşımıyla güven katmanları yolculuk başlamadan
                netleşir.
              </p>
            </div>
            <VerifiedLinkGraphic className="relative z-[1] w-full max-h-[7.75rem] object-contain text-cyan-200/92 sm:max-h-[8.75rem]" />
            <div className="space-y-2">
              <HudBaseline className="h-7 text-slate-500/95" />
            </div>
          </div>
        </article>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-200/72 lg:-mt-0.5">operasyon güven zemini</p>
          <ul className="grid flex-1 grid-cols-1 gap-3.5 sm:gap-4">
            {secondaryLayers.map(({ Icon, title, body }) => (
              <li key={title}>
                <article className="group relative h-full overflow-hidden rounded-[1.15rem] border border-white/[0.055] bg-gradient-to-br from-white/[0.042] via-slate-950/35 to-slate-950/78 p-[1px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.04] backdrop-blur-[16px] transition-[border-color,box-shadow] duration-300 ease-out hover:border-cyan-400/15 md:rounded-[1.22rem]">
                  <div className="flex min-h-[5.85rem] items-start gap-3.5 rounded-[1.135rem] border border-transparent bg-slate-950/50 px-[1rem] py-[1.05rem] md:gap-4 md:px-[1.1rem] md:py-[1.15rem]">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/18 bg-[#0c1524]/94 text-cyan-200/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:h-11 md:w-11"
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-semibold leading-snug tracking-tight text-white">{title}</h4>
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-400/93">{body}</p>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="border-t border-white/[0.05] pt-5 text-center text-[12px] leading-[1.7] text-slate-500 md:text-[12.75px] md:leading-[1.75] lg:text-left">
        <span className="font-semibold text-slate-400">Minimum veri paylaşımı · </span>
        Güvenilir premium mobilite için gerekenden fazlasını istememe ve kontrollü eşleşme sırasında veri yüzeyini dar tutma yaklaşımı ile ürün
        doğrulanmış yolculuk hissini destekler.
      </p>
    </div>
  );
}
