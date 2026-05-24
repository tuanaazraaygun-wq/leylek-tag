"use client";

import { useCallback, useEffect } from "react";

import { isSafeKycImageUrl } from "@/lib/kyc-admin-types";

export type KycDocItem = { label: string; url: string };

type KycDocLightboxProps = {
  open: boolean;
  items: KycDocItem[];
  index: number;
  subtitle: string;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
};

export function KycDocLightbox({
  open,
  items,
  index,
  subtitle,
  onClose,
  onSelectIndex,
}: KycDocLightboxProps) {
  const item = items[index];

  const go = useCallback(
    (delta: number) => {
      if (items.length <= 1) return;
      const next = (index + delta + items.length) % items.length;
      onSelectIndex(next);
    },
    [index, items.length, onSelectIndex],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.label} belgesi`}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{item.label}</p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5"
          >
            Kapat
          </button>
        </div>
        <div className="relative flex flex-1 items-center justify-center bg-black/40 p-3">
          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 z-10 rounded-full border border-white/15 bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Önceki belge"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 z-10 rounded-full border border-white/15 bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Sonraki belge"
              >
                ›
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.label}
            className="max-h-[70vh] max-w-full object-contain"
          />
        </div>
        {items.length > 1 ? (
          <p className="border-t border-white/10 px-4 py-2 text-center text-[11px] text-slate-500">
            {index + 1} / {items.length}
          </p>
        ) : null}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="border-t border-white/10 px-4 py-2.5 text-center text-xs font-semibold text-cyan-300 hover:underline"
        >
          Tam boyut yeni sekmede aç
        </a>
      </div>
    </div>
  );
}

export function collectKycDocItems(row: {
  license_photo_url: string | null;
  vehicle_photo_url: string | null;
  motorcycle_photo_url: string | null;
  selfie_url: string | null;
}): KycDocItem[] {
  const specs: { label: string; url: string | null }[] = [
    { label: "Ehliyet", url: row.license_photo_url },
    { label: "Araç", url: row.vehicle_photo_url },
    { label: "Motor", url: row.motorcycle_photo_url },
    { label: "Selfie", url: row.selfie_url },
  ];
  return specs.filter((s): s is KycDocItem => Boolean(s.url && isSafeKycImageUrl(s.url)));
}
