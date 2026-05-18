"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/button-link";
import { useSiteAction } from "@/components/site-action-context";

const LS_ROUTE_KEY = "leylek_last_route_search";

type StoredRoute = {
  label?: string;
  from?: string;
  to?: string;
};

function persistRoute(parts: { from: string; to: string }) {
  try {
    const from = parts.from.trim();
    const to = parts.to.trim();
    const label = from && to ? `${from} → ${to}` : from || to || "";
    localStorage.setItem(LS_ROUTE_KEY, JSON.stringify({ from, to, label }));
  } catch {
    /* ignore */
  }
}

function readStored(
  setFrom: (s: string) => void,
  setTo: (s: string) => void,
  setRemembered: (s: string | null) => void,
) {
  try {
    const raw = localStorage.getItem(LS_ROUTE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as StoredRoute;

    let fromOut = "";
    let toOut = "";

    if (typeof p.from === "string") fromOut = p.from;
    if (typeof p.to === "string") toOut = p.to;

    const hasStructured = fromOut !== "" || toOut !== "";

    if (!hasStructured && typeof p.label === "string" && p.label.includes("→")) {
      const [a, b] = p.label.split("→").map((s) => s.trim());
      if (a) fromOut = a;
      if (b) toOut = b;
    }

    if (fromOut) setFrom(fromOut);
    if (toOut) setTo(toOut);

    const mem = `${fromOut.trim()} → ${toOut.trim()}`.trim().replace(/^→|→$/g, "").trim();
    if (mem.replace(/→/g, "").trim().length > 0) setRemembered(mem.replace(/\s*→\s*/g, " → "));
  } catch {
    /* ignore */
  }
}

function SwapIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 9 5-5 5 5M7 15l5 5 5-5" />
      <path strokeLinecap="round" d="M12 19V5" opacity={0.35} />
    </svg>
  );
}

function HeroDiscoveryHint() {
  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.02] px-4 py-3.5 sm:px-5">
      <p className="text-center text-[12px] leading-relaxed text-slate-400 sm:text-left sm:text-[13px]">
        Teklif sürecinin tamamı mobil uygulamada tamamlanır. Web vitrini ürünü ve güven ilkelerini net biçimde gösterir.{" "}
        <Link href="/indir" className="font-semibold text-cyan-100/95 underline-offset-[3px] hover:text-white hover:underline">
          İndiriş sayfası
        </Link>
      </p>
    </div>
  );
}

function HeroRouteInputs() {
  const { triggerProgress } = useSiteAction();
  const refTo = useRef<HTMLInputElement>(null);
  const [fromVal, setFromVal] = useState("");
  const [toVal, setToVal] = useState("");
  const [remembered, setRemembered] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => readStored(setFromVal, setToVal, setRemembered));
  }, []);

  const flushPersist = useCallback(() => {
    persistRoute({ from: fromVal, to: toVal });
    const raw = `${fromVal.trim()} → ${toVal.trim()}`.trim();
    setRemembered(raw.length > 0 ? raw.replace(/\s*→\s*/g, " → ") : null);
  }, [fromVal, toVal]);

  const swapFields = () => {
    const a = fromVal;
    const b = toVal;
    setFromVal(b);
    setToVal(a);
    queueMicrotask(() => persistRoute({ from: b, to: a }));
  };

  const runSubmit = () => {
    const combined = `${fromVal.trim()} → ${toVal.trim()}`.trim();
    if (!combined.replace(/→/g, "").trim() || loading) return;
    setLoading(true);
    window.setTimeout(() => {
      flushPersist();
      triggerProgress();
      setLoading(false);
    }, 900);
  };

  const inputShell =
    "tap-highlight relative w-full min-h-[52px] rounded-xl border border-white/[0.1] bg-slate-950/65 px-4 py-[0.8125rem] text-[14px] text-white placeholder:text-white/38 shadow-inner transition duration-200 ease-out focus:border-cyan-400/38 focus:outline-none focus:ring-[3px] focus:ring-cyan-400/[0.12] disabled:opacity-70 sm:text-[15px]";

  return (
    <div className="relative z-10 mt-6 sm:mt-8">
      <label htmlFor="hero-route-from" className="mb-4 block text-left text-[11px] font-black uppercase tracking-[0.26em] text-slate-300/92 sm:text-[12px]">
        Nereye gitmek istiyorsun?
      </label>

      <div className="relative rounded-[1.15rem] p-[1px]">
        <div className="pointer-events-none absolute -inset-px rounded-[1.18rem] bg-gradient-to-r from-cyan-500/[0.12] via-white/[0.055] to-sky-500/[0.1] opacity-90" aria-hidden />

        <div className="relative rounded-[1.1rem] border border-white/[0.065] bg-slate-950/45 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-5">
            <div
              className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3"
              onFocus={() => setFocused(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setFocused(false);
                  flushPersist();
                }
              }}
            >
              <div className="min-w-0 flex-1">
                <label htmlFor="hero-route-from" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Nereden?
                </label>
                <input
                  id="hero-route-from"
                  type="text"
                  name="origin"
                  autoComplete="off"
                  value={fromVal}
                  disabled={loading}
                  onChange={(e) => setFromVal(e.target.value)}
                  placeholder="Kalkış noktası"
                  className={inputShell}
                />
              </div>

              <div className="flex justify-center sm:mt-7 sm:flex-none">
                <button
                  type="button"
                  onClick={() => swapFields()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/22 bg-white/[0.04] text-cyan-100/92 shadow-[0_8px_24px_-12px_rgba(0,198,255,0.35)] transition hover:border-cyan-300/42 hover:bg-white/[0.07] hover:shadow-[0_12px_32px_-8px_rgba(0,198,255,0.26)] active:scale-[0.96]"
                  aria-label="Nereden ve nereyi yer değiştir"
                >
                  <SwapIcon />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <label htmlFor="hero-route-to" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Nereye?
                </label>
                <input
                  id="hero-route-to"
                  ref={refTo}
                  type="text"
                  name="destination"
                  autoComplete="off"
                  value={toVal}
                  disabled={loading}
                  onChange={(e) => setToVal(e.target.value)}
                  placeholder="Varış"
                  className={inputShell}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSubmit();
                    }
                  }}
                />
              </div>
            </div>

            <div className="shrink-0 xl:flex xl:flex-col xl:items-stretch xl:pt-7">
              <ButtonLink href="/indir" className="w-full whitespace-nowrap !px-5 !py-3 !text-[13px] xl:w-auto" onMouseDown={() => flushPersist()}>
                Uygulamada teklif oluştur
              </ButtonLink>
            </div>
          </div>

          {loading ? (
            <div className="pointer-events-none absolute inset-[1px] z-[2] flex flex-col justify-center rounded-[1.05rem] border border-white/[0.06] bg-slate-950/84 px-4 backdrop-blur-[3px] sm:inset-[2px]">
              <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="loading-shimmer h-full w-[40%] rounded-full bg-gradient-to-r from-cyan-500/10 via-white/24 to-cyan-500/10" />
              </div>
              <p className="text-center text-xs font-semibold text-slate-300">Özet kayıt güncelleniyor</p>
            </div>
          ) : null}
        </div>
      </div>

      {focused && !loading ? (
        <>
          <p className="mt-3 px-0.5 text-[11px] font-medium leading-relaxed text-slate-400/90 sm:text-[12px]">
            Rota bilgisi yalnızca bu tarayıcıya kaydedilir; sunucuya gönderilmez.
          </p>
          <p className="mt-4 px-1 text-[10px] font-black uppercase tracking-[0.26em] text-slate-500">örnek çiftler</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {(["Kadıköy → Levent", "İstanbul → Ankara", "İzmir → Bursa"] as const).map((s) => {
              const [a, b] = s.split(" → ");
              return (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2.5 text-left text-[12px] font-semibold text-white/90 transition hover:border-cyan-400/28 hover:bg-white/[0.06]"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFromVal(a);
                      setToVal(b);
                      refTo.current?.focus();
                    }}
                  >
                    {s}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {remembered && !focused ? (
        <p className="mt-3 px-0.5 text-[11px] text-slate-500 sm:text-[12px]">
          Son kayıt:{" "}
          <span className="font-semibold text-slate-300">{remembered}</span>
        </p>
      ) : null}

      <div className="mt-8 space-y-2 border-t border-white/[0.055] pt-7">
        <p className="text-[13px] leading-relaxed text-slate-200/92 sm:text-sm">Teklif ve eşleşme adımları uygulamada tamamlanır.</p>
        <p className="text-[13px] leading-relaxed text-slate-400 sm:text-sm">
          Web’de akışı inceleyebilir, uygulamada teklifini oluşturabilirsin.
        </p>
      </div>
    </div>
  );
}

export function HeroEngagement() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroRouteInputs />
      <HeroDiscoveryHint />
    </div>
  );
}
