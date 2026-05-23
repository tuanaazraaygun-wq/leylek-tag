"use client";

import { useMemo, useState } from "react";
import {
  getCuratedIntercityOperationsFeed,
  getCuratedIntracityOperationsFeed,
  statusBadgeStyles,
  type OperationsFeedEvent,
} from "@/lib/home-operations-feed";

type ActivityFeedProps = {
  /** Homepage: şehir içi öncelikli, şehir dışı collapsed alt bölüm. */
  variant?: "home" | "default";
};

function FeedEventRow({ item }: { item: OperationsFeedEvent }) {
  const styles = statusBadgeStyles[item.status];

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full shadow-lg ${styles.dot}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {item.city} · {item.district}
            </p>
            <p className="mt-1 text-sm font-medium leading-snug text-slate-100">{item.message}</p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-500">{item.timeAgo}</span>
      </div>
      <div className="mt-2.5 flex pl-5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset ${styles.badge}`}
        >
          {item.statusLabel}
        </span>
      </div>
    </div>
  );
}

function ScrollingFeed({ events }: { events: OperationsFeedEvent[] }) {
  const loopedFeed = useMemo(() => [...events, ...events], [events]);

  return (
    <div className="relative h-[17.5rem] overflow-hidden sm:h-72">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-slate-950/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-slate-950/85 to-transparent" />
      <div className="absolute inset-x-0 top-0 animate-feed-slide space-y-2.5">
        {loopedFeed.map((item, index) => (
          <FeedEventRow key={`${item.id}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function ActivityFeed({ variant = "default" }: ActivityFeedProps) {
  const [intercityOpen, setIntercityOpen] = useState(false);
  const intracityEvents = getCuratedIntracityOperationsFeed();
  const intercityEvents = getCuratedIntercityOperationsFeed();
  const isHome = variant === "home";

  return (
    <div className="glass-panel overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {isHome ? "Canlı şehir içi hareket" : "Aktif rota akışı"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {isHome
              ? "Ankara, İstanbul ve İzmir pilot bölgelerinde platform olayları"
              : "Şehir içi teklif, eşleşme ve doğrulama adımları"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
          </span>
          Canlı
        </span>
      </div>

      <ScrollingFeed events={intracityEvents} />

      {isHome ? (
        <div className="mt-4 border-t border-white/[0.07] pt-4">
          <button
            type="button"
            onClick={() => setIntercityOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05]"
            aria-expanded={intercityOpen}
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                şehir dışı akış
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Planlı rota ilanları · ikincil görünüm</p>
            </div>
            <span className="text-xs font-semibold text-cyan-200/80">{intercityOpen ? "Gizle" : "Göster"}</span>
          </button>
          {intercityOpen ? (
            <div className="mt-3 space-y-2.5">
              {intercityEvents.map((item) => (
                <FeedEventRow key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
