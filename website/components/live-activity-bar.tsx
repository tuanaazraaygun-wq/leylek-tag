"use client";

export type PulseStats = { searching: number; routes: number; users: number };

export function LiveActivityBar({ stats }: { stats: PulseStats }) {
  return (
    <div
      className="live-activity-bar mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-y border-white/[0.06] py-3 text-center text-xs text-white/70 sm:mt-8 sm:justify-start sm:text-sm"
      aria-live="polite"
    >
      <span className="tabular-nums">
        🚗 <strong className="font-semibold text-white/85">{stats.searching}</strong> kişi şu an yol arıyor
      </span>
      <span className="hidden text-white/40 sm:inline" aria-hidden="true">
        •
      </span>
      <span className="tabular-nums">
        ⚡ <strong className="font-semibold text-white/85">{stats.routes}</strong> yeni rota
      </span>
      <span className="hidden text-white/40 sm:inline" aria-hidden="true">
        •
      </span>
      <span className="tabular-nums">
        👥 <strong className="font-semibold text-white/85">{stats.users}</strong> aktif kullanıcı
      </span>
    </div>
  );
}
