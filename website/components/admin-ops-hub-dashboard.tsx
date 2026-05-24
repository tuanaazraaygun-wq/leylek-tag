"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  ADMIN_SUPPORT_ROUTE_PATH,
  getOpsHubMagicLinkRedirectTo,
  KYC_ADMIN_ROUTE_PATH,
  NOTIFICATION_CENTER_ROUTE_PATH,
  SOCIAL_STUDIO_ROUTE_PATH,
} from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type ModuleCard = {
  id: string;
  title: string;
  href: string;
  description: string;
  statusLabel: string;
  statusTone: "live" | "beta";
};

const MODULE_CARDS: ModuleCard[] = [
  {
    id: "support",
    title: "Canlı Destek",
    href: ADMIN_SUPPORT_ROUTE_PATH,
    description: "Destek talepleri, canlı sohbet, ticket atama ve çözümleme.",
    statusLabel: "Canlı",
    statusTone: "live",
  },
  {
    id: "kyc",
    title: "KYC İnceleme",
    href: KYC_ADMIN_ROUTE_PATH,
    description: "Sürücü başvuruları, belge inceleme, onay / red / eksik belge.",
    statusLabel: "Canlı",
    statusTone: "live",
  },
  {
    id: "notifications",
    title: "Bildirim Merkezi",
    href: NOTIFICATION_CENTER_ROUTE_PATH,
    description: "Push bildirim — belirli kullanıcı ve toplu hedefler (Faz 1B).",
    statusLabel: "Faz 1B",
    statusTone: "beta",
  },
  {
    id: "social",
    title: "Sosyal Medya Studio",
    href: SOCIAL_STUDIO_ROUTE_PATH,
    description: "Instagram/TikTok/X için güvenli içerik taslakları.",
    statusLabel: "Faz 1",
    statusTone: "beta",
  },
];

const LIVE_MODULES = [
  "Canlı destek masası (/support/admin)",
  "KYC inceleme ve karar (/support/kyc)",
  "Push bildirim — belirli kullanıcı + toplu segmentler (/support/notifications)",
] as const;

const FAZ2_PLANNED = [
  "Bildirim KYC segmentleri (kyc_pending / kyc_approved)",
  "Operasyon analytics ve raporlama",
  "Referral ve kampanya yönetimi",
] as const;

async function reconcileOpsHubSession(
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

function StatusBadge({ label, tone }: { label: string; tone: ModuleCard["statusTone"] }) {
  const live = tone === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
        live
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-cyan-400/28 bg-cyan-500/10 text-cyan-100"
      }`}
    >
      {live ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/50 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
        </span>
      ) : null}
      {label}
    </span>
  );
}

export function AdminOpsHubDashboard() {
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
    void reconcileOpsHubSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileOpsHubSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
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
        const redirectTo = getOpsHubMagicLinkRedirectTo();
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
      const redirectTo = getOpsHubMagicLinkRedirectTo();
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
        <Link href="/" className="mt-8 inline-block text-sm text-cyan-300 hover:underline">
          Ana sayfa
        </Link>
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
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">Operasyon merkezi</p>
          <h1 className="mt-3 text-xl font-black text-white">Yetkili giriş</h1>
          <p className="mt-2 text-sm text-slate-400">Destek, KYC ve bildirim panelleri ile aynı admin hesabı.</p>
          {formError ? (
            <p
              className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-100"
              role="alert"
            >
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void signInWithOAuth("google")}
            className="mt-6 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] py-3 text-sm font-semibold text-white hover:border-cyan-400/30"
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
              className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35"
              disabled={otpSending}
            />
            <button
              type="submit"
              disabled={otpSending}
              className="rounded-xl bg-cyan-500/20 py-2.5 text-sm font-bold text-cyan-100 ring-1 ring-cyan-400/30 disabled:opacity-50"
            >
              {otpSending ? "Gönderiliyor…" : "E-posta bağlantısı gönder"}
            </button>
            {otpSent ? (
              <p className="text-xs text-cyan-200/90">Giriş bağlantısı e-postanıza gönderildi.</p>
            ) : null}
          </form>
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
          <p className="mt-4 break-all font-mono text-xs text-slate-500">{session.user.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-8 w-full rounded-xl border border-white/[0.12] py-3 text-sm font-semibold text-cyan-100"
          >
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
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/78">Admin · Operasyon</p>
          <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">LeylekTAG Operasyon Merkezi</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
            Canlı modüllere güvenli giriş. Bu sayfa yalnızca navigasyon sağlar; işlem yapılmaz.
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{session.user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-[40px] shrink-0 items-center self-start rounded-xl border border-rose-500/35 px-3 py-2 text-xs font-bold text-rose-100/95"
        >
          Çıkış
        </button>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_CARDS.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className="group flex flex-col rounded-xl border border-white/[0.08] bg-slate-950/90 p-4 ring-1 ring-white/[0.03] transition hover:border-cyan-400/30 hover:bg-slate-950"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-bold text-white group-hover:text-cyan-50">{card.title}</h2>
              <StatusBadge label={card.statusLabel} tone={card.statusTone} />
            </div>
            <p className="mt-2 flex-1 text-[11px] leading-relaxed text-slate-400">{card.description}</p>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300/80 group-hover:text-cyan-200">
              Modüle git →
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200/90">Canlı modüller</h2>
          <ul className="mt-3 space-y-2">
            {LIVE_MODULES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-white/[0.08] bg-black/25 p-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Faz 2 planlananlar</h2>
          <ul className="mt-3 space-y-2">
            {FAZ2_PLANNED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
