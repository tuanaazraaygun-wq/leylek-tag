"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

type HeroShellProps = {
  children: ReactNode;
  className?: string;
};

/** Hero bölümünde mouse’a göre hafif ışık kayması + grid parallax + sağ ambient drift (tek RAF). */
export function HeroShell({ children, className = "" }: HeroShellProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const routeGlowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reduceMotionRef = useRef(false);

  const smoothRef = useRef({ x: 50, y: 42 });
  const targetRef = useRef({ x: 50, y: 42 });

  const applyRunnerRef = useRef<(() => void) | null>(null);

  const scheduleApply = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => applyRunnerRef.current?.());
    }
  }, []);

  useLayoutEffect(() => {
    applyRunnerRef.current = () => {
      rafRef.current = null;
      const light = lightRef.current;
      const grid = gridRef.current;
      const route = routeGlowRef.current;
      const s = smoothRef.current;
      const t = targetRef.current;
      s.x += (t.x - s.x) * 0.06;
      s.y += (t.y - s.y) * 0.06;
      if (light) {
        light.style.background = `radial-gradient(ellipse 76% 60% at ${s.x}% ${s.y}%, rgba(0,214,255,0.11), transparent 60%)`;
      }
      if (grid) {
        if (!reduceMotionRef.current) {
          const dx = (s.x - 50) * 0.174;
          const dy = (s.y - 50) * 0.128;
          grid.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        } else {
          grid.style.transform = "translate3d(0,0,0)";
        }
      }

      if (route) {
        if (!reduceMotionRef.current) {
          route.style.transform = `translate3d(${(s.x - 50) * -0.32}px, ${(s.y - 50) * -0.22}px, 0)`;
        } else {
          route.style.transform = "translate3d(0,0,0)";
        }
      }

      const err = Math.abs(t.x - s.x) + Math.abs(t.y - s.y);
      if (err > 0.055) {
        scheduleApply();
      }
    };
  }, [scheduleApply]);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reduceMotionRef.current) return;
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.max(r.width, 1);
      const h = Math.max(r.height, 1);
      targetRef.current = { x: ((e.clientX - r.left) / w) * 100, y: ((e.clientY - r.top) / h) * 100 };
      scheduleApply();
    },
    [scheduleApply],
  );

  const onLeave = useCallback(() => {
    targetRef.current = { x: 50, y: 42 };
    scheduleApply();
  }, [scheduleApply]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceMotionRef.current = mq.matches;
      const route = routeGlowRef.current;
      if (route && mq.matches) route.style.transform = "translate3d(0,0,0)";
      const grid = gridRef.current;
      if (grid && mq.matches) grid.style.transform = "translate3d(0,0,0)";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative isolate overflow-x-clip motion-reduce:overflow-x-hidden ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div ref={lightRef} className="absolute inset-0 opacity-[0.92] motion-reduce:opacity-[0.84]" />
        <div
          ref={routeGlowRef}
          className="absolute -right-[6%] top-[min(13%,152px)] h-[clamp(340px,58vh,600px)] w-[min(88vw,720px)] max-w-none rounded-[50%] bg-[radial-gradient(ellipse_58%_56%_at_44%_48%,rgba(34,211,238,0.06)_0%,rgba(37,99,235,0.042)_42%,transparent_68%)] blur-[118px] will-change-transform motion-reduce:!transform-none"
        />
        <div
          ref={gridRef}
          className="subtle-grid absolute inset-x-[-10%] top-[-8%] h-[clamp(380px,74vh,620px)] max-w-none opacity-[0.132] will-change-transform motion-reduce:!transform-none md:opacity-[0.158]"
        />
      </div>
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}
