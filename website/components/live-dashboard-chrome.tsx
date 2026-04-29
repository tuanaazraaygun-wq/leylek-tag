"use client";

import { memo } from "react";

export const LiveDashboardTrustStrip = memo(function LiveDashboardTrustStrip({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[11px] leading-relaxed text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:text-xs ${className ?? ""}`}
    >
      <p>Canlı veriler anonim ve bölge düzeyinde gösterilir.</p>
      <p className="mt-1.5">Tam adres ve kişisel bilgiler paylaşılmaz.</p>
      <p className="mt-1.5">Yolculuk paylaşımı kontrollü ve görünür akışla takip edilir.</p>
    </div>
  );
});

export const LiveSparseBanner = memo(function LiveSparseBanner({ variant }: { variant: "city" | "intercity" }) {
  const title =
    variant === "city"
      ? "Bu şehir için canlı akış hazırlanıyor"
      : "Şehirler arası canlı akış hazırlanıyor";

  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-400/[0.06] to-transparent px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className="text-sm font-bold text-cyan-50">{title}</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">Demo görünüm · gerçek veriye hazır</p>
    </div>
  );
});

export const CityMapLegend = memo(function CityMapLegend() {
  return (
    <div className="map-legend-panel pointer-events-none rounded-2xl border border-cyan-200/12 bg-slate-950/72 px-3 py-2.5 shadow-soft-card backdrop-blur-xl">
      <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Lejant</p>
      <ul className="space-y-2 text-[10px] font-semibold text-slate-300 sm:text-[11px]">
        <li className="flex items-center gap-2">
          <span className="map-legend-swatch map-legend-swatch--heat" aria-hidden />
          <span>Yoğun bölge</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="map-legend-swatch map-legend-swatch--route" aria-hidden />
          <span>Aktif hat</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="map-legend-swatch map-legend-swatch--pulse" aria-hidden />
          <span>Yeni eşleşme</span>
        </li>
      </ul>
    </div>
  );
});

export const IntercityMapLegend = memo(function IntercityMapLegend() {
  return (
    <div className="map-legend-panel pointer-events-none rounded-2xl border border-cyan-200/12 bg-slate-950/72 px-3 py-2.5 shadow-soft-card backdrop-blur-xl">
      <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Lejant</p>
      <ul className="space-y-2 text-[10px] font-semibold text-slate-300 sm:text-[11px]">
        <li className="flex items-center gap-2">
          <span className="map-legend-swatch map-legend-swatch--steady" aria-hidden />
          <span>Aktif ilan</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="map-legend-swatch map-legend-swatch--matching" aria-hidden />
          <span>Eşleşiyor</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="map-legend-swatch map-legend-swatch--soon" aria-hidden />
          <span>Yakında</span>
        </li>
      </ul>
    </div>
  );
});
