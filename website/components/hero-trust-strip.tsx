import type { ComponentType } from "react";

function IconMutual() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <circle cx={12} cy={12} r={9} strokeOpacity={0.2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 8.25h10.5M9 15.75h7.5" />
      <circle cx={7.875} cy={12} r={1.375} opacity={0.35} stroke="none" fill="currentColor" />
      <circle cx={16.125} cy={12} r={1.375} opacity={0.55} stroke="none" fill="currentColor" />
    </svg>
  );
}

function IconRoadmap() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" d="M4.75 17.25h14.5M4.75 12h10M4.75 6.75h14.5" />
      <circle cx={18} cy={6.75} r={2} strokeLinecap="round" />
      <circle cx={10} cy={12} r={2} strokeLinecap="round" />
      <circle cx={14} cy={17.25} r={2} strokeLinecap="round" />
    </svg>
  );
}

function IconQrFrame() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" d="M4.75 8.75V6.75a2 2 0 0 1 2-2h2" />
      <path strokeLinecap="round" d="M17.75 19.75h2a2 2 0 0 0 2-2v-3" />
      <path strokeLinecap="round" d="m19.25 4.75 3 3v2.75" />
      <path strokeLinecap="round" d="M14.75 8.75V5.75a2 2 0 0 0-2-2h-8" />
      <path strokeLinecap="round" d="M13.75 19.75h5.75" />
      <path strokeLinecap="round" d="M15.75 15.75h6" opacity={0.45} />
      <path strokeLinecap="round" d="m6.75 15.75-2 4" opacity={0.45} />
    </svg>
  );
}

function IconShieldFlow() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 21.375-8.25-3.375v-9c0-3.975 8.25-7.875 8.25-7.875s8.25 3.9 8.25 7.875v9L12 21.375Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" opacity={0.75} />
    </svg>
  );
}

function IconMinimalShare() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <circle cx={12} cy={12} r={9} strokeOpacity={0.22} />
      <path strokeLinecap="round" d="m8 12 h8 M12 8v8" opacity={0.35} strokeDasharray="1.5 2.5" />
      <circle cx={12} cy={12} r={2.25} />
    </svg>
  );
}

/** Bento: featured + 2 compact + 2 medium — gövde metinleri kısaltılmış. */
const FEATURED = {
  icon: IconMutual,
  title: "Karşılıklı onay",
  body: "Her iki taraf onaylamadan süreç ilerlemez — temel güvence katmanı.",
} as const;

const COMPACT_GOALS = [
  {
    icon: IconRoadmap,
    title: "Net rota görünümü",
    body: "Rota, zaman ve teklif çerçevesi görünür tutulur.",
  },
  {
    icon: IconQrFrame,
    title: "QR ile teyit",
    body: "Başlangıç ve bitişte kontrollü doğrulama adımları.",
  },
] as const;

const MEDIUM_GOALS = [
  {
    icon: IconShieldFlow,
    title: "Güven akışı",
    body: "Geri bildirim ve bildirim kanalları desteklenir.",
  },
  {
    icon: IconMinimalShare,
    title: "Minimum veri",
    body: "Teklif için gereksiz kişisel paylaşıma gerek olmaması hedeflenir.",
  },
] as const;

function BentoInner({
  Icon,
  title,
  body,
  iconBoxClass,
}: {
  Icon: ComponentType<object>;
  title: string;
  body: string;
  iconBoxClass?: string;
}) {
  return (
    <>
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-md transition duration-[380ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] group-hover:border-cyan-400/26 group-hover:shadow-[0_12px_40px_-26px_rgba(0,198,255,0.42)] ${iconBoxClass ?? "h-12 w-12"}`}
      >
        <span className="text-cyan-100/93">
          <Icon />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={`font-black leading-snug tracking-tight text-white ${title.length > 18 ? "text-[0.9575rem] sm:text-base" : "text-base sm:text-[1.05rem]"}`}>
          {title}
        </h3>
        <p className="mt-2.5 max-w-xl text-[12.75px] leading-relaxed tracking-wide text-slate-400 sm:text-[13.25px]">{body}</p>
      </div>
    </>
  );
}

export function HeroTrustStrip() {
  return (
    <div className="mt-14 sm:mt-16 lg:mt-[4.25rem]">
      <div className="relative overflow-hidden rounded-[1.65rem] p-[1px] shadow-[0_28px_88px_-36px_rgba(0,114,255,0.38)] md:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/14 via-transparent to-violet-500/12 opacity-95" aria-hidden />
        <div className="relative rounded-[calc(1.65rem-1px)] border border-white/[0.056] bg-gradient-to-br from-[#071018]/94 via-[#050a14]/92 to-black/[0.96] px-6 py-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.042)] backdrop-blur-md sm:px-8 sm:py-10 md:rounded-[calc(2rem-1px)] md:px-11 md:py-12">
          <header className="mx-auto max-w-3xl text-center md:text-left md:mx-0">
            <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200/68 sm:text-[11px]">hedef ilkeler</p>
            <h2 className="mt-3.5 text-xl font-black leading-[1.1] tracking-tight text-white sm:text-[1.725rem] md:text-[2.05rem]">
              Leylek TAG neyi hedefliyor?
            </h2>
          </header>

          <div className="mx-auto mt-11 grid max-w-6xl grid-cols-1 gap-5 sm:mt-12 md:mx-0 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-6 xl:gap-x-8">
            <article className="vitrin-card group relative flex min-h-[12.5rem] flex-col gap-5 rounded-[1.35rem] p-[1px] lg:col-span-7 lg:row-span-2 lg:min-h-0">
              <div className="relative flex min-h-[11.5rem] flex-1 flex-col gap-6 rounded-[1.295rem] border border-white/[0.058] bg-slate-950/[0.32] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-lg transition-[transform] duration-[480ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] will-change-transform group-hover:border-white/[0.095] group-hover:shadow-[0_26px_64px_-42px_rgba(0,198,255,0.42)] motion-reduce:transition-none sm:flex-row sm:items-start sm:px-8 sm:py-9 lg:h-full lg:min-h-[19.5rem] lg:flex-col xl:gap-8">
                <BentoInner Icon={FEATURED.icon} title={FEATURED.title} body={FEATURED.body} iconBoxClass="h-14 w-14 [&_svg]:h-8 [&_svg]:w-8" />
                <p className="mt-auto pt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:pt-0 lg:max-w-[20rem]">Öncelik: kontrol şeffaflığı</p>
              </div>
            </article>

            <div className="grid gap-5 sm:grid-cols-2 lg:contents">
              {COMPACT_GOALS.map(({ icon: Icon, title, body }, idx) => (
                <article
                  key={title}
                  className={`vitrin-card group rounded-[1.18rem] p-[1px] lg:col-span-5 ${idx === 0 ? "lg:row-start-1 lg:col-start-8" : "lg:row-start-2 lg:col-start-8"}`}
                >
                  <div className="flex min-h-[7.85rem] items-start gap-4 rounded-[calc(1.18rem-1px)] border border-white/[0.054] bg-slate-950/[0.28] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md sm:min-h-0 lg:py-6">
                    <BentoInner Icon={Icon} title={title} body={body} iconBoxClass="h-11 w-11 [&_svg]:h-[1.4rem] [&_svg]:w-[1.4rem]" />
                  </div>
                </article>
              ))}
            </div>

            {MEDIUM_GOALS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="vitrin-card group rounded-[1.18rem] p-[1px] lg:col-span-6">
                <div className="flex min-h-[7.65rem] items-start gap-4 rounded-[calc(1.18rem-1px)] border border-white/[0.054] bg-slate-950/[0.26] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.034)] backdrop-blur-md lg:py-6">
                  <BentoInner Icon={Icon} title={title} body={body} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
