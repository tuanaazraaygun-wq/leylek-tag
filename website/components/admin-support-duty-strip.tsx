"use client";

import {
  formatDutyPhoneReadable,
  maskDutyPhone,
  SUPPORT_DUTY_CONTACTS,
} from "@/lib/support-desk-config";

export function AdminSupportDutyStrip() {
  return (
    <div
      className="mt-3 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2"
      role="note"
      aria-label="Görevli hatları"
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Görevli hatları</p>
      <ul className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-4">
        {SUPPORT_DUTY_CONTACTS.map((c) => (
          <li key={c.phone} className="min-w-0 text-[11px] leading-snug text-slate-400">
            <span className="font-semibold text-slate-300">{c.label}</span>
            <span className="mx-1.5 text-slate-600" aria-hidden>
              ·
            </span>
            <span className="font-mono text-slate-400" title={formatDutyPhoneReadable(c.phone)}>
              {maskDutyPhone(c.phone)}
            </span>
            <span className="ml-1.5 hidden text-[10px] text-slate-600 sm:inline">
              ({c.tasks.join(", ")})
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[9px] text-slate-600">Operasyonel referans — panel girişi e-posta ile yapılır.</p>
    </div>
  );
}
