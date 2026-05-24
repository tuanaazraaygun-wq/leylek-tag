"use client";

type SidePanelRow = {
  name: string | null;
  email: string | null;
  created_at: string;
  status: string;
  user_agent: string | null;
  source: string | null;
  page_path: string | null;
};

type ViewerState =
  | "claimable_new"
  | "self_reviewing"
  | "self_resolved"
  | "other_reviewing"
  | "other_resolved"
  | "reviewing_missing_assignment";

type AdminDeskSidePanelProps = {
  row: SidePanelRow;
  viewerState: ViewerState;
  onMarkResolved: () => void;
  updating: boolean;
  statusLabel: string;
  statusBadgeClass: string;
  createdLabel: string;
  lastActivityLabel: string;
  channelLabel: string;
  browserLabel: string | null;
};

export function AdminDeskSidePanel({
  row,
  viewerState,
  onMarkResolved,
  updating,
  statusLabel,
  statusBadgeClass,
  createdLabel,
  lastActivityLabel,
  channelLabel,
  browserLabel,
}: AdminDeskSidePanelProps) {
  const name = row.name?.trim();
  const email = row.email?.trim();

  return (
    <aside
      aria-label="Görüşme özeti"
      className="admin-desk-side relative flex w-full min-w-0 flex-col gap-2 rounded-xl border border-cyan-400/[0.1] bg-slate-950/[0.55] p-3 shadow-[0_12px_40px_-28px_rgba(34,211,238,0.35)] ring-1 ring-white/[0.06] backdrop-blur-xl xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto xl:overscroll-contain"
    >
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300/75">Özet</p>

      <dl className="space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Durum</dt>
          <dd>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${statusBadgeClass}`}
            >
              {statusLabel}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Son aktivite</dt>
          <dd className="text-right font-mono text-[10px] text-slate-400">{lastActivityLabel}</dd>
        </div>
        {name ? (
          <div className="flex justify-between gap-2">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Ad</dt>
            <dd className="max-w-[9rem] truncate text-right text-slate-200">{name}</dd>
          </div>
        ) : null}
        {email ? (
          <div className="flex justify-between gap-2">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">E-posta</dt>
            <dd className="max-w-[9rem] break-all text-right text-[10px] text-slate-400">{email}</dd>
          </div>
        ) : null}
      </dl>

      <details className="group rounded-lg border border-white/[0.06] bg-black/30 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer select-none px-2.5 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-200">
          Detaylar
        </summary>
        <dl className="space-y-1.5 border-t border-white/[0.05] px-2.5 py-2 text-[10px]">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Oluşturulma</dt>
            <dd className="font-mono text-slate-400">{createdLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Kanal</dt>
            <dd className="truncate text-slate-400">{channelLabel}</dd>
          </div>
          {browserLabel ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-slate-500">Tarayıcı</dt>
              <dd className="text-right text-slate-400">{browserLabel}</dd>
            </div>
          ) : null}
        </dl>
      </details>

      {viewerState === "self_reviewing" ? (
        <button
          type="button"
          disabled={updating}
          aria-busy={updating}
          onClick={onMarkResolved}
          className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-amber-400/28 bg-amber-500/[0.1] px-2.5 text-[11px] font-bold text-amber-50/95 disabled:opacity-50"
        >
          {updating ? "Kaydediliyor…" : "Görüşmeyi kapat"}
        </button>
      ) : null}

      <p className="text-[9px] leading-snug text-slate-600">
        Not, engelleme ve etiketler yakında. Hazır cevaplar yanıt alanının üstünde.
      </p>
    </aside>
  );
}
