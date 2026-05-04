"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSiteAction } from "@/components/site-action-context";
import { LIVE_FLOW_ANALYZING, LIVE_FLOW_PRIMARY, LIVE_FLOW_SECONDARY } from "@/lib/site-copy";

const LS_ROUTE_KEY = "leylek_last_route_search";

const ROUTE_SUGGESTIONS = ["İstanbul → Ankara", "İzmir → İstanbul", "Bursa → Antalya"] as const;

function persistRouteLabel(label: string) {
  try {
    localStorage.setItem(LS_ROUTE_KEY, JSON.stringify({ label }));
  } catch {
    /* ignore */
  }
}

function HeroDiscoveryHint() {
  return (
    <div
      className="live-activity-bar mt-6 flex flex-col gap-2 border-y border-white/[0.06] py-3 text-center text-xs font-semibold text-white/72 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-x-4 sm:gap-y-1 sm:text-left sm:text-sm"
      aria-live="polite"
    >
      <span className="text-white/85">İlk kullanıcılar teklif akışını keşfediyor</span>
      <span className="hidden text-white/35 sm:inline" aria-hidden>
        •
      </span>
      <span>
        Web: keşif · Uygulama:{" "}
        <Link href="/indir" className="font-bold text-cyan-200/95 underline-offset-2 hover:underline">
          gerçek eşleşme
        </Link>
      </span>
    </div>
  );
}

function HeroDestinationInput() {
  const { triggerProgress } = useSiteAction();
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [remembered, setRemembered] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_ROUTE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { label?: string };
      if (p.label && typeof p.label === "string") setRemembered(p.label);
    } catch {
      /* ignore */
    }
  }, []);

  const commitSearch = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    persistRouteLabel(t);
    setRemembered(t);
  };

  const runSubmit = () => {
    const t = value.trim();
    if (!t || loading) return;
    setLoading(true);
    window.setTimeout(() => {
      commitSearch(value);
      triggerProgress();
      setLoading(false);
    }, 1150);
  };

  return (
    <div className="relative z-10 mt-6 sm:mt-8">
      <label htmlFor="hero-destination" className="mb-2 block text-left text-sm font-semibold text-white/85">
        📍 Nereye gitmek istiyorsun?
      </label>
      <div className="relative">
        <input
          id="hero-destination"
          ref={ref}
          type="text"
          name="destination"
          autoComplete="off"
          value={value}
          disabled={loading}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (!loading) commitSearch(value);
          }}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Örn. İstanbul → Ankara veya Kadıköy..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSubmit();
            }
          }}
          aria-busy={loading}
          className="tap-highlight w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3.5 text-sm text-white placeholder:text-white/40 shadow-inner transition-all duration-300 ease-out focus:border-cyan-400/55 focus:outline-none focus:shadow-[0_0_0_3px_rgba(34,211,238,0.22),0_0_28px_rgba(0,198,255,0.18)] disabled:opacity-75"
        />
        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-center rounded-2xl border border-cyan-400/30 bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="loading-shimmer h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400/0 via-cyan-300/90 to-cyan-400/0" />
            </div>
            <p className="text-center text-xs font-bold text-cyan-100">{LIVE_FLOW_ANALYZING}</p>
          </div>
        ) : null}
        {focused && !loading ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-white/15 bg-white/10 p-2 text-xs shadow-lg backdrop-blur-md">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-white/50">Popüler rotalar</p>
            <ul className="space-y-0.5">
              {ROUTE_SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left font-semibold text-white/90 transition hover:bg-white/15"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setValue(s);
                      ref.current?.focus();
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {focused && !loading ? (
        <p className="mt-2 text-xs font-semibold leading-relaxed text-cyan-200/90 animate-fade-in-up motion-reduce:animate-none">
          Gideceğin yeri yaz, sana uygun yolculukları gösterelim
        </p>
      ) : null}
      {remembered && !focused ? (
        <p className="mt-2 text-xs text-white/55">
          Son araman: <span className="font-semibold text-white/80">{remembered}</span>
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-orange-300/85">
        Teklif ve eşleşme adımlarını tamamlamak için{" "}
        <Link href="/indir" className="font-bold text-orange-200 underline-offset-2 hover:underline">
          uygulamaya geç
        </Link>
        .
      </p>
    </div>
  );
}

function HeroSocialProofQualitative() {
  return (
    <div className="space-y-1 text-center sm:text-left">
      <p className="text-sm font-semibold text-white/78">{LIVE_FLOW_PRIMARY}</p>
      <p className="text-xs text-white/55">
        <Link href="/indir" className="font-semibold text-cyan-200/90 underline-offset-2 hover:underline">
          {LIVE_FLOW_SECONDARY}
        </Link>
      </p>
    </div>
  );
}

export function HeroEngagement() {
  return (
    <div className="space-y-4">
      <HeroDestinationInput />
      <HeroSocialProofQualitative />
      <HeroDiscoveryHint />
    </div>
  );
}
