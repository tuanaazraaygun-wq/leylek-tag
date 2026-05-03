"use client";

import type { ReactNode } from "react";
import { LIVE_FLOW_PRIMARY } from "@/lib/site-copy";

export type PulseStats = { searching: number; routes: number; users: number };

export function LiveActivityBar({ stats }: { stats: PulseStats }) {
  const parts: ReactNode[] = [];
  if (stats.searching > 0) {
    parts.push(
      <span key="s" className="tabular-nums">
        🚗 <strong className="font-semibold text-white/85">{stats.searching}</strong> kişi şu an yol arıyor
      </span>,
    );
  }
  if (stats.routes > 0) {
    parts.push(
      <span key="r" className="tabular-nums">
        ⚡ <strong className="font-semibold text-white/85">{stats.routes}</strong> yeni rota
      </span>,
    );
  }
  if (stats.users > 0) {
    parts.push(
      <span key="u" className="tabular-nums">
        👥 <strong className="font-semibold text-white/85">{stats.users}</strong> aktif kullanıcı
      </span>,
    );
  }

  if (parts.length === 0) {
    return (
      <div
        className="live-activity-bar mt-6 border-y border-white/[0.06] py-3 text-center text-xs font-semibold text-white/70 sm:mt-8 sm:text-left sm:text-sm"
        aria-live="polite"
      >
        {LIVE_FLOW_PRIMARY}
      </div>
    );
  }

  const withSeparators: ReactNode[] = [];
  parts.forEach((p, i) => {
    if (i > 0) {
      withSeparators.push(
        <span key={`sep-${i}`} className="hidden text-white/40 sm:inline" aria-hidden="true">
          •
        </span>,
      );
    }
    withSeparators.push(p);
  });

  return (
    <div
      className="live-activity-bar mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-y border-white/[0.06] py-3 text-center text-xs text-white/70 sm:mt-8 sm:justify-start sm:text-sm"
      aria-live="polite"
    >
      {withSeparators}
    </div>
  );
}
