"use client";

import { useEffect, useState } from "react";
import {
  fetchIntercityLive,
  type IntercityLiveResponse,
  type IntercityLiveRoute,
} from "@src/lib/api";
import { IntercityRouteModal } from "@src/components/IntercityRouteModal";

function roleLabel(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "sürücü" || t === "driver" || t === "private_driver") return "Sürücü";
  if (t === "yolcu" || t === "passenger") return "Yolcu";
  return raw ? raw.charAt(0).toLocaleUpperCase("tr-TR") + raw.slice(1) : "—";
}

function statusBadgeClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "aktif") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-100";
  if (s === "eşleşiyor") return "border-cyan-400/35 bg-cyan-400/10 text-cyan-100";
  if (s === "yakında" || s === "yakinda") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/15 bg-white/[0.06] text-slate-200";
}

function RouteCard({ route, onOpen }: { route: IntercityLiveRoute; onOpen: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft-card transition duration-300 ease-out hover:scale-[1.02] hover:border-cyan-300/25 hover:shadow-[0_0_36px_rgba(34,211,238,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/60 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.09),transparent_55%)] opacity-80 transition-opacity group-hover:opacity-100" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="truncate text-lg font-black tracking-tight text-white sm:text-xl">
            {route.fromCity} → {route.toCity}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-300">
            <span className="text-cyan-100/95">{roleLabel(route.type)}</span>
            <span className="text-slate-500">·</span>
            <span>{route.seats} koltuk</span>
            <span className="text-slate-500">·</span>
            <span className="font-black text-white">{route.suggestedCost || "—"}</span>
          </div>
          <p className="text-xs font-medium text-slate-500">{route.dateTime}</p>
        </div>
        <div className="shrink-0 sm:pt-1">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${statusBadgeClass(route.status)}`}
          >
            {route.status || "—"}
          </span>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-soft-card">
      <div className="h-6 max-w-[min(75%,18rem)] rounded-lg bg-white/10" />
      <div className="mt-4 h-4 w-full max-w-xs rounded bg-white/10" />
      <div className="mt-3 h-3 w-40 rounded bg-white/[0.07]" />
      <div className="mt-4 flex justify-end">
        <div className="h-8 w-20 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function IntercityList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<IntercityLiveResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<IntercityLiveRoute | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchIntercityLive();
        if (cancelled) return;
        console.log("INTERCITY PROXY DATA:", data);
        setPayload(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Yüklenemedi");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const routes = payload?.routes ?? [];
  const stats = payload?.stats;
  const empty = !loading && !error && routes.length === 0;

  return (
    <div className="space-y-6">
      {stats && !loading && !error && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Aktif ilan</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{stats.activeListings}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">En yoğun hat</p>
            <p className="mt-1 truncate text-lg font-black text-cyan-100">{stats.busiestRoute || "—"}</p>
          </div>
        </div>
      )}

      {loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="animate-pulse h-[5.25rem] rounded-2xl border border-white/10 bg-white/[0.06]" />
            <div className="animate-pulse h-[5.25rem] rounded-2xl border border-white/10 bg-white/[0.06]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Canlı veri alınamadı ({error}). Sayfayı yenileyin veya daha sonra tekrar deneyin.
        </p>
      )}

      {empty && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center text-base font-semibold text-slate-400">
          Şu anda şehirler arası ilan yok
        </p>
      )}

      {!loading && !empty && routes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              onOpen={() => setSelectedRoute(route)}
            />
          ))}
        </div>
      )}

      <IntercityRouteModal
        open={selectedRoute !== null}
        onClose={() => setSelectedRoute(null)}
        route={selectedRoute}
        stats={stats ?? null}
      />
    </div>
  );
}