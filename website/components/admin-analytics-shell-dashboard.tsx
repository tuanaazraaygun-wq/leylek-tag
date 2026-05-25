"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  ADMIN_SUPPORT_ROUTE_PATH,
  getAnalyticsCenterMagicLinkRedirectTo,
  GROWTH_CENTER_ROUTE_PATH,
  KYC_ADMIN_ROUTE_PATH,
  NOTIFICATION_CENTER_ROUTE_PATH,
  OPERATIONS_MAP_ROUTE_PATH,
  OPS_HUB_ROUTE_PATH,
  SOCIAL_STUDIO_ROUTE_PATH,
} from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

const DEMO_KPIS = [
  { id: "city-vitality", label: "Şehir canlılık skoru", value: "72", suffix: "/100", note: "Demo · anonim şehir ortalaması" },
  { id: "demand", label: "Demo talep skoru", value: "68", suffix: "/100", note: "Operasyon Haritası simülasyonu" },
  { id: "driver-balance", label: "Demo sürücü dengesi", value: "74", suffix: "/100", note: "Gerçek kullanıcı verisi değildir" },
  { id: "draft-notifications", label: "Taslak bildirim sayısı", value: "12", suffix: "", note: "Bildirim Merkezi demo taslakları" },
  { id: "social-prep", label: "Sosyal içerik hazırlığı", value: "85", suffix: "/100", note: "Social Studio şablon hazırlığı" },
] as const;

const MODULE_HEALTH = [
  { id: "support", label: "Destek", status: "Canlı", tone: "live" as const },
  { id: "kyc", label: "KYC", status: "Canlı", tone: "live" as const },
  { id: "notifications", label: "Bildirim", status: "Faz 1B", tone: "beta" as const },
  { id: "social", label: "Social Studio", status: "Faz 1", tone: "beta" as const },
  { id: "growth", label: "Growth Center", status: "Faz 1", tone: "beta" as const },
  { id: "map", label: "Operasyon Haritası", status: "Faz 0", tone: "beta" as const },
] as const;

const FAZ2_ROADMAP = [
  "Read-only gerçek operasyon metrikleri (Supabase aggregate, PII yok).",
  "Şehir bazlı trend grafikleri — yalnızca anonim özet.",
  "Bildirim ve growth funnel demo → gerçek sayım geçişi.",
] as const;

const QUICK_LINKS = [
  { label: "Operasyon Haritası", href: OPERATIONS_MAP_ROUTE_PATH },
  { label: "Bildirim Merkezi", href: NOTIFICATION_CENTER_ROUTE_PATH },
  { label: "Social Studio", href: SOCIAL_STUDIO_ROUTE_PATH },
  { label: "Growth Center", href: GROWTH_CENTER_ROUTE_PATH },
  { label: "Operasyon Merkezi", href: OPS_HUB_ROUTE_PATH },
] as const;

function ModuleHealthBadge({ tone }: { tone: "live" | "beta" }) {
  const live = tone === "live";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
        live
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-cyan-400/28 bg-cyan-500/10 text-cyan-100"
      }`}
    >
      {live ? "● Canlı" : "◐ Beta"}
    </span>
  );
}

async function reconcileAnalyticsSession(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  setSession: (s: Session | null) => void,
  setIsAdmin: (v: boolean) => void,
  setBusy: (v: boolean) => void,
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user.email) {
      setSession(null);
      setIsAdmin(false);
      return;
    }
    const ok = await isEmailListedKycAdmin(supabase, session.user.email);
    setSession(session);
    setIsAdmin(ok);
  } catch {
    setSession(null);
    setIsAdmin(false);
  } finally {
    setBusy(false);
  }
}

export function AdminAnalyticsShellDashboard() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = configured ? getSupabaseBrowserClient() : null;

  const [busy, setBusy] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return undefined;
    void reconcileAnalyticsSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileAnalyticsSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
    });

    return () => subscription.unsubscribe();
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }, [client]);

  const sendMagicLink = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!client) return;
      const email = emailInput.trim();
      if (!email) {
        setFormError("E-posta gerekli.");
        return;
      }
      setOtpSending(true);
      setFormError(null);
      try {
        const redirectTo = getAnalyticsCenterMagicLinkRedirectTo();
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) {
          setFormError(error.message);
          return;
        }
        setOtpSent(true);
      } catch {
        setFormError("Bağlantı gönderilemedi.");
      } finally {
        setOtpSending(false);
      }
    },
    [client, emailInput],
  );

  const signInWithOAuth = useCallback(
    async (provider: "google" | "apple") => {
      if (!client) return;
      setFormError(null);
      const redirectTo = getAnalyticsCenterMagicLinkRedirectTo();
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) setFormError(error.message);
    },
    [client],
  );

  if (!configured || !client) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-black text-white">Yapılandırma eksik</h1>
        <p className="mt-3 text-sm text-slate-400">Supabase ortam değişkenleri tanımlı değil.</p>
      </section>
    );
  }

  if (busy) {
    return (
      <section className="mx-auto flex min-h-[48vh] max-w-xl items-center justify-center px-4 py-20">
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      </section>
    );
  }

  if (!session?.user.email) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-white/[0.09] bg-slate-950/[0.94] p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-200/75">Analytics Center</p>
          <h1 className="mt-3 text-xl font-black text-white">Yetkili giriş</h1>
          <p className="mt-2 text-sm text-slate-400">Destek ve KYC panelleri ile aynı admin hesabı.</p>
          {formError ? (
            <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-100" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void signInWithOAuth("google")}
            className="mt-6 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] py-3 text-sm font-semibold text-white hover:border-indigo-400/30"
          >
            Google ile giriş
          </button>
          <button
            type="button"
            onClick={() => void signInWithOAuth("apple")}
            className="mt-2 w-full rounded-xl border border-white/[0.12] bg-black/50 py-3 text-sm font-semibold text-white"
          >
            Apple ile giriş
          </button>
          <form className="mt-6 grid gap-3" onSubmit={sendMagicLink}>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="yetkili@e-posta.com"
              className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/35"
              disabled={otpSending}
            />
            <button
              type="submit"
              disabled={otpSending}
              className="rounded-xl bg-indigo-500/20 py-2.5 text-sm font-bold text-indigo-100 ring-1 ring-indigo-400/30 disabled:opacity-50"
            >
              {otpSending ? "Gönderiliyor…" : "E-posta bağlantısı gönder"}
            </button>
            {otpSent ? <p className="text-xs text-indigo-200/90">Giriş bağlantısı e-postanıza gönderildi.</p> : null}
          </form>
          <Link href={OPS_HUB_ROUTE_PATH} className="mt-6 block text-center text-xs text-slate-500 hover:text-slate-300">
            Operasyon merkezine dön
          </Link>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-amber-500/28 bg-slate-950 p-8 text-center">
          <h1 className="text-xl font-black text-white">Yetkisiz</h1>
          <p className="mt-3 text-sm text-slate-400">E-postanız admin listesinde değil.</p>
          <button type="button" onClick={() => void signOut()} className="mt-8 w-full rounded-xl border border-white/[0.12] py-3 text-sm font-semibold text-cyan-100">
            Çıkış yap
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[70vh] max-w-[min(56rem,calc(100vw-1.25rem))] px-3 pb-24 pt-8 sm:px-4 md:pt-12">
      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300/78">Admin · Analytics</p>
          <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">LeylekTAG Analytics Center</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
            Operasyon, growth ve bildirim metrikleri için hazırlık ekranı. Faz 1B · Demo analytics — gerçek veri bağlantısı yok.
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={OPS_HUB_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35">
            Operasyon Merkezi
          </Link>
          <button type="button" onClick={() => void signOut()} className="inline-flex min-h-[40px] items-center rounded-xl border border-rose-500/35 px-3 py-2 text-xs font-bold text-rose-100/95">
            Çıkış
          </button>
        </div>
      </header>

      <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-amber-100/95" role="status">
        <strong className="font-bold">Henüz gerçek veri bağlı değil.</strong> Tüm metrikler demo/statik hazırlık değerleridir. API çağrısı,
        mutation ve otomatik aksiyon yoktur.
      </div>

      <section className="mt-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Demo KPI özeti</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_KPIS.map((kpi) => (
            <article key={kpi.id} className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{kpi.label}</p>
              <p className="mt-2 text-2xl font-black text-white">
                {kpi.value}
                {kpi.suffix ? <span className="text-sm font-bold text-slate-500">{kpi.suffix}</span> : null}
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{kpi.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Modül sağlığı</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_HEALTH.map((module) => (
            <article key={module.id} className="rounded-xl border border-white/[0.08] bg-black/25 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-white">{module.label}</p>
                <ModuleHealthBadge tone={module.tone} />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{module.status}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-violet-400/20 bg-violet-500/[0.05] p-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-200/90">Faz 2 · read-only gerçek metrikler</h2>
        <ul className="mt-3 space-y-2">
          {FAZ2_ROADMAP.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">İlgili modüller</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-[36px] items-center rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-cyan-400/30 hover:text-cyan-100"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={ADMIN_SUPPORT_ROUTE_PATH}
            className="inline-flex min-h-[36px] items-center rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-white/20"
          >
            Destek paneli
          </Link>
          <Link
            href={KYC_ADMIN_ROUTE_PATH}
            className="inline-flex min-h-[36px] items-center rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-white/20"
          >
            KYC İnceleme
          </Link>
        </div>
      </section>
    </section>
  );
}
