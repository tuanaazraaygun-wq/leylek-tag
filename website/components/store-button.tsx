type StoreButtonProps = {
  label: string;
  eyebrow: string;
  className?: string;
};

export function StoreButton({ label, eyebrow, className = "" }: StoreButtonProps) {
  return (
    <button
      type="button"
      disabled
      className={`flex w-full min-h-[56px] items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.09] px-5 py-4 text-left opacity-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-cyan-300/25 sm:min-w-[min(100%,320px)] ${className}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-300/18 text-cyan-100">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M8 5.5H16C17.1 5.5 18 6.4 18 7.5V16.5C18 17.6 17.1 18.5 16 18.5H8C6.9 18.5 6 17.6 6 16.5V7.5C6 6.4 6.9 5.5 8 5.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M10 16H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100/85">{eyebrow}</span>
        <span className="mt-1 block text-base font-black text-white">{label}</span>
      </span>
    </button>
  );
}
