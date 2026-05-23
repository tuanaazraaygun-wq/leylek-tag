"use client";

import Image from "next/image";
import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { IPAD_SHOWCASE_SLIDES } from "@/lib/app-screenshot-slides";
import { IPAD_SHOWCASE_IMAGE_HEIGHT, IPAD_SHOWCASE_IMAGE_WIDTH } from "@/lib/branding-assets";

const AUTOPLAY_MS = 7_500;

type TrustAccent = "cyan" | "sky" | "amber" | "violet" | "slate";

function IconMutual({ className = "h-[1.1rem] w-[1.1rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <circle cx={9} cy={10} r={2.75} />
      <circle cx={15} cy={14} r={2.75} />
      <path strokeLinecap="round" d="M6 19v-.75A3.25 3.25 0 0 1 9.25 15h1.25M18 19v-.75A3.25 3.25 0 0 0 14.75 15h-1.25" />
    </svg>
  );
}

function IconRoute({ className = "h-[1.1rem] w-[1.1rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M4 18h9M4 12h13M4 6h17" opacity={0.35} />
      <circle cx={17} cy={6} r={2.75} />
      <circle cx={10} cy={12} r={2.75} />
      <circle cx={13} cy={18} r={2.75} />
    </svg>
  );
}

function IconQr({ className = "h-[1.1rem] w-[1.1rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M5 5h7v7H5V5Zm7 14h7v7h-7v-7Z" />
      <path strokeLinecap="round" d="M19 6v12M6 19h6" opacity={0.35} strokeDasharray="1.75 3" />
    </svg>
  );
}

function IconShield({ className = "h-[1.1rem] w-[1.1rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 21.25-8-3.25v-8.5c0-3.5 8-7 8-7s8 3.5 8 7v8.5l-8 3.25Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" opacity={0.75} />
    </svg>
  );
}

function IconMinData({ className = "h-[1.1rem] w-[1.1rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M8 8h8v8H8z" opacity={0.32} />
      <path strokeLinecap="round" d="M10.25 10.25h3.5v3.5h-3.5z" />
    </svg>
  );
}

const accentStyles: Record<
  TrustAccent,
  { icon: string; border: string; glow: string }
> = {
  cyan: {
    icon: "border-cyan-400/30 bg-cyan-500/12 text-cyan-100",
    border: "border-l-cyan-400/55",
    glow: "group-hover:shadow-[0_12px_36px_-22px_rgba(34,211,238,0.45)]",
  },
  sky: {
    icon: "border-sky-400/28 bg-sky-500/10 text-sky-100",
    border: "border-l-sky-400/50",
    glow: "group-hover:shadow-[0_12px_36px_-22px_rgba(56,189,248,0.38)]",
  },
  amber: {
    icon: "border-amber-400/28 bg-amber-500/10 text-amber-100",
    border: "border-l-amber-400/45",
    glow: "group-hover:shadow-[0_12px_36px_-22px_rgba(251,191,36,0.28)]",
  },
  violet: {
    icon: "border-violet-400/28 bg-violet-500/10 text-violet-100",
    border: "border-l-violet-400/45",
    glow: "group-hover:shadow-[0_12px_36px_-22px_rgba(139,92,246,0.32)]",
  },
  slate: {
    icon: "border-slate-400/25 bg-slate-500/10 text-slate-100",
    border: "border-l-slate-400/40",
    glow: "group-hover:shadow-[0_12px_36px_-22px_rgba(148,163,184,0.22)]",
  },
};

const trustLayers: ReadonlyArray<{
  Icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  accent: TrustAccent;
}> = [
  {
    Icon: IconMutual,
    title: "Kontrollü çift onaylı eşleşme",
    body: "İki taraf netleşmeden süreç ilerlemez.",
    accent: "cyan",
  },
  {
    Icon: IconRoute,
    title: "Rota ve teklif şeffaflığı",
    body: "Güzergâh ve teklif çerçevesi iki tarafta aynı görünür.",
    accent: "sky",
  },
  {
    Icon: IconQr,
    title: "QR doğrulama",
    body: "Biniş ve bitiş adımları kontrollü teyit edilir.",
    accent: "amber",
  },
  {
    Icon: IconShield,
    title: "Güven katmanı bildirimi",
    body: "Durum güncellemeleri şeffaf akışta izlenir.",
    accent: "violet",
  },
  {
    Icon: IconMinData,
    title: "Minimum veri paylaşımı",
    body: "Gereksiz kişisel detay yayılımı sınırlanır.",
    accent: "slate",
  },
];

function VitrinSlideImage({
  slide,
  phase,
  priority,
}: {
  slide: (typeof IPAD_SHOWCASE_SLIDES)[number];
  phase: "static" | "in" | "out";
  priority?: boolean;
}) {
  const imgW = slide.imageWidth ?? IPAD_SHOWCASE_IMAGE_WIDTH;
  const imgH = slide.imageHeight ?? IPAD_SHOWCASE_IMAGE_HEIGHT;
  const animClass = phase === "in" ? "trust-vitrin-in" : phase === "out" ? "trust-vitrin-out" : "";

  return (
    <Image
      src={slide.src}
      alt={slide.alt}
      width={imgW}
      height={imgH}
      className={`absolute inset-0 h-full w-full object-contain object-center ${animClass}`}
      sizes="(max-width: 1024px) 92vw, 560px"
      unoptimized
      priority={priority}
      loading={priority ? undefined : "lazy"}
    />
  );
}

export function TrustArchitectureShowcase() {
  const slides = IPAD_SHOWCASE_SLIDES;
  const [activeIndex, setActiveIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hoverPausedRef = useRef(false);
  const reduceMotionRef = useRef(false);

  const activeSlide = slides[activeIndex] ?? slides[0];

  const setSlideIndex = useCallback(
    (next: number) => {
      if (next === activeIndex) return;
      if (reduceMotionRef.current) {
        setActiveIndex(next);
        return;
      }
      setOutgoingIndex(activeIndex);
      setActiveIndex(next);
      window.setTimeout(() => setOutgoingIndex(null), 420);
    },
    [activeIndex],
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceMotionRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      if (hoverPausedRef.current || lightboxOpen) return;
      if (reduceMotionRef.current) return;
      setSlideIndex((activeIndex + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [activeIndex, lightboxOpen, setSlideIndex, slides.length]);

  const openLightbox = useCallback(() => setLightboxOpen(true), []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const vitrinPanel = (
    <div
      className="relative w-full min-w-0 lg:col-start-1 lg:row-start-1"
      onMouseEnter={() => {
        hoverPausedRef.current = true;
      }}
      onMouseLeave={() => {
        hoverPausedRef.current = false;
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.11] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-3 shadow-[0_24px_64px_-36px_rgba(0,114,255,0.42)] ring-1 ring-cyan-400/10 backdrop-blur-md sm:p-4">
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.07),transparent_62%)]" aria-hidden />

        <div className="relative mb-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/22 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100/90">
            <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.65)]" aria-hidden />
            Canlı güven akışı
          </span>
          <span className="inline-flex items-center rounded-full border border-cyan-400/22 bg-cyan-500/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/88">
            QR doğrulama aktif
          </span>
        </div>

        <p className="relative mb-2 text-center text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/75">
          App Store · iPad vitrin
        </p>

        <button
          type="button"
          onClick={openLightbox}
          className="group relative mx-auto block w-full max-w-[min(100%,36rem)] cursor-zoom-in overflow-hidden rounded-xl border border-white/[0.11] bg-[#070d14] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_48px_-28px_rgba(0,114,255,0.35)] transition duration-300 ease-out hover:border-cyan-400/28 hover:shadow-[0_20px_56px_-26px_rgba(34,211,238,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/60 lg:max-w-none"
          aria-label={`${activeSlide.alt} — büyüt`}
        >
          <div className="relative aspect-[2752/2064] w-full">
            {outgoingIndex !== null ? (
              <VitrinSlideImage slide={slides[outgoingIndex]!} phase="out" />
            ) : null}
            <VitrinSlideImage slide={activeSlide} phase={outgoingIndex !== null ? "in" : "static"} priority={activeIndex === 0} />
          </div>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-10 text-left text-[11px] font-semibold text-white/95 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Büyütmek için tıkla
          </span>
        </button>

        <p className="relative mt-3 text-center text-[11px] font-medium leading-relaxed text-slate-300/90 sm:text-xs">
          {activeSlide.caption}
        </p>

        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {slides.map((s, index) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setSlideIndex(index)}
              className={`rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
                index === activeIndex
                  ? "h-1.5 w-5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.42)]"
                  : "h-1.5 w-1.5 bg-white/22 hover:bg-white/42"
              }`}
              aria-label={`Ekran ${index + 1}${index === activeIndex ? " (aktif)" : ""}`}
              aria-current={index === activeIndex ? true : undefined}
            />
          ))}
        </div>

        <p className="relative mt-2.5 text-center">
          <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            10 ekran · otomatik vitrin
          </span>
        </p>
      </div>
    </div>
  );

  const trustCards = (
    <ul className="flex min-w-0 flex-col gap-2 sm:gap-2.5 lg:col-start-2 lg:row-start-1">
      {trustLayers.map(({ Icon, title, body, accent }) => {
        const styles = accentStyles[accent];
        return (
          <li key={title}>
            <article
              className={`group relative overflow-hidden rounded-xl border border-white/[0.09] border-l-[3px] ${styles.border} bg-gradient-to-br from-white/[0.045] to-white/[0.02] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition duration-300 ease-out hover:-translate-y-0.5 hover:border-white/[0.14] ${styles.glow} focus-within:border-cyan-400/25 sm:px-4 sm:py-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
                style={{ background: "linear-gradient(105deg, rgba(34,211,238,0.04) 0%, transparent 55%)" }}
              />
              <div className="relative flex gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 group-hover:brightness-110 ${styles.icon}`}
                  aria-hidden
                >
                  <Icon />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[12.5px] font-bold leading-snug tracking-tight text-white sm:text-[13px]">{title}</h3>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400/95">{body}</p>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <header className="relative mb-5 max-w-3xl md:mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200/75 sm:text-[11px]">
          güven mimarisi
        </p>
        <h2 className="mt-2 text-xl font-black leading-tight tracking-tight text-white sm:text-2xl lg:text-[1.65rem]">
          Kontrollü eşleşme ve doğrulanmış güven katmanları
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          App Store ile uyumlu 10 premium iPad ekranı — yatay vitrin ve güven katmanları bir arada.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] lg:gap-7 xl:gap-8">
        {vitrinPanel}
        {trustCards}
      </div>

      <ScreenshotLightbox
        open={lightboxOpen}
        slides={slides}
        activeIndex={activeIndex}
        onClose={closeLightbox}
        onSelectIndex={setSlideIndex}
      />
    </>
  );
}
