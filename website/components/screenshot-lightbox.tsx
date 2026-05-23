"use client";

import Image from "next/image";
import { useCallback, useEffect } from "react";
import type { AppScreenshotSlide } from "@/lib/app-screenshot-slides";

type ScreenshotLightboxProps = {
  open: boolean;
  slides: readonly AppScreenshotSlide[];
  activeIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
};

export function ScreenshotLightbox({
  open,
  slides,
  activeIndex,
  onClose,
  onSelectIndex,
}: ScreenshotLightboxProps) {
  const slide = slides[activeIndex];

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSelectIndex((activeIndex - 1 + slides.length) % slides.length);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onSelectIndex((activeIndex + 1) % slides.length);
      }
    },
    [activeIndex, onClose, onSelectIndex, open, slides.length],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  if (!open || !slide) return null;

  const imgW = slide.imageWidth ?? 2048;
  const imgH = slide.imageHeight ?? 2732;
  const isLandscape = imgW > imgH;

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-lightbox-title"
        className={`relative z-[1] flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-slate-950/95 shadow-[0_32px_90px_-24px_rgba(0,114,255,0.45)] ring-1 ring-cyan-400/15 ${
          isLandscape ? "max-w-4xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p id="screenshot-lightbox-title" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              App Store vitrin · {activeIndex + 1}/{slides.length}
            </p>
            <p className="mt-1 text-sm font-medium leading-snug text-white">{slide.caption}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-lg text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div
          className="relative w-full bg-gradient-to-b from-[#070d18] to-[#050a14]"
          style={{ aspectRatio: `${imgW} / ${imgH}`, maxHeight: isLandscape ? "min(72vh, 520px)" : "min(68vh, 640px)" }}
        >
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            width={imgW}
            height={imgH}
            className="h-full w-full object-contain object-center"
            sizes={isLandscape ? "(max-width: 768px) 92vw, 896px" : "(max-width: 768px) 92vw, 480px"}
            unoptimized
            priority
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.08] px-4 py-3">
          {slides.map((s, index) => (
            <button
              key={s.src}
              type="button"
              onClick={() => onSelectIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
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
