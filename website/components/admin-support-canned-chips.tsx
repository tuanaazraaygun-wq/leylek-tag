"use client";

import { CANNED_REPLY_PRESETS } from "@/lib/support-desk-config";

type AdminSupportCannedChipsProps = {
  disabled?: boolean;
  onSelect: (text: string) => void;
};

export function AdminSupportCannedChips({ disabled, onSelect }: AdminSupportCannedChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CANNED_REPLY_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          disabled={disabled}
          title={preset}
          onClick={() => onSelect(preset)}
          className="max-w-full truncate rounded-full border border-cyan-400/22 bg-cyan-500/[0.08] px-2.5 py-1 text-[10px] font-semibold text-cyan-100/90 transition hover:border-cyan-400/40 hover:bg-cyan-500/[0.14] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {preset.length > 36 ? `${preset.slice(0, 34)}…` : preset}
        </button>
      ))}
    </div>
  );
}
