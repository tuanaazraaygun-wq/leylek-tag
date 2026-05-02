"use client";

import { useEffect, useState } from "react";

export function LiveRouteToasts() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loopId: number | undefined;
    let hideId: number | undefined;

    const runCycle = () => {
      const delay = 10_000 + Math.random() * 10_000;
      loopId = window.setTimeout(() => {
        if (cancelled) return;
        setVisible(true);
        hideId = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          runCycle();
        }, 3000) as unknown as number;
      }, delay) as unknown as number;
    };

    runCycle();

    return () => {
      cancelled = true;
      if (loopId !== undefined) window.clearTimeout(loopId);
      if (hideId !== undefined) window.clearTimeout(hideId);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed left-3 right-auto top-[4.25rem] z-[95] max-w-[min(72vw,11rem)] transform transition-all duration-300 ease-out md:left-auto md:right-6 md:top-24 md:max-w-[min(90vw,20rem)] ${
        visible ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 md:translate-x-6"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-lg border border-white/15 bg-black/70 px-2.5 py-2 text-[11px] font-semibold leading-snug text-white shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-xl md:rounded-xl md:px-4 md:py-3 md:text-sm">
        🚗 Yeni rota eklendi!
      </div>
    </div>
  );
}
