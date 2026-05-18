"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Giriş gecikmesi (ms); prefers-reduced-motion’da sıfır. */
  staggerDelayMs?: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ScrollReveal({ children, className = "", staggerDelayMs = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      queueMicrotask(() => setVisible(true));
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const reduce = prefersReducedMotion();
  const delay = visible && staggerDelayMs > 0 && !reduce ? Math.min(staggerDelayMs, 520) : 0;
  const style: CSSProperties = reduce
    ? {}
    : {
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.28, 0.92, 0.32, 1)",
        transitionDuration: "780ms",
      };

  return (
    <div
      ref={ref}
      style={reduce ? undefined : style}
      className={`transform-gpu will-change-[opacity,transform] transition-[opacity,transform] motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
        !reduce ? (visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0") : "translate-y-0 opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}
