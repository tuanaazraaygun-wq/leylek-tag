"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LiveRouteToasts } from "@/components/live-route-toasts";
import { ScrollCtaPopup } from "@/components/scroll-cta-popup";

type SiteActionContextValue = {
  triggerProgress: () => void;
};

const SiteActionContext = createContext<SiteActionContextValue | null>(null);

export function useSiteAction() {
  const ctx = useContext(SiteActionContext);
  if (!ctx) {
    return { triggerProgress: () => {} };
  }
  return ctx;
}

export function SiteActionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);

  const triggerProgress = useCallback(() => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 2200);
  }, []);

  const value = useMemo(() => ({ triggerProgress }), [triggerProgress]);

  return (
      <SiteActionContext.Provider value={value}>
      {children}
      <LiveRouteToasts />
      <ScrollCtaPopup />
      <ActionLoadingOverlay open={loading} />
      <MobileStickyCta onPress={triggerProgress} />
    </SiteActionContext.Provider>
  );
}

function ActionLoadingOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/55 px-6 backdrop-blur-sm"
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="shimmer-bar absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
        <p className="relative text-center text-sm font-semibold text-white">Eşleşmeler hazırlanıyor...</p>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="loading-shimmer h-full w-full rounded-full bg-gradient-to-r from-cyan-500/0 via-cyan-300/90 to-cyan-500/0" />
        </div>
      </div>
    </div>
  );
}

function MobileStickyCta({ onPress }: { onPress: () => void }) {
  return (
    <div className="safe-bottom fixed bottom-0 left-0 right-0 z-30 md:hidden">
      <div className="border-t border-white/10 bg-black/40 px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => onPress()}
          className="ripple-bg tap-highlight relative w-full overflow-hidden rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.96]"
        >
          Yol ara
        </button>
      </div>
    </div>
  );
}
