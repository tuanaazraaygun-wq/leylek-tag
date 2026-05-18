"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  userEmail?: string | null;
  submitting: boolean;
  formError: string | null;
  onSubmit: (fullName: string, city: string) => void;
};

/** İlk kayıt / eksik profil — vitrin onboarding (dark glass). */
export function UserOnboardingModal({ open, userEmail, submitting, formError, onSubmit }: Props) {
  const reactId = useId();
  const nameId = `${reactId}-name`;
  const cityId = `${reactId}-city`;
  const nameRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!open) return;
    const prev = typeof document !== "undefined" ? document.body.style.overflow : "";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110]" role="presentation">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:items-center">
        <div
          role="dialog"
          aria-modal
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-desc"
          className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[1.25rem] border border-white/[0.12] bg-slate-950/88 shadow-[0_28px_80px_-36px_rgba(0,198,255,0.52)] ring-1 ring-cyan-400/15 backdrop-blur-2xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.08)_0%,transparent_45%,rgba(34,211,238,0.06)_100%)] opacity-90" />

          <form
            className="relative z-[1] space-y-5 p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const n = fullName.trim();
              const c = city.trim();
              if (!n || !c) return;
              onSubmit(n, c);
            }}
          >
            <div className="space-y-1.5">
              <h2 id="onboarding-title" className="text-xl font-black tracking-tight text-white">
                Leylek TAG’e hoş geldin
              </h2>
              <p id="onboarding-desc" className="text-sm leading-relaxed text-slate-400">
                Sana daha doğru bir deneyim sunabilmemiz için birkaç bilgiyi tamamla.
              </p>
              {userEmail ? (
                <p className="truncate pt-2 font-mono text-[11px] text-slate-500">{userEmail}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor={nameId} className="block text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">
                  Ad soyad
                </label>
                <input
                  ref={nameRef}
                  id={nameId}
                  autoComplete="name"
                  name="fullName"
                  disabled={submitting}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-[15px] text-white shadow-inner outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400/45 focus:bg-white/[0.06]"
                  placeholder=""
                />
              </div>
              <div>
                <label htmlFor={cityId} className="block text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">
                  Şehir
                </label>
                <input
                  id={cityId}
                  autoComplete="address-level2"
                  name="city"
                  disabled={submitting}
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-[15px] text-white shadow-inner outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400/45 focus:bg-white/[0.06]"
                  placeholder=""
                />
              </div>
            </div>

            {formError ? (
              <p role="alert" className="text-sm font-medium leading-relaxed text-red-400/95">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !fullName.trim() || !city.trim()}
              className="group relative mt-2 flex min-h-[3rem] w-full touch-manipulation items-center justify-center overflow-hidden rounded-xl border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(0,198,255,0.35)_0%,rgba(0,114,255,0.2)_52%,rgba(108,99,255,0.28)_100%)] px-4 py-3 text-[15px] font-black text-white shadow-[0_16px_48px_-22px_rgba(0,198,255,0.45)] transition hover:border-cyan-300/55 hover:shadow-[0_22px_56px_-20px_rgba(34,211,238,0.35)] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:opacity-40 disabled:shadow-none"
            >
              <span className="pointer-events-none absolute inset-0 bg-white/[0.08] opacity-0 transition group-hover:opacity-100 group-disabled:opacity-0" />
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-[1.025rem] w-[1.025rem] animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Kaydediliyor…
                </span>
              ) : (
                "Kaydet ve devam et"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
