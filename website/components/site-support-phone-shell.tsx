"use client";

import type { ReactNode } from "react";

type SiteSupportPhoneShellProps = {
  dialogId: string;
  titleId: string;
  descId: string;
  onOverlayClose: () => void;
  children: ReactNode;
};

export function SiteSupportPhoneShell({
  dialogId,
  titleId,
  descId,
  onOverlayClose,
  children,
}: SiteSupportPhoneShellProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Destek penceresini kapat"
        onClick={onOverlayClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      <div
        role="dialog"
        id={dialogId}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="relative flex max-h-[min(90dvh,720px)] w-full max-w-[26rem] min-h-0 flex-col overflow-hidden rounded-[1.65rem] border border-cyan-400/14 bg-slate-950/95 shadow-[0_0_56px_-14px_rgba(0,114,255,0.42),0_0_96px_-32px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[1.65rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.09)_0%,transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_28%)]"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function LeylekHeaderAvatar() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-gradient-to-br from-cyan-500/14 to-slate-900/90 shadow-[0_0_14px_-6px_rgba(34,211,238,0.4)]"
      aria-hidden
    >
      <svg className="h-[1.05rem] w-[1.05rem] text-cyan-300/95" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 13.5v3a2 2 0 0 0 2 2h1v-8H7a2 2 0 0 0-2 2v1Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M19 13.5v3a2 2 0 0 1-2 2h-1v-8h1a2 2 0 0 1 2 2v1Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M7 17.5V18a5 5 0 1 0 10 0v-.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function headerStatusDotClass(statusLabel: string): string {
  if (statusLabel.includes("Yanıt")) return "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.55)] animate-pulse";
  if (statusLabel.includes("Destek")) return "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.45)]";
  return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.45)]";
}

type SupportPhoneModalHeaderProps = {
  titleId: string;
  descId: string;
  statusLabel: string;
  subtitle?: string;
  onClose: () => void;
};

export function SupportPhoneModalHeader({
  titleId,
  descId,
  statusLabel,
  subtitle = "Size anında yardımcı olmaya hazır.",
  onClose,
}: SupportPhoneModalHeaderProps) {
  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-slate-950/50 px-4 pb-2.5 pt-3 sm:px-5">
      <div className="flex items-start gap-2.5">
        <LeylekHeaderAvatar />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p id={titleId} className="text-[15px] font-bold leading-tight tracking-tight text-white">
              Leylek Zeka
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${headerStatusDotClass(statusLabel)}`}
                aria-hidden
              />
              {statusLabel}
            </span>
          </div>
          <p id={descId} className="mt-0.5 text-[12px] leading-snug text-slate-400">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 border-t border-white/[0.04] pt-2 text-[10px] leading-snug text-slate-500">
        <svg className="h-3 w-3 shrink-0 text-slate-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"
            fill="currentColor"
            opacity="0.55"
          />
        </svg>
        Canlı destek müsaitlik durumunda devreye girer.
      </p>
    </div>
  );
}

type SupportEntryGatewayProps = {
  onSelectLeylek: () => void;
  onSelectLive: () => void;
};

export function SupportEntryGateway({ onSelectLeylek, onSelectLive }: SupportEntryGatewayProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5 sm:px-6">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Nasıl yardım almak istersin?
      </p>
      <p className="mx-auto mt-2 max-w-[18rem] text-center text-[13px] leading-relaxed text-slate-400">
        Tek görüşme kaydı altında Leylek Zeka ve canlı destek birlikte kullanılabilir.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onSelectLeylek}
          className="inline-flex min-h-[46px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-3 text-[14px] font-bold tracking-tight text-white shadow-[0_12px_36px_-16px_rgba(0,198,255,0.45)] transition hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/50"
        >
          Leylek Zeka&apos;ya sor
        </button>
        <button
          type="button"
          onClick={onSelectLive}
          className="inline-flex min-h-[46px] touch-manipulation items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-slate-200 transition hover:border-cyan-400/22 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20"
        >
          Şirket ile iletişime geç
        </button>
      </div>
    </div>
  );
}
