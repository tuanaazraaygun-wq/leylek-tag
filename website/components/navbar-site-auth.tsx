"use client";

import { useEffect, useRef, useState } from "react";
import { SiteAuthLoginTrigger, SiteAuthPanel } from "@/components/site-auth-panel";
import { useSiteAuth } from "@/components/site-auth-provider";

/** Üst bar: giriş / hesap menüsü — tüm kırılımlarda görünür. */
export function NavbarSiteAuthTop() {
  const { authReady, configured, session, navLabel, oauthBusy, signOut } = useSiteAuth();
  const [panelOpen, setPanelOpen] = useState(false);
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
        className="h-11 min-w-[5.5rem] shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03]"
      />
    );
  }

  if (!session) {
    return (
      <>
        <SiteAuthLoginTrigger
          onClick={() => setPanelOpen(true)}
          disabled={oauthBusy}
          busy={oauthBusy}
        />
        <SiteAuthPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </>
    );
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 max-w-[148px] min-h-[44px] touch-manipulation items-center gap-1.5 overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.05] pl-3 pr-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition hover:border-white/[0.16] sm:max-w-[200px]"
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{navLabel}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform ${open ? "-rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+7px)] z-[60] w-[min(16.5rem,calc(100vw-4rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-slate-950/[0.97] p-1.5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl ring-1 ring-white/[0.06]"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              void signOut();
              setOpen(false);
            }}
            className="flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-lg border border-transparent px-3 text-[13px] font-semibold text-slate-200 transition hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white"
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
  const { authReady, configured, session, navLabel, oauthBusy, signOut } = useSiteAuth();
  const [panelOpen, setPanelOpen] = useState(false);

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
      <>
        <SiteAuthLoginTrigger
          className="w-full"
          onClick={() => {
            setPanelOpen(true);
            onNavigate?.();
          }}
          disabled={oauthBusy}
          busy={oauthBusy}
        />
        <SiteAuthPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Hesabın</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{navLabel}</p>
      <button
        type="button"
        className="mt-3 flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-200 transition hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white"
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
