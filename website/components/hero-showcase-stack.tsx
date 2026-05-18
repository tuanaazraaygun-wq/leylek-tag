"use client";

import { useCallback, useEffect, useRef } from "react";
import { HeroAppScreensRotator } from "@/components/hero-app-screens-rotator";
import { HeroShowcaseHighlightRail } from "@/components/hero-showcase-highlight-rail";

/** Telefon vitrin + özellik çipleri — hizalı layout, layered ambient glow; kolon mouse ile hafif glow kayması. */
export function HeroShowcaseStack() {
  const columnRef = useRef<HTMLDivElement>(null);
  const glowShiftRef = useRef<HTMLDivElement>(null);
  const reduceMotionRef = useRef(false);

  const moveGlowDrift = useCallback((clientX: number, clientY: number) => {
    if (reduceMotionRef.current) return;
    const col = columnRef.current;
    const glowShift = glowShiftRef.current;
    if (!col || !glowShift) return;

    const r = col.getBoundingClientRect();
    const nx = (clientX - r.left) / Math.max(r.width, 1) - 0.5;
    const ny = (clientY - r.top) / Math.max(r.height, 1) - 0.5;

    glowShift.style.transform = `translate3d(${nx * -11}px, ${ny * -8}px, 0)`;
  }, []);

  const resetGlowDrift = useCallback(() => {
    const glowShift = glowShiftRef.current;
    if (glowShift) glowShift.style.transform = "translate3d(0,0,0)";
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceMotionRef.current = mq.matches;
      if (mq.matches) resetGlowDrift();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [resetGlowDrift]);

  return (
    <div
      ref={columnRef}
      className="relative mx-auto w-full max-w-[min(428px,calc(100vw-2rem))] overflow-x-clip lg:mx-0 lg:max-w-none lg:translate-x-1 xl:translate-x-2"
      onMouseMove={(e) => moveGlowDrift(e.clientX, e.clientY)}
      onMouseLeave={resetGlowDrift}
    >
      <div className="flex flex-col items-center gap-7 pb-1 sm:gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-5 xl:gap-7">
        <div className="relative flex w-full max-w-[min(380px,calc(100vw-3rem))] shrink-0 justify-center sm:max-w-[394px] lg:max-w-none lg:flex-1 lg:justify-end lg:-translate-y-5 xl:-translate-y-6">
          <div ref={glowShiftRef} className="pointer-events-none absolute inset-0 z-0 will-change-transform motion-reduce:!transform-none" aria-hidden>
            <span className="absolute left-1/2 top-[40%] z-0 aspect-square w-[min(120%,442px)] max-w-[478px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_48%_50%,rgba(34,211,238,0.09),transparent_68%)] blur-[104px]" />
            <span className="absolute left-[49%] top-[40%] z-0 aspect-[1.08] w-[min(114%,398px)] max-w-[436px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_42%_50%,rgba(0,114,255,0.07),transparent_70%)] blur-[92px]" />
            <span className="absolute left-[51%] top-[40%] z-0 aspect-square w-[min(100%,358px)] max-w-[396px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(139,92,246,0.04),transparent_72%)] blur-[112px]" />
          </div>

          <div className="relative z-[3] mx-auto w-full max-w-[min(386px,calc(100vw-3rem))] sm:max-w-[min(402px,calc(100vw-2.75rem))] lg:mx-0 lg:max-w-[min(402px,100%)] xl:max-w-[min(426px,100%)]">
            <HeroAppScreensRotator pointerBoundaryRef={columnRef} widthClass="w-full" />
          </div>
        </div>

        <HeroShowcaseHighlightRail className="w-full shrink-0 sm:max-w-[17.875rem] lg:w-[13rem] lg:max-w-[13rem] lg:justify-self-start lg:pt-[2.25rem]" />
      </div>
    </div>
  );
}
