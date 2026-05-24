"use client";

import { CANNED_REPLY_PRESETS } from "@/lib/support-desk-config";

type AdminSupportCannedChipsProps = {
  disabled?: boolean;
  onSelect: (text: string) => void;
};

export function AdminSupportCannedChips({ disabled, onSelect }: AdminSupportCannedChipsProps) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer select-none text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300">
        Hazır cevaplar
      </summary>
      <div
        className="admin-support-canned-scroll mt-1.5 flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Hazır cevap şablonları"
      >
        {CANNED_REPLY_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            title={preset}
            onClick={() => onSelect(preset)}
            className="shrink-0 whitespace-nowrap rounded-full border border-cyan-400/22 bg-cyan-500/[0.08] px-2.5 py-1 text-[10px] font-semibold text-cyan-100/90 transition hover:border-cyan-400/40 hover:bg-cyan-500/[0.14] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {preset}
          </button>
        ))}
      </div>
    </details>
  );
}
