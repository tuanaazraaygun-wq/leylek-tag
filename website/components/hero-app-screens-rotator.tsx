"use client";

import Image from "next/image";
import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STORE_ALL_APP_SCREENSHOTS } from "@/lib/branding-assets";

const ROTATE_MS = 16_500;

const ROT_LERP = 0.092;
const MAX_ROT_Y = 5.25;
const MAX_ROT_X = 2.85;
const MAX_SHIFT_X = 5;
/** Büyük kolon için tilt biraz daha yumuşak (sinematik, agresif değil). */
const COLUMN_TILT = 0.52;

type HeroAppScreensRotatorProps = {
  widthClass?: string;
  className?: string;
  pointerBoundaryRef?: RefObject<HTMLElement | null>;
};

/** Hero için telefon vitrininde sırayla ekranlar; kolon boundary veya doğrudan telefon üzerinde hafif parallax (tek RAF zinciri). */
export function HeroAppScreensRotator({
  widthClass = "max-w-[300px]",
  className = "",
  pointerBoundaryRef,
}: HeroAppScreensRotatorProps) {
  const [active, setActive] = useState(0);
  const reduceMotionRef = useRef(false);
  const phoneHoverRef = useRef(false);
  /** Kolon içinde aktif pointer (mousemove sonrası). */
  const columnPointerRef = useRef(false);
  const hoverPausedCarouselRef = useRef(false);

  const boundaryMode = pointerBoundaryRef != null;

  const rotYRef = useRef(0);
  const rotXRef = useRef(0);
  const tgtYRef = useRef(0);
  const tgtXRef = useRef(0);

  const shiftXRef = useRef(0);
  const tgtShiftXRef = useRef(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  /** RAF döngüsü — ref üzerinden kendini tekrar planlar (lint / derleyici için sabit bağ). */
  const tickRunnerRef = useRef<(() => void) | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const scheduleTick = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(() => tickRunnerRef.current?.());
    }
  }, []);

  const resetTilt = useCallback(() => {
    tgtYRef.current = 0;
    tgtXRef.current = 0;
    tgtShiftXRef.current = 0;
    scheduleTick();
  }, [scheduleTick]);

  useLayoutEffect(() => {
    tickRunnerRef.current = () => {
      const tilt = tiltRef.current;
      if (!tilt) {
        rafRef.current = null;
        return;
      }

      rotYRef.current += (tgtYRef.current - rotYRef.current) * ROT_LERP;
      rotXRef.current += (tgtXRef.current - rotXRef.current) * ROT_LERP;
      shiftXRef.current += (tgtShiftXRef.current - shiftXRef.current) * ROT_LERP;

      tilt.style.transform = `
      perspective(1200px)
      rotateX(${rotXRef.current}deg)
      rotateY(${rotYRef.current}deg)
      translateX(${shiftXRef.current}px)
      translateZ(0)
    `;

      const delta =
        Math.abs(tgtYRef.current - rotYRef.current) +
        Math.abs(tgtXRef.current - rotXRef.current) +
        Math.abs(tgtShiftXRef.current - shiftXRef.current);

      const activeMotion = (phoneHoverRef.current || columnPointerRef.current) && !reduceMotionRef.current;
      if (delta > 0.012 || activeMotion) {
        rafRef.current = window.requestAnimationFrame(() => tickRunnerRef.current?.());
      } else {
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceMotionRef.current = mq.matches;
      if (mq.matches) {
        tgtYRef.current = 0;
        tgtXRef.current = 0;
        tgtShiftXRef.current = 0;
        rotYRef.current = 0;
        rotXRef.current = 0;
        shiftXRef.current = 0;
        const tilt = tiltRef.current;
        if (tilt) {
          tilt.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) translateX(0) translateZ(0)";
        }
        columnPointerRef.current = false;
        stopRaf();
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      stopRaf();
    };
  }, [stopRaf]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      if (hoverPausedCarouselRef.current) return;
      setActive((i) => (i + 1) % STORE_ALL_APP_SCREENSHOTS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      stopRaf();
    };
  }, [stopRaf]);

  useLayoutEffect(() => {
    const root = pointerBoundaryRef?.current ?? null;
    if (!boundaryMode || !root) return undefined;

    const onMove = (e: MouseEvent) => {
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      columnPointerRef.current = true;
      const r = root.getBoundingClientRect();
      const nx = (e.clientX - r.left) / Math.max(r.width, 1) - 0.5;
      const ny = (e.clientY - r.top) / Math.max(r.height, 1) - 0.5;

      tgtYRef.current = -nx * 2 * MAX_ROT_Y * COLUMN_TILT;
      tgtXRef.current = ny * 2 * MAX_ROT_X * COLUMN_TILT;
      tgtShiftXRef.current = nx * 2 * MAX_SHIFT_X * COLUMN_TILT;
      scheduleTick();
    };

    const onLeave = () => {
      columnPointerRef.current = false;
      if (!reduceMotionRef.current) resetTilt();
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      columnPointerRef.current = false;
    };
  }, [boundaryMode, pointerBoundaryRef, resetTilt, scheduleTick]);

  /** Telefon yüzeyi — boundary yokken tilt buradan gelir; boundary ile sadece karusel pause. */
  const onPhoneMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduceMotionRef.current || boundaryMode) return;
      const el = wrapRef.current;
      if (!el || !phoneHoverRef.current) return;

      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / Math.max(r.width, 1) - 0.5;
      const ny = (e.clientY - r.top) / Math.max(r.height, 1) - 0.5;

      tgtYRef.current = -nx * 2 * MAX_ROT_Y;
      tgtXRef.current = ny * 2 * MAX_ROT_X;
      tgtShiftXRef.current = nx * 2 * MAX_SHIFT_X;

      scheduleTick();
    },
    [boundaryMode, scheduleTick],
  );

  return (
    <div ref={wrapRef} className="relative isolate [perspective:1200px]">
      <div
        ref={tiltRef}
        role="presentation"
        className={`relative mx-auto will-change-transform ${widthClass}`}
        style={{
          transform: "perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0)",
          transformStyle: "preserve-3d",
        }}
        onMouseEnter={() => {
          phoneHoverRef.current = true;
          hoverPausedCarouselRef.current = true;
          if (!reduceMotionRef.current) scheduleTick();
        }}
        onMouseLeave={() => {
          phoneHoverRef.current = false;
          hoverPausedCarouselRef.current = false;
          if (!boundaryMode && !reduceMotionRef.current) resetTilt();
        }}
        onMouseMove={boundaryMode ? undefined : onPhoneMouseMove}
      >
        <div
          className={`rounded-[2.18rem] border border-white/[0.078] bg-gradient-to-b from-slate-900/96 to-[#070b14]/98 p-[9px] shadow-[0_22px_70px_-14px_rgba(0,0,0,0.52)] ring-1 ring-cyan-400/[0.085] transition-shadow duration-500 hover:shadow-[0_30px_78px_-16px_rgba(0,114,255,0.15)] ${className}`}
        >
          <div className="pointer-events-none absolute inset-[2px] rounded-[2.02rem] bg-[radial-gradient(ellipse_80%_44%_at_50%_0%,rgba(34,211,238,0.055),transparent_68%)]" />
          <div className="relative overflow-hidden rounded-[1.82rem] bg-[#070d14] shadow-inner ring-1 ring-white/[0.05]">
            <div className="aspect-[1080/2340] w-full bg-gradient-to-b from-[#070d18] via-[#0a1628]/90 to-[#050a14]">
              {STORE_ALL_APP_SCREENSHOTS.map((src, index) => (
                <Image
                  key={src}
                  src={src}
                  alt={`Leylek TAG uygulama ekranı ${index + 1}`}
                  width={1080}
                  height={2340}
                  className={`absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-[1100ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
                    index === active ? "z-[1] opacity-100" : "z-0 opacity-0"
                  }`}
                  sizes="(max-width: 768px) 92vw, 420px"
                  unoptimized
                  priority={index === 0}
                />
              ))}
            </div>
          </div>
          <div className="mx-auto mt-2 flex max-w-[9rem] justify-center gap-1.5" aria-hidden>
            {STORE_ALL_APP_SCREENSHOTS.map((src, i) => (
              <span
                key={`hero-shot-dot-${src}`}
                className={`h-1 rounded-full transition-all duration-300 ${i === active ? "w-5 bg-cyan-400/90" : "w-2 bg-white/22"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
