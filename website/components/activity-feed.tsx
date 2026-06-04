"use client";

import { useMemo, useState } from "react";
import {
  getCuratedIntercityOperationsFeed,
  getCuratedIntracityOperationsFeed,
  getCuratedOperationsMicroStats,
  statusBadgeStyles,
  type OperationsFeedEvent,
} from "@/lib/home-operations-feed";

type ActivityFeedProps = {
  /** Homepage: şehir içi öncelikli, şehir dışı collapsed alt bölüm. */
  variant?: "home" | "default";
};

function OperationsMicroStats() {
  const stats = getCuratedOperationsMicroStats();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.id}
          className="rounded-xl border border-white/[0.07] bg-slate-950/40 px-2.5 py-2 sm:px-3 sm:py-2.5"
        >
          <p className="text-[15px] font-bold tabular-nums leading-none text-white sm:text-base">{stat.value}</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{stat.hint}</p>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-400">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function FeedEventRow({ item }: { item: OperationsFeedEvent }) {
  const styles = statusBadgeStyles[item.status];

  return (
    <div
      className={`rounded-xl border bg-slate-950/45 px-3 py-2.5 sm:px-3.5 sm:py-3 ${styles.row}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative mt-1 flex h-2 w-2 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-40 ${styles.dot}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${styles.dot}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
              {item.city} · {item.district}
            </p>
            <span className="text-[10px] font-medium tabular-nums text-slate-500">{item.timeLabel}</span>
          </div>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-100">{item.headline}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.subline}</p>
          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.11em] ring-1 ring-inset ${styles.badge}`}
            >
              {item.statusLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrollingFeed({ events }: { events: OperationsFeedEvent[] }) {
  const loopedFeed = useMemo(() => [...events, ...events], [events]);

  return (
    <div className="relative mt-3 h-[16.5rem] overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 sm:h-[17.5rem]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-slate-950/90 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-slate-950/90 to-transparent" />
      <div className="absolute inset-x-0 top-0 px-2 pt-2 animate-feed-slide space-y-2">
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
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            pilot vitrin
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {isHome ? "Örnek uygulama akışı" : "Örnek rota akışı"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {isHome
              ? "Ankara, İstanbul ve İzmir pilot bölgeleri · canlı operasyon verisi değildir"
              : "Şehir içi teklif, eşleşme ve doğrulama adımlarının örnek görünümü"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-cyan-400/18 bg-cyan-400/8 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-100/90">
          Örnek akış
        </span>
      </div>

      {isHome ? (
        <div className="mt-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            pilot vitrin özeti
          </p>
          <div className="mt-2">
            <OperationsMicroStats />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">örnek olay akışı</p>
        <p className="text-[9px] text-slate-600">uygulama deneyimi örneği</p>
      </div>

      <ScrollingFeed events={intracityEvents} />

      {isHome ? (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={() => setIntercityOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-left transition hover:border-white/[0.1] hover:bg-white/[0.04]"
            aria-expanded={intercityOpen}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                şehir dışı akış
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Planlı rota ilanları · ikincil görünüm</p>
            </div>
            <span className="text-[11px] font-semibold text-cyan-200/75">{intercityOpen ? "Gizle" : "Göster"}</span>
          </button>
          {intercityOpen ? (
            <div className="mt-2.5 space-y-2">
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
