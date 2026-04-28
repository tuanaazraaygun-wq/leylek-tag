type StoreButtonProps = {
  label: string;
  eyebrow: string;
};

export function StoreButton({ label, eyebrow }: StoreButtonProps) {
  return (
    <button
      type="button"
      disabled
      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-left opacity-90 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition sm:w-auto"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M8 5.5H16C17.1 5.5 18 6.4 18 7.5V16.5C18 17.6 17.1 18.5 16 18.5H8C6.9 18.5 6 17.6 6 16.5V7.5C6 6.4 6.9 5.5 8 5.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M10 16H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">{eyebrow}</span>
        <span className="mt-1 block text-sm font-black text-white">{label}</span>
      </span>
    </button>
  );
}
