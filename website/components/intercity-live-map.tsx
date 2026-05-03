"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ButtonLink } from "@/components/button-link";
import { IntercityRealMapLoader } from "@/components/intercity-real-map-loader";
import { LiveDashboardTrustStrip, LiveSparseBanner } from "@/components/live-dashboard-chrome";
import { hasApiBaseUrl } from "@/lib/config";
import { getIntercityDashboard, loadIntercityDashboard, type IntercityDashboard } from "@/lib/intercity-live-data";
import { displayRouteStatus } from "@/lib/route-status-display";

const wantLiveData = process.env.NEXT_PUBLIC_USE_REAL_LIVE_DATA === "true";

function InlineStatNumber({ value }: { value: string }) {
  const numeric = value.replace(/[^\d]/g, "");
  const n = numeric ? parseInt(numeric, 10) : NaN;
  const display = Number.isFinite(n) && numeric.length > 0 ? n : value;
  return <span className="tabular-nums transition-[opacity,color] duration-500 ease-out">{display}</span>;
}

export function IntercityLiveMap() {
  const [dashboard, setDashboard] = useState(() => getIntercityDashboard());
  const [liveOk, setLiveOk] = useState(false);
  const [activityHudFreshCycle, setActivityHudFreshCycle] = useState(0);
  const liveSnapshotRef = useRef<IntercityDashboard | null>(null);
  const prevFeedHeadRef = useRef<string | undefined>(undefined);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!wantLiveData || !hasApiBaseUrl) {
      void Promise.resolve().then(() => {
        setDashboard(getIntercityDashboard());
        setLiveOk(false);
      });
      return;
    }

    let cancelled = false;

    function clearPoll() {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    function schedulePoll(tick: () => void | Promise<void>) {
      clearPoll();
      pollIntervalRef.current = setInterval(() => {
        void tick();
      }, 15000);
    }

    async function tick() {
      const retained = liveSnapshotRef.current;
      const { dashboard: next, source } = await loadIntercityDashboard({
        retainedLive: retained ?? undefined,
      });
      if (cancelled) return;
      if (source === "live") {
        liveSnapshotRef.current = next;
      }
      setDashboard(next);
      setLiveOk(source === "live");

      const headText = next.activityFeed[0]?.text ?? "";
      const prevText = prevFeedHeadRef.current;
      if (source === "live" && headText && prevText !== undefined && headText !== prevText) {
        setActivityHudFreshCycle((k) => k + 1);
      }
      if (source === "live") {
        prevFeedHeadRef.current = headText;
      }
    }

    function runWhenVisible() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        clearPoll();
        return;
      }
      void tick();
      schedulePoll(tick);
    }

    runWhenVisible();

    function onVisibilityChange() {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        clearPoll();
        return;
      }
      void tick();
      schedulePoll(tick);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearPoll();
    };
  }, []);

  const label = wantLiveData && liveOk ? "Canlı veri" : "Şu anda teklifler analiz ediliyor";
  const mapDataMode = liveOk ? "live" : "demo";

  const liveSparse = useMemo(() => Boolean(dashboard.uiHints?.liveSparse), [dashboard.uiHints?.liveSparse]);
  const showSparseBanner = liveOk && liveSparse;

  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 p-4 shadow-soft-card sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_20%,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_75%_80%,rgba(37,99,235,0.14),transparent_28%)]" />
      <div className="relative flex min-w-0 flex-col gap-5">
        <div className="mb-0 flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">şehirler arası rota ağı</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
              Canlı şehir dışı teklif görünümü
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-full border border-white/10 bg-white/[0.06] p-1">
              <Link href="/sehir-ici" className="rounded-full px-4 py-2 text-xs font-bold text-slate-300 transition hover:text-white">
                Şehir içi
              </Link>
              <span className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Şehirler arası</span>
            </div>
            <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
              {label}
            </span>
          </div>
        </div>

        <div className="min-h-0 min-w-0 space-y-3">
          {showSparseBanner ? <LiveSparseBanner variant="intercity" /> : null}
          <LiveDashboardTrustStrip />
          <div className="flex w-full max-w-full min-w-0 justify-center overflow-x-hidden px-2 sm:px-0">
            <div className="relative mx-auto w-full min-w-0 max-w-[min(100%,100vw)] overflow-x-hidden rounded-2xl">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <IntercityRealMapLoader
                  dashboard={dashboard}
                  dataMode={mapDataMode}
                  activityHudFreshCycle={activityHudFreshCycle}
                  liveSparse={liveSparse}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">aktif rota teklifleri</p>
              <p className="mt-1 text-lg font-black text-white">Öne çıkan şehir dışı teklifler</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Bugün açılan teklif · <InlineStatNumber value={dashboard.stats.routesOpenedToday} />
            </span>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.routes.map((route) => (
              <article
                key={route.id}
                className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-cyan-200/25"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {route.fromCity} → {route.toCity}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">{route.dateTime}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                      route.type === "sürücü"
                        ? "bg-cyan-400/15 text-cyan-100"
                        : "bg-emerald-400/15 text-emerald-100"
                    }`}
                  >
                    {route.type}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-slate-300">{route.seats} boş koltuk</span>
                  <span className="rounded-lg bg-cyan-400/10 px-2 py-1 font-black text-cyan-100">{route.suggestedCost}</span>
                  <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-slate-400">
                    {displayRouteStatus(route.status)}
                  </span>
                </div>
                <ButtonLink href="/indir" variant="secondary" className="mt-4 w-full py-2 text-xs">
                  Uygulamada Gör
                </ButtonLink>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-1 grid min-w-0 gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Aktif şehir dışı teklif</p>
            <p className="mt-1 text-xl font-black text-white">
              <InlineStatNumber value={dashboard.stats.activeListings} />
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Bekleyen eşleşme</p>
            <p className="mt-1 text-xl font-black text-emerald-100">
              <InlineStatNumber value={dashboard.stats.pendingMatches} />
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Bugün açılan teklif</p>
            <p className="mt-1 text-xl font-black text-cyan-100">
              <InlineStatNumber value={dashboard.stats.routesOpenedToday} />
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500">En yoğun rota</p>
            <p className="mt-1 truncate text-sm font-black text-white">{dashboard.stats.busiestLine}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
