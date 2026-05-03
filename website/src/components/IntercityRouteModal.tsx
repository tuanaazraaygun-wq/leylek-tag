"use client";

import { useEffect, useId, useRef } from "react";
import { ButtonLink } from "@/components/button-link";
import { EMPTY_STATS_DISPLAY } from "@/lib/site-copy";
import type { IntercityLiveRoute, IntercityLiveStats } from "@src/lib/api";

function summaryStatLooksEmpty(v: string): boolean {
  const t = v.trim();
  return t === "" || t === "0" || t === "—";
}

function formatSummaryStat(v: string | undefined): string {
  const t = (v ?? "").trim();
  return summaryStatLooksEmpty(t) ? EMPTY_STATS_DISPLAY : t;
}

function roleSentence(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "sürücü" || t === "driver" || t === "private_driver") return "Bu ilan: Sürücü";
  if (t === "yolcu" || t === "passenger") return "Bu ilan: Yolcu";
  const label = raw ? raw.charAt(0).toLocaleUpperCase("tr-TR") + raw.slice(1) : "—";
  return `Bu ilan: ${label}`;
}

function statusBadgeClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "aktif") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-100";
  if (s === "eşleşiyor") return "border-cyan-400/35 bg-cyan-400/10 text-cyan-100";
  if (s === "yakında" || s === "yakinda") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/15 bg-white/[0.06] text-slate-200";
}

type Props = {
  open: boolean;
  onClose: () => void;
  route: IntercityLiveRoute | null;
  stats: IntercityLiveStats | null;
};

export function IntercityRouteModal({ open, onClose, route, stats }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open, route?.id]);

  if (!open || !route) return null;

  const cost = (route.suggestedCost || "").trim() || "—";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
      aria-hidden={false}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-opacity"
        aria-label="Kapat"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-cyan-200/15 bg-[#050f1c] shadow-[0_-24px_80px_rgba(0,0,0,0.45)] sm:rounded-[2rem] sm:shadow-soft-card"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="relative flex max-h-[inherit] flex-col overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-7">
          <div className="mx-auto mb-4 h-1 w-12 shrink-0 rounded-full bg-white/15 sm:hidden" aria-hidden />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id={titleId} className="min-w-0 flex-1 text-xl font-black tracking-tight text-white sm:text-2xl">
              {route.fromCity} → {route.toCity}
            </h2>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${statusBadgeClass(route.status)}`}
            >
              {route.status || "—"}
            </span>
          </div>

          <p className="mt-4 text-sm font-semibold text-cyan-100/95">{roleSentence(route.type)}</p>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Yol paylaşımı masrafı</dt>
              <dd className="font-black text-white">{cost}</dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Koltuk</dt>
              <dd className="font-semibold text-slate-200">{route.seats}</dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Zaman</dt>
              <dd className="font-semibold text-slate-200">{route.dateTime}</dd>
            </div>
          </dl>

          {stats && (
            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-400">Platform genelindeki şehirler arası aktif ilan sayısı: </span>
                <span className="text-slate-300">{formatSummaryStat(stats.activeListings)}</span>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-400">En yoğun hat: </span>
                <span className="text-slate-300">{formatSummaryStat(stats.busiestRoute)}</span>
              </p>
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-slate-400">
            Teklif vermek ve eşleşmek için Leylek TAG uygulamasını açın.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-200 via-cyan-300 to-blue-400 px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-glow transition duration-300 hover:-translate-y-0.5 hover:shadow-cyan-300/40"
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              Uygulamada teklif ver
            </a>
            <ButtonLink href="/indir" variant="secondary" className="w-full sm:w-auto">
              Uygulamayı indir
            </ButtonLink>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-center text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline sm:mt-5"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
