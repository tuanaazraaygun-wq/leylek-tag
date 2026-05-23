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

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <button
        type="button"
        className={`absolute inset-0 bg-black/75 backdrop-blur-lg transition-opacity duration-300 ${
          visible ? "trust-lightbox-backdrop-in opacity-100" : "opacity-0"
        }`}
        aria-label="Kapat"
        onClick={requestClose}
      />

      <button
        type="button"
        onClick={goPrev}
        className="absolute left-2 top-1/2 z-[2] hidden -translate-y-1/2 rounded-full border border-white/[0.12] bg-slate-950/80 p-2.5 text-white shadow-lg backdrop-blur-md transition hover:border-cyan-400/35 hover:bg-slate-900/90 sm:left-4 sm:flex"
        aria-label="Önceki ekran"
      >
        <LightboxChevron direction="left" />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="absolute right-2 top-1/2 z-[2] hidden -translate-y-1/2 rounded-full border border-white/[0.12] bg-slate-950/80 p-2.5 text-white shadow-lg backdrop-blur-md transition hover:border-cyan-400/35 hover:bg-slate-900/90 sm:right-4 sm:flex"
        aria-label="Sonraki ekran"
      >
        <LightboxChevron direction="right" />
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-lightbox-title"
        className={`relative z-[1] flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-slate-950/96 shadow-[0_40px_100px_-28px_rgba(0,114,255,0.5)] ring-1 ring-cyan-400/18 backdrop-blur-xl transition-opacity duration-300 ${
          isLandscape ? "max-w-[min(100%,56rem)]" : "max-w-lg"
        } ${visible ? "trust-lightbox-panel-in opacity-100" : "scale-[0.97] opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] bg-gradient-to-r from-white/[0.03] to-transparent px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p id="screenshot-lightbox-title" className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/85">
              App Store vitrin · {activeIndex + 1}/{slides.length}
            </p>
            <p className="mt-1 text-sm font-medium leading-snug text-white">{slide.caption}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={requestClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-lg text-slate-200 transition hover:border-white/[0.2] hover:bg-white/[0.1] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/70"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div
          className="relative min-h-0 w-full flex-1 overflow-hidden bg-gradient-to-b from-[#070d18] to-[#050a14]"
          style={{ aspectRatio: `${imgW} / ${imgH}`, maxHeight: isLandscape ? "min(58vh,480px)" : "min(68vh,640px)" }}
        >
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            width={imgW}
            height={imgH}
            className={`h-full w-full object-contain object-center ${imagePhase === "enter" ? "trust-vitrin-in" : ""}`}
            sizes={isLandscape ? "(max-width: 768px) 94vw, 896px" : "(max-width: 768px) 92vw, 480px"}
            unoptimized
            priority
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/[0.08] bg-slate-950/80 px-4 py-3">
          {slides.map((s, index) => (
            <button
              key={s.src}
              type="button"
              onClick={() => onSelectIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ease-out ${
                index === activeIndex ? "w-6 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]" : "w-2 bg-white/25 hover:bg-white/45"
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
