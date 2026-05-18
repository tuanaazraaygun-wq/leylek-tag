"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppScreenshotSlide } from "@/lib/app-screenshot-slides";
import { StoreScreenshotPhone } from "@/components/store-screenshot-phone";

const DEFAULT_AUTO_MS = 7000;
const USER_PAUSE_AFTER_SCROLL_MS = 12000;

type PremiumScreenshotCarouselProps = {
  slides: readonly AppScreenshotSlide[];
  className?: string;
  autoplayMs?: number;
};

export function PremiumScreenshotCarousel({
  slides,
  className = "",
  autoplayMs = DEFAULT_AUTO_MS,
}: PremiumScreenshotCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);
  const scrollIdleRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const userPauseUntilRef = useRef(0);

  const scrollSlideByIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-carousel-slide="${index}"]`);
    if (!root || !el) return;

    programmaticRef.current = true;
    const targetLeft = el.offsetLeft - root.clientWidth / 2 + el.clientWidth / 2;
    root.scrollTo({ left: Math.max(0, targetLeft), behavior });
    window.setTimeout(() => {
      programmaticRef.current = false;
    }, 560);
  }, []);

  const scheduleResolveNearestSlide = useCallback(() => {
    if (scrollIdleRef.current !== null) clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = window.setTimeout(() => {
      scrollIdleRef.current = null;
      if (programmaticRef.current) return;

      const root = scrollRef.current;
      if (!root) return;
      const els = [...root.querySelectorAll<HTMLElement>("[data-carousel-slide]")];
      const center = root.scrollLeft + root.clientWidth / 2;
      let nearest = 0;
      let bestDist = Infinity;
      for (const chip of els) {
        const i = Number(chip.dataset.carouselSlide);
        if (!Number.isFinite(i)) continue;
        const cx = chip.offsetLeft + chip.clientWidth / 2;
        const d = Math.abs(cx - center);
        if (d < bestDist) {
          bestDist = d;
          nearest = i;
        }
      }
      setActiveIndex((prev) => (prev === nearest ? prev : nearest));
      userPauseUntilRef.current = Date.now() + USER_PAUSE_AFTER_SCROLL_MS;
    }, 80);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollIdleRef.current !== null) clearTimeout(scrollIdleRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoplayMs <= 0 || slides.length < 2) return;
    const id = window.setInterval(() => {
      if (Date.now() < userPauseUntilRef.current) return;
      setActiveIndex((i) => {
        const next = (i + 1) % slides.length;
        queueMicrotask(() => scrollSlideByIndex(next, "smooth"));
        return next;
      });
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, scrollSlideByIndex, slides.length]);

  const goto = (direction: number) => {
    userPauseUntilRef.current = Date.now() + USER_PAUSE_AFTER_SCROLL_MS;
    setActiveIndex((i) => {
      const next = (i + direction + slides.length) % slides.length;
      queueMicrotask(() => scrollSlideByIndex(next, "smooth"));
      return next;
    });
  };

  if (slides.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute left-1 top-[42%] z-30 hidden md:block">
        <button
          type="button"
          onClick={() => goto(-1)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.12] bg-black/65 text-xl text-white backdrop-blur-md transition hover:border-cyan-300/55 hover:bg-black/85"
          aria-label="Önceki ekran"
        >
          ‹
        </button>
      </div>
      <div className="pointer-events-none absolute right-1 top-[42%] z-30 hidden md:block">
        <button
          type="button"
          onClick={() => goto(1)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.12] bg-black/65 text-xl text-white backdrop-blur-md transition hover:border-cyan-300/55 hover:bg-black/85"
          aria-label="Sonraki ekran"
        >
          ›
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={scheduleResolveNearestSlide}
        role="region"
        aria-roledescription="carousel"
        aria-label="Uygulama ekran görüntüleri"
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-10 overflow-x-auto scroll-smooth px-10 pb-10 pt-2 sm:gap-12 sm:px-16 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.35)_transparent]"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.src}
            data-carousel-slide={index}
            className="shrink-0 snap-center px-4 sm:w-[280px]"
          >
            <div className="mx-auto flex w-[240px] max-w-[88vw] flex-col items-center sm:w-[270px]">
              <StoreScreenshotPhone
                src={slide.src}
                alt={slide.alt}
                widthClass="max-w-none w-full"
                fit="contain"
                className="shadow-[0_24px_80px_rgba(0,114,255,0.14)]"
              />
              <p className="mt-4 max-w-[15rem] text-center text-[11px] font-semibold leading-relaxed tracking-wide text-slate-400 sm:text-xs">
                {slide.caption}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {slides.map((s, index) => (
          <button
            key={s.src}
            type="button"
            onClick={() => {
              userPauseUntilRef.current = Date.now() + USER_PAUSE_AFTER_SCROLL_MS;
              setActiveIndex(index);
              scrollSlideByIndex(index, "smooth");
            }}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === activeIndex ? "w-7 bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.45)]" : "w-2 bg-white/25 hover:bg-white/40"
            }`}
            aria-label={`Slayt ${index + 1}${index === activeIndex ? " (aktif)" : ""}`}
            aria-current={index === activeIndex ? true : undefined}
          />
        ))}
      </div>
    </div>
  );
}
