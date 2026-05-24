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
        className="relative flex max-h-[min(90dvh,720px)] w-full max-w-[26rem] min-h-0 flex-col overflow-hidden rounded-[1.65rem] border border-cyan-400/22 bg-slate-950/[0.97] shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_0_72px_-8px_rgba(0,114,255,0.52),0_0_120px_-24px_rgba(34,211,238,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-400/18 backdrop-blur-2xl"
      >
        <div
          className="pointer-events-none absolute -inset-px rounded-[1.7rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.14)_0%,transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(0,114,255,0.12)_0%,transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-px rounded-[1.5875rem] bg-[linear-gradient(165deg,rgba(34,211,238,0.06)_0%,transparent_38%,rgba(59,130,246,0.05)_100%)]"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
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
  subtitle = "Canlı destek müsaitlik durumuna göre devreye girer.",
  onClose,
}: SupportPhoneModalHeaderProps) {
  return (
    <div className="shrink-0 border-b border-white/[0.07] bg-black/20 px-4 pb-3 pt-3.5 sm:px-5 sm:pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p id={titleId} className="text-[0.98rem] font-black leading-tight tracking-tight text-white sm:text-base">
              Leylek Zeka
            </p>
            <span className="inline-flex items-center rounded-full border border-cyan-400/28 bg-cyan-500/[0.1] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-50/95">
              {statusLabel}
            </span>
          </div>
          <p id={descId} className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 transition hover:border-cyan-400/25 hover:text-slate-200"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

type SupportEntryGatewayProps = {
  onSelectLeylek: () => void;
  onSelectLive: () => void;
};

export function SupportEntryGateway({ onSelectLeylek, onSelectLive }: SupportEntryGatewayProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-6 sm:px-6">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200/75">
        Nasıl yardım almak istersin?
      </p>
      <p className="mx-auto mt-2 max-w-[18rem] text-center text-[13px] leading-relaxed text-slate-400">
        Tek görüşme kaydı altında hem Leylek Zeka bilgilendirmesi hem canlı destek kullanılabilir.
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onSelectLeylek}
          className="inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-3 text-[14px] font-black tracking-tight text-white shadow-[0_14px_40px_-14px_rgba(0,198,255,0.48)] ring-1 ring-cyan-300/22 transition hover:brightness-[1.05]"
        >
          Leylek Zeka&apos;ya sor
        </button>
        <button
          type="button"
          onClick={onSelectLive}
          className="inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-3 text-[13px] font-semibold text-slate-100 transition hover:border-cyan-400/28 hover:bg-white/[0.08]"
        >
          Şirket ile iletişime geç
        </button>
      </div>
      <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-600">
        Leylek Zeka karar vermez; canlı destek müsaitlik durumunda yanıtlar.
      </p>
    </div>
  );
}
