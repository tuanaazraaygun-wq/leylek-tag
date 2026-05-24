"use client";

import {
  isSafeKycImageUrl,
  kycDisplayField,
  kycStatusBadgeClass,
  kycStatusLabel,
  kycVehicleKindLabel,
  type KycPendingRow,
  type KycReviewAction,
} from "@/lib/kyc-admin-types";

import { collectKycDocItems, type KycDocItem } from "@/components/kyc-doc-lightbox";

type KycApplicationCardProps = {
  row: KycPendingRow;
  acting: boolean;
  onOpenDoc: (items: KycDocItem[], index: number, subtitle: string) => void;
  onAction: (action: KycReviewAction) => void;
};

function DocThumb({
  label,
  url,
  onOpen,
}: {
  label: string;
  url: string | null;
  onOpen: () => void;
}) {
  if (!url || !isSafeKycImageUrl(url)) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
        <p className="mt-1 text-[10px] text-slate-600">—</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-lg border border-white/[0.08] bg-black/25 text-left ring-0 transition hover:border-cyan-400/30 focus:border-cyan-400/40 focus:outline-none"
    >
      <p className="px-2 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="mt-1 h-16 w-full object-cover bg-slate-900 transition group-hover:opacity-90"
        loading="lazy"
      />
    </button>
  );
}

export function KycApplicationCard({ row, acting, onOpenDoc, onAction }: KycApplicationCardProps) {
  const kind = row.pending_vehicle_kind || row.kyc_vehicle_kind;
  const approvedKinds =
    row.approved_vehicle_kinds.length > 0
      ? row.approved_vehicle_kinds.map((k) => kycVehicleKindLabel(k)).join(", ")
      : "—";
  const isPending = row.kyc_status === "pending";
  const docItems = collectKycDocItems(row);
  const subtitle = `${kycDisplayField(row.name)} · ${row.phone ?? "—"}`;

  const openDocByLabel = (label: string) => {
    const idx = docItems.findIndex((d) => d.label === label);
    if (idx >= 0) onOpenDoc(docItems, idx, subtitle);
  };

  const additiveHint =
    isPending &&
    row.approved_vehicle_kinds.length > 0 &&
    "Ek araç tipi başvurusu — red işlemi mevcut onaylı tipleri koruyabilir.";

  return (
    <article className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4 ring-1 ring-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-white">{kycDisplayField(row.name)}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.phone ?? "—"}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${kycStatusBadgeClass(row.kyc_status)}`}
        >
          {kycStatusLabel(row.kyc_status)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-slate-500">Başvuru tipi</dt>
          <dd className="text-slate-200">{kycVehicleKindLabel(kind)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-slate-500">Onaylı tipler</dt>
          <dd className="text-slate-200">{approvedKinds}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wider text-slate-500">Plaka</dt>
          <dd className="text-slate-200">{kycDisplayField(row.plate_number)}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-[9px] uppercase tracking-wider text-slate-500">Araç</dt>
          <dd className="text-slate-300">
            {kycDisplayField(row.vehicle_brand)} {kycDisplayField(row.vehicle_model)} ·{" "}
            {kycDisplayField(row.vehicle_color)}
          </dd>
        </div>
        {row.kyc_rejection_reason ? (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-[9px] uppercase tracking-wider text-slate-500">Son mesaj</dt>
            <dd className="text-slate-400">{row.kyc_rejection_reason}</dd>
          </div>
        ) : null}
        {row.kyc_last_reviewed_at ? (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-[9px] uppercase tracking-wider text-slate-500">Son inceleme</dt>
            <dd className="text-slate-500">
              {row.kyc_last_review_action ?? "—"} · {row.kyc_last_reviewed_by ?? "—"} ·{" "}
              {new Date(row.kyc_last_reviewed_at).toLocaleString("tr-TR")}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <DocThumb label="Ehliyet" url={row.license_photo_url} onOpen={() => openDocByLabel("Ehliyet")} />
        <DocThumb label="Araç" url={row.vehicle_photo_url} onOpen={() => openDocByLabel("Araç")} />
        <DocThumb label="Motor" url={row.motorcycle_photo_url} onOpen={() => openDocByLabel("Motor")} />
        <DocThumb label="Selfie" url={row.selfie_url} onOpen={() => openDocByLabel("Selfie")} />
      </div>

      {additiveHint ? (
        <p className="mt-2 text-[10px] text-amber-200/80">{additiveHint}</p>
      ) : null}

      {isPending ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            disabled={acting}
            onClick={() => onAction("approve")}
            className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-400/30 disabled:opacity-50"
          >
            Onayla
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => onAction("reject")}
            className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-100 ring-1 ring-rose-400/30 disabled:opacity-50"
          >
            Reddet
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => onAction("request_docs")}
            className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-100 ring-1 ring-amber-400/30 disabled:opacity-50"
          >
            Eksik belge
          </button>
        </div>
      ) : null}
    </article>
  );
}
