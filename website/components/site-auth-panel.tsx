"use client";

import { useEffect, type ReactNode } from "react";
import { useSiteAuth } from "@/components/site-auth-provider";

function GoogleOAuthGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleOAuthGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C4.79 15.25 3.87 8.65 7.22 5.92c.86-.69 2.04-1.09 3.14-1.03 1.17.07 2.01.6 3.06.6 1.01 0 1.64-.48 3.14-.55 1.34-.06 2.46.58 3.16 1.48-2.78 1.62-2.32 5.86.97 7.05-.65 1.58-1.51 3.14-2.64 4.35ZM12.03 5.5c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

function LoginTriggerIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 12H21m0 0-3-3m3 3-3 3"
      />
    </svg>
  );
}

function AuthProviderButton({
  label,
  onClick,
  disabled,
  busy,
  busyLabel,
  icon,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  busyLabel: string;
  icon: ReactNode;
  variant?: "default" | "apple";
}) {
  const isApple = variant === "apple";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy}
      onClick={onClick}
      className={`flex min-h-[52px] w-full min-w-0 touch-manipulation items-center justify-center gap-3 rounded-xl border px-4 text-[14px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition disabled:cursor-not-allowed disabled:opacity-50 ${
        isApple
          ? "border-white/[0.14] bg-white/[0.92] text-slate-950 hover:border-white/25 hover:bg-white"
          : "border-white/[0.12] bg-white/[0.06] text-white hover:border-white/[0.18] hover:bg-white/[0.09]"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{busy ? busyLabel : label}</span>
    </button>
  );
}

type SiteAuthPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function SiteAuthPanel({ open, onClose }: SiteAuthPanelProps) {
  const { oauthBusy, signInWithGoogle, signInWithApple } = useSiteAuth();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-black/55 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-auth-panel-title"
        className="relative flex w-full max-w-[min(26rem,calc(100vw-2rem))] max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.1] bg-[#0a1424]/[0.98] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(103,232,249,0.08)] backdrop-blur-xl"
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-500/[0.12] to-transparent"
          aria-hidden
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white"
          aria-label="Kapat"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>

        <div className="relative min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/75">hesap</p>
          <h2 id="site-auth-panel-title" className="mt-2 pr-8 text-xl font-black tracking-tight text-white sm:text-[1.35rem]">
            Leylek TAG&apos;e giriş yap
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Hesabınıza güvenli şekilde devam edin.</p>

          <div className="mt-6 space-y-3">
            <AuthProviderButton
              label="Google ile giriş yap"
              busyLabel="Yönlendiriliyor…"
              disabled={oauthBusy}
              busy={oauthBusy}
              onClick={() => void signInWithGoogle()}
              icon={<GoogleOAuthGlyph className="h-5 w-5" />}
            />
            <AuthProviderButton
              variant="apple"
              label="Apple ile giriş yap"
              busyLabel="Yönlendiriliyor…"
              disabled={oauthBusy}
              busy={oauthBusy}
              onClick={() => void signInWithApple()}
              icon={<AppleOAuthGlyph className="h-5 w-5 text-slate-950" />}
            />
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
            Giriş işlemleri güvenli kimlik sağlayıcıları üzerinden tamamlanır.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SiteAuthLoginTrigger({
  className = "",
  onClick,
  disabled,
  busy,
  compact = false,
}: {
  className?: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      aria-haspopup="dialog"
      className={`group relative flex shrink-0 touch-manipulation items-center justify-center gap-1.5 overflow-hidden rounded-full border border-white/[0.11] bg-white/[0.04] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md transition hover:border-cyan-400/25 hover:bg-white/[0.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${compact ? "h-10 min-h-[40px] px-3" : "h-11 min-h-[44px] px-3.5"} ${className}`}
    >
      <LoginTriggerIcon className="h-4 w-4 shrink-0 text-cyan-200/90" />
      <span className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-white">Giriş</span>
      {busy ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
        />
      ) : null}
    </button>
  );
}
