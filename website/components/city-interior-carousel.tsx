"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppScreenshotSlide } from "@/lib/app-screenshot-slides";
import { StoreScreenshotPhone } from "@/components/store-screenshot-phone";

const STEP = 164;
const MOUSE_PARALLAX_CAP = 22;
const LERP_SMOOTH = 0.11;
const SWIPE_RESOLVE = 48;
const DEFAULT_AUTO_MS = 14_250;

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

function centerTranslate(activeIndex: number, viewportWidth: number): number {
  return viewportWidth / 2 - (activeIndex * STEP + STEP / 2);
}

type CityInteriorCarouselProps = {
  slides: readonly AppScreenshotSlide[];
  className?: string;
  autoplayMs?: number;
};

export function CityInteriorCarousel({
  slides,
  className = "",
  autoplayMs = DEFAULT_AUTO_MS,
}: CityInteriorCarouselProps) {
  const reduceMotion = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIdxRef = useRef(activeIndex);

  const [hoverPaused, setHoverPaused] = useState(false);
  const [dragPaused, setDragPaused] = useState(false);
  const hoverRef = useRef(false);

  const parallaxSmoothRef = useRef(0);
  const parallaxTargetRef = useRef(0);
  const smoothTxRef = useRef(0);

  const draggingRef = useRef(false);
  const dragDxRef = useRef(0);
  const dragStartRef = useRef(0);

  const clampIndex = useCallback((i: number) => Math.max(0, Math.min(slides.length - 1, i)), [slides.length]);

  const applyTrack = useCallback(() => {
    const t = trackRef.current;
    if (t) t.style.transform = `translate3d(${smoothTxRef.current}px, 0, 0)`;
  }, []);

  const scheduleFrame = useCallback(() => {
    const step = () => {
      const view = viewportRef.current;
      if (!view || slides.length < 2) {
        rafId.current = null;
        return;
      }

      const vw = view.offsetWidth;
      parallaxSmoothRef.current += (parallaxTargetRef.current - parallaxSmoothRef.current) * LERP_SMOOTH;

      const anchor =
        centerTranslate(activeIdxRef.current, vw) + dragDxRef.current + parallaxSmoothRef.current;

      smoothTxRef.current += (anchor - smoothTxRef.current) * LERP_SMOOTH;
      applyTrack();

      const delta = Math.abs(anchor - smoothTxRef.current);
      const parallaxResidual = Math.abs(parallaxTargetRef.current - parallaxSmoothRef.current);
      const extend = delta > 0.62 || parallaxResidual > 0.22 || draggingRef.current;

      if (extend) {
        rafId.current = requestAnimationFrame(step);
      } else {
        rafId.current = null;
      }
    };

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(step);
  }, [applyTrack, slides.length]);

  const settleDrag = useCallback(() => {
    draggingRef.current = false;
    setDragPaused(false);
    const dx = dragDxRef.current;
    dragDxRef.current = 0;
    setActiveIndex((idx) => {
      if (dx > SWIPE_RESOLVE) return clampIndex(idx - 1);
      if (dx < -SWIPE_RESOLVE) return clampIndex(idx + 1);
      return idx;
    });
    scheduleFrame();
  }, [clampIndex, scheduleFrame]);

  useEffect(() => {
    activeIdxRef.current = activeIndex;
    scheduleFrame();
  }, [activeIndex, scheduleFrame]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  useEffect(() => {
    const view = viewportRef.current;
    if (!view || slides.length < 2) return;
    smoothTxRef.current = centerTranslate(activeIdxRef.current, view.offsetWidth);
    applyTrack();
    const ro = new ResizeObserver(() => scheduleFrame());
    ro.observe(view);
    queueMicrotask(() => scheduleFrame());
    return () => ro.disconnect();
  }, [slides.length, applyTrack, scheduleFrame]);

  useEffect(() => {
    if (slides.length < 2 || reduceMotion || autoplayMs <= 0) return;
    const tid = window.setInterval(() => {
      if (hoverRef.current || draggingRef.current) return;
      setActiveIndex((idx) => (idx + 1) % slides.length);
    }, autoplayMs);
    return () => clearInterval(tid);
  }, [slides.length, autoplayMs, reduceMotion]);

  const onMouseMoveAmbient = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingRef.current || reduceMotion) return;
      const root = viewportRef.current;
      if (!root || !hoverRef.current) return;
      const r = root.getBoundingClientRect();
      const n = Math.max(-1, Math.min(1, ((e.clientX - r.left) / Math.max(r.width, 1) - 0.5) * 2));
      parallaxTargetRef.current = n * MOUSE_PARALLAX_CAP * 1.06;
      scheduleFrame();
    },
    [reduceMotion, scheduleFrame],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragPaused(true);
    dragStartRef.current = e.clientX;
    dragDxRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      dragDxRef.current = e.clientX - dragStartRef.current;
      scheduleFrame();
    },
    [scheduleFrame],
  );

  const onPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      settleDrag();
    },
    [settleDrag],
  );

  if (slides.length === 0) return null;

  if (slides.length === 1) {
    const s = slides[0];
    return (
      <div className={`relative ${className}`}>
        <div className="mx-auto flex max-w-[198px] flex-col items-center sm:max-w-[210px]">
          <StoreScreenshotPhone src={s.src} alt={s.alt} widthClass="w-full max-w-none" fit="contain" ambient="quiet" />
          {s.caption ? (
            <p className="mt-4 max-w-xs text-center text-[11px] font-medium leading-relaxed text-slate-400 sm:text-[12px]">
              {s.caption}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const progressPaused = hoverPaused || dragPaused || reduceMotion || autoplayMs <= 0;
  const activeCaption = slides[activeIndex]?.caption;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={viewportRef}
        className="relative min-h-[228px] w-full overflow-hidden pt-5 sm:min-h-[240px]"
        role="region"
        aria-roledescription="carousel"
        aria-label="Şehir içi mobil ekran seçkisi"
        tabIndex={0}
        onMouseEnter={() => {
          hoverRef.current = true;
          setHoverPaused(true);
        }}
        onMouseLeave={() => {
          hoverRef.current = false;
          setHoverPaused(false);
          parallaxTargetRef.current = 0;
          scheduleFrame();
        }}
        onMouseMove={onMouseMoveAmbient}
      >
        <div
          ref={trackRef}
          role="presentation"
          className="flex cursor-grab select-none items-end whitespace-nowrap pb-5 will-change-transform active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
            {slides.map((slide, index) => {
              const tier = Math.abs(index - activeIndex);
              const isFeatured = tier === 0;
              const isSide = tier > 0;

              const frameCls = reduceMotion
                ? `${isFeatured ? "scale-[0.97]" : "scale-[0.93] opacity-[0.82]"} `
                : isSide
                  ? "scale-[0.86] opacity-[0.4] saturate-[0.92] blur-[5px]"
                  : "scale-[1] opacity-[1] blur-0 saturate-100 md:brightness-[1.02]";

              return (
                <div key={`${slide.src}-${index}`} className="flex shrink-0 justify-center" style={{ width: STEP }}>
                  <div
                    className={`flex w-[min(158px,calc((100vw-2.5rem)*0.41))] max-w-[160px] flex-col items-center sm:w-[167px]`}
                    style={{ transformOrigin: "50% 92%" }}
                    aria-hidden={isSide ? true : undefined}
                  >
                    <div
                      style={{ transition: reduceMotion ? "none" : "transform 470ms cubic-bezier(.25,.9,.42,1), opacity .4s ease, filter .42s ease" }}
                      className={`w-full ${frameCls}`}
                    >
                      <StoreScreenshotPhone
                        src={slide.src}
                        alt={isFeatured ? slide.alt : ""}
                        widthClass="w-full max-w-none"
                        fit="contain"
                        ambient="quiet"
                      />
                    </div>
                    {/* Yer tutucu: dikey sıçrama olmadan kart yüksekliği */}
                    {!isFeatured ? <div className="mt-6 h-[0.6875rem]" aria-hidden /> : <div className="mt-2 h-[0.6875rem]" aria-hidden />}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <p className="mx-auto mt-4 min-h-[2.8125rem] max-w-lg px-4 text-center text-[11px] font-normal leading-[1.74] tracking-[0.02em] text-slate-400 sm:mt-5 sm:text-[12px]" aria-live="polite">
        {activeCaption}
      </p>

      <div className="mt-5 space-y-3 px-3 sm:mt-7 sm:space-y-3.5 sm:px-5">
        <div className="h-px overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
          <div
            key={activeIndex}
            className={`city-interior-carousel-progress-el pointer-events-none h-full rounded-full bg-gradient-to-r from-cyan-500/42 via-cyan-400/35 to-cyan-300/[0.22] ${
              progressPaused ? "city-interior-carousel-progress-el--paused" : ""
            }`}
            style={{ animationDuration: reduceMotion ? "0.01ms" : `${autoplayMs}ms` }}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => {
                setActiveIndex(i);
              }}
              aria-label={`${s.caption ?? `Ekran ${i + 1}`}${i === activeIndex ? ", aktif" : ""}`}
              aria-current={i === activeIndex}
              className={`h-[5px] rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                i === activeIndex ? "w-7 bg-cyan-400/88" : "w-[5px] bg-white/24 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
