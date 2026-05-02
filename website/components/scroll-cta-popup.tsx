"use client";

import { useEffect, useState } from "react";
import { useSiteAction } from "@/components/site-action-context";

const SESSION_KEY = "leylek_scroll_cta_done";

export function ScrollCtaPopup() {
  const [open, setOpen] = useState(false);
  const { triggerProgress } = useSiteAction();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      return;
    }

    const check = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      if (window.scrollY / maxScroll >= 0.5) {
        setOpen(true);
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
        window.removeEventListener("scroll", check);
      }
    };

    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-12 backdrop-blur-[2px] sm:items-center sm:pb-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scroll-cta-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c1829]/95 p-5 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Kapat"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
        <p id="scroll-cta-title" className="pr-8 text-base font-bold leading-snug text-white">
          Yolunu şimdi bulmak ister misin?
        </p>
        <button
          type="button"
          onClick={() => {
            triggerProgress();
            setOpen(false);
          }}
          className="ripple-bg tap-highlight mt-5 w-full rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.96]"
        >
          Hemen başla
        </button>
      </div>
    </div>
  );
}
