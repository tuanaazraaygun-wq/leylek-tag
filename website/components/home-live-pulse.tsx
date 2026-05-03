"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EMPTY_STATS_DISPLAY, LIVE_FLOW_ANALYZING, LIVE_FLOW_SECONDARY } from "@/lib/site-copy";
import { fetchIntercityLive, type IntercityLiveStats } from "@src/lib/api";

function statLooksEmpty(v: string): boolean {
  const t = v.trim();
  return t === "" || t === "0" || t === "—" || /^0\s/i.test(t);
}

function allStatsLookEmpty(stats: IntercityLiveStats): boolean {
  return (
    statLooksEmpty(stats.activeListings) &&
    statLooksEmpty(stats.pendingMatches) &&
    statLooksEmpty(stats.todayRoutes) &&
    statLooksEmpty(stats.busiestRoute)
  );
}

function displayLiveStat(value: string): string {
  return statLooksEmpty(value) ? EMPTY_STATS_DISPLAY : value.trim();
}

function StatCard({ label, value }: { label: string; value: string }) {
  const shown = displayLiveStat(value);
  const isEmptySlot = shown === EMPTY_STATS_DISPLAY;
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p
        className={`mt-1 text-white sm:text-xl ${isEmptySlot ? "text-xs font-bold leading-snug text-white/85 line-clamp-3 sm:text-sm" : "truncate text-lg font-black tabular-nums"}`}
      >
        {shown}
      </p>
    </div>
  );
}

export function HomeLivePulse() {
  const [phase, setPhase] = useState<"loading" | "ready" | "fallback">("loading");
  const [stats, setStats] = useState<IntercityLiveStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchIntercityLive();
        if (cancelled) return;
        if (data.success && data.stats) {
          setStats(data.stats);
          setPhase(allStatsLookEmpty(data.stats) ? "fallback" : "ready");
        } else {
          setPhase("fallback");
        }
      } catch {
        if (!cancelled) setPhase("fallback");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-8 min-w-0 max-w-full overflow-x-hidden border-t border-white/10 pt-8 md:mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200/80">canlı özet</p>
      </div>
      {phase === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] animate-pulse rounded-2xl border border-white/10 bg-white/[0.05]"
            />
          ))}
        </div>
      ) : phase === "ready" && stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Aktif şehir dışı teklif" value={stats.activeListings} />
          <StatCard label="Bekleyen eşleşme" value={stats.pendingMatches} />
          <StatCard label="En yoğun rota" value={stats.busiestRoute || ""} />
          <StatCard label="Bugün açılan teklif" value={stats.todayRoutes} />
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm leading-relaxed text-slate-400">
          <p className="font-semibold text-slate-300">{LIVE_FLOW_ANALYZING}</p>
          <p>
            <Link href="/indir" className="font-semibold text-cyan-200/85 underline-offset-2 hover:underline">
              {LIVE_FLOW_SECONDARY}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
