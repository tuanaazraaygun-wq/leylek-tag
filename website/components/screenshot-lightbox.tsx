"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppScreenshotSlide } from "@/lib/app-screenshot-slides";

type ScreenshotLightboxProps = {
  open: boolean;
  slides: readonly AppScreenshotSlide[];
  activeIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
  /** Başlık satırı — örn. "App Store vitrin" veya "Uygulama vitrin" */
  titlePrefix?: string;
};

function LightboxChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      {direction === "left" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18 9 12l6-6" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

export function ScreenshotLightbox({
  open,
  slides,
  activeIndex,
  onClose,
  onSelectIndex,
  titlePrefix = "App Store vitrin",
}: ScreenshotLightboxProps) {
  const [exitHold, setExitHold] = useState(false);
  const [visible, setVisible] = useState(false);
  const [imagePhase, setImagePhase] = useState<"idle" | "enter">("idle");
  const prevIndexRef = useRef(activeIndex);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const exitTimerRef = useRef<number | null>(null);

  const show = open || exitHold;
  const slide = slides[activeIndex];

  const requestClose = useCallback(() => {
    setVisible(false);
    setExitHold(true);
    onClose();
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = window.setTimeout(() => {
      setExitHold(false);
      exitTimerRef.current = null;
    }, 340);
  }, [onClose]);

  const goPrev = useCallback(() => {
    onSelectIndex((activeIndex - 1 + slides.length) % slides.length);
  }, [activeIndex, onSelectIndex, slides.length]);

  const goNext = useCallback(() => {
    onSelectIndex((activeIndex + 1) % slides.length);
  }, [activeIndex, onSelectIndex, slides.length]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [goNext, goPrev, requestClose, show],
  );

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      setExitHold(false);
      setVisible(true);
    });
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 120);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown, show]);

  useEffect(() => {
    if (!show || prevIndexRef.current === activeIndex) return;
    prevIndexRef.current = activeIndex;
    const enterTimer = window.setTimeout(() => setImagePhase("enter"), 0);
    const idleTimer = window.setTimeout(() => setImagePhase("idle"), 420);
    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(idleTimer);
    };
  }, [activeIndex, show]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  if (!show || !slide) return null;

  const imgW = slide.imageWidth ?? 2048;
  const imgH = slide.imageHeight ?? 2732;
  const isLandscape = imgW > imgH;

  const panelMaxW = isLandscape
    ? "max-w-[min(100%,98vw)] sm:max-w-[min(100%,60rem)]"
    : "max-w-[min(100%,96vw)] sm:max-w-[22rem] md:max-w-[24rem]";
  const panelMaxH = isLandscape
    ? "max-h-[min(98vh,860px)] sm:max-h-[min(94vh,780px)]"
    : "max-h-[min(98vh,920px)] sm:max-h-[min(96vh,860px)]";
  const imageMaxHClass = isLandscape
    ? "max-h-[min(68vh,620px)] sm:max-h-[min(56vh,520px)]"
    : "max-h-[min(86vh,840px)] sm:max-h-[min(76vh,720px)]";

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-1 sm:p-6" role="presentation">
      <button
        type="button"
        className={`absolute inset-0 bg-[#020617]/88 backdrop-blur-2xl backdrop-saturate-150 transition-opacity duration-300 max-sm:bg-[#020617]/90 ${
          visible ? "trust-lightbox-backdrop-in opacity-100" : "opacity-0"
        }`}
        aria-label="Kapat"
        onClick={requestClose}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
        <div
          className={`absolute h-[min(86vh,680px)] w-[min(98vw,960px)] rounded-full bg-cyan-400/[0.16] blur-[96px] transition-opacity duration-500 max-sm:bg-cyan-400/[0.19] sm:h-[min(68vh,620px)] sm:w-[min(88vw,980px)] sm:bg-cyan-400/[0.11] sm:blur-[110px] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute h-[min(64vh,520px)] w-[min(84vw,720px)] rounded-full bg-blue-600/[0.18] blur-[80px] transition-opacity duration-500 max-sm:bg-blue-600/[0.22] sm:bg-blue-600/[0.14] sm:blur-[90px] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <button
        type="button"
        onClick={goPrev}
        className="absolute left-2 top-1/2 z-[2] hidden -translate-y-1/2 rounded-full border border-white/[0.14] bg-slate-950/85 p-2.5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-cyan-400/40 hover:bg-slate-900/92 sm:left-4 sm:flex"
        aria-label="Önceki ekran"
      >
        <LightboxChevron direction="left" />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="absolute right-2 top-1/2 z-[2] hidden -translate-y-1/2 rounded-full border border-white/[0.14] bg-slate-950/85 p-2.5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-cyan-400/40 hover:bg-slate-900/92 sm:right-4 sm:flex"
        aria-label="Sonraki ekran"
      >
        <LightboxChevron direction="right" />
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-lightbox-title"
        className={`relative z-[1] flex w-full flex-col overflow-hidden rounded-xl border border-white/[0.15] bg-slate-950/[0.98] shadow-[0_0_0_1px_rgba(34,211,238,0.16),0_0_88px_-16px_rgba(34,211,238,0.38),0_40px_120px_-28px_rgba(0,114,255,0.62)] ring-1 ring-cyan-400/26 backdrop-blur-2xl transition-opacity duration-300 max-sm:rounded-2xl sm:shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_0_72px_-18px_rgba(34,211,238,0.32),0_40px_120px_-28px_rgba(0,114,255,0.58)] sm:ring-cyan-400/22 ${panelMaxW} ${panelMaxH} ${
          visible ? "trust-lightbox-panel-in opacity-100" : "scale-[0.97] opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="pointer-events-none absolute -inset-px rounded-2xl bg-[radial-gradient(ellipse_85%_55%_at_50%_0%,rgba(34,211,238,0.09),transparent_62%)]"
          aria-hidden
        />

        <div className="relative flex shrink-0 items-start justify-between gap-2.5 border-b border-white/[0.09] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <div className="min-w-0 flex-1 pr-1">
            <p id="screenshot-lightbox-title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/92 sm:tracking-[0.22em]">
              {titlePrefix} · {activeIndex + 1}/{slides.length}
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-white sm:text-sm sm:font-medium">{slide.caption}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={requestClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.07] text-xl leading-none text-slate-100 transition hover:border-white/[0.22] hover:bg-white/[0.11] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/70 sm:h-9 sm:w-9 sm:rounded-lg sm:text-lg"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div
          className={`relative min-h-0 w-full flex-1 overflow-hidden bg-gradient-to-b from-[#070d18] via-[#08111f] to-[#050a14] ${imageMaxHClass}`}
          style={{ aspectRatio: `${imgW} / ${imgH}` }}
        >
          <span
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_55%,rgba(0,114,255,0.2),transparent_68%)] max-sm:bg-[radial-gradient(ellipse_80%_70%_at_50%_55%,rgba(0,114,255,0.24),transparent_65%)]"
            aria-hidden
          />
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            width={imgW}
            height={imgH}
            className={`relative z-[1] h-full w-full object-contain object-center ${imagePhase === "enter" ? "trust-vitrin-in" : ""}`}
            sizes={isLandscape ? "(max-width: 768px) 98vw, 960px" : "(max-width: 768px) 96vw, 384px"}
            unoptimized
            priority
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/[0.08] bg-slate-950/85 px-3 py-2.5 sm:px-4 sm:py-3">
          {slides.map((s, index) => (
            <button
              key={s.src}
              type="button"
              onClick={() => onSelectIndex(index)}
              className={`rounded-full transition-all duration-300 ease-out ${
                index === activeIndex ? "h-2.5 w-6 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]" : "h-2.5 w-2.5 bg-white/28 hover:bg-white/45"
              }`}
              aria-label={`Ekran ${index + 1}${index === activeIndex ? " (aktif)" : ""}`}
              aria-current={index === activeIndex ? true : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
