"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteAuth } from "@/components/site-auth-provider";

function GoogleNavbarGlyph({ className = "h-[18px] w-[18px]" }: { className?: string }) {
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

/** Üst bar: giriş / hesap menüsü — tüm kırılımlarda görünür. */
export function NavbarSiteAuthTop() {
  const { authReady, configured, session, navLabel, oauthBusy, signInWithGoogle, signOut } =
    useSiteAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!configured) return null;

  if (!authReady) {
    return (
      <div
        aria-busy="true"
        aria-label="Oturum yükleniyor"
        className="h-11 min-w-[7rem] shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.04]"
      />
    );
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={oauthBusy}
        aria-busy={oauthBusy}
        className="group relative flex h-11 min-h-[44px] shrink-0 touch-manipulation items-center gap-2 overflow-hidden rounded-xl border border-white/[0.11] bg-white/[0.045] px-2.5 shadow-[0_12px_40px_-20px_rgba(0,198,255,0.42)] ring-1 ring-white/[0.05] backdrop-blur-xl transition hover:border-cyan-400/25 hover:bg-white/[0.08] hover:ring-cyan-400/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
      >
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08)_0%,transparent_50%,rgba(34,211,238,0.05)_100%)] opacity-80 transition-opacity group-hover:opacity-100" />
        <GoogleNavbarGlyph className="relative z-[1] shrink-0" />
        <span className="relative z-[1] whitespace-nowrap text-[13px] font-bold tracking-tight text-white">
          <span className="sm:hidden">Giriş</span>
          <span className="hidden sm:inline">Giriş yap</span>
        </span>
        {oauthBusy ? (
          <span
            aria-hidden
            className="relative z-[1] h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-cyan-300"
          />
        ) : null}
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 max-w-[148px] min-h-[44px] touch-manipulation items-center gap-1.5 overflow-hidden rounded-xl border border-white/[0.11] bg-white/[0.06] pl-3 pr-2 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl transition hover:border-cyan-400/25 sm:max-w-[200px]"
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{navLabel}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          className={`shrink-0 text-cyan-200/85 transition-transform ${open ? "-rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+7px)] z-[60] w-[min(16.5rem,calc(100vw-4rem))] overflow-hidden rounded-xl border border-white/[0.12] bg-slate-950/96 p-1.5 shadow-[0_24px_72px_-32px_rgba(0,198,255,0.52)] backdrop-blur-2xl ring-1 ring-cyan-400/12"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              void signOut();
              setOpen(false);
            }}
            className="flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-lg border border-transparent px-3 text-[13px] font-semibold text-slate-200 transition hover:border-white/[0.1] hover:bg-white/[0.07] hover:text-white"
          >
            Çıkış yap
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Mobil drawer içi hesap alanı */
export function NavbarSiteAuthDrawer({ onNavigate }: { onNavigate?: () => void }) {
  const {
    authReady,
    configured,
    session,
    navLabel,
    oauthBusy,
    signInWithGoogle,
    signOut,
  } = useSiteAuth();

  if (!configured) return null;

  if (!authReady) {
    return (
      <div
        aria-busy="true"
        aria-label="Oturum yükleniyor"
        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3"
      >
        <div className="h-3.5 w-[60%] rounded-full bg-white/[0.08]" />
        <div className="mt-2 h-10 w-full rounded-lg bg-white/[0.06]" />
      </div>
    );
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={oauthBusy}
        className="group relative flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/[0.11] bg-white/[0.045] px-4 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08)] backdrop-blur-md transition hover:border-cyan-400/25 hover:bg-white/[0.07] disabled:opacity-45"
      >
        <GoogleNavbarGlyph className="h-5 w-5 shrink-0" />
        <span className="text-sm font-bold text-white">
          {oauthBusy ? "Yönlendiriliyor…" : "Google ile giriş yap"}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.09] bg-white/[0.05] px-4 py-3 backdrop-blur-sm">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Hesabın</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{navLabel}</p>
      <button
        type="button"
        className="mt-3 flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 text-[13px] font-semibold text-cyan-100 transition hover:border-cyan-400/35 hover:bg-white/[0.08]"
        onClick={() => {
          void signOut();
          onNavigate?.();
        }}
      >
        Çıkış yap
      </button>
    </div>
  );
}
