"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  ADMIN_SUPPORT_ROUTE_PATH,
  getGrowthCenterMagicLinkRedirectTo,
  KYC_ADMIN_ROUTE_PATH,
  NOTIFICATION_CENTER_ROUTE_PATH,
  OPS_HUB_ROUTE_PATH,
  SOCIAL_STUDIO_ROUTE_PATH,
} from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type StatusTone = "ready" | "pending" | "disconnected" | "planned";

type StatusCard = {
  id: string;
  label: string;
  status: string;
  tone: StatusTone;
};

const STATUS_CARDS: StatusCard[] = [
  { id: "social-studio", label: "Social Studio", status: "Hazır", tone: "ready" },
  { id: "meta-app", label: "Meta App", status: "Hazırlanacak", tone: "pending" },
  { id: "instagram-account", label: "Instagram hesabı", status: "Bağlı değil", tone: "disconnected" },
  { id: "insights", label: "Insights", status: "Faz 2", tone: "planned" },
  { id: "comments", label: "Yorum / Mention", status: "Faz 3", tone: "planned" },
  { id: "publish", label: "Yayınlama", status: "Faz 4", tone: "planned" },
  { id: "dm", label: "DM", status: "Faz 5", tone: "planned" },
];

const META_DEVELOPER_CHECKLIST = [
  "Meta Developer App oluştur (Business tipi).",
  "Instagram Professional Account (Business veya Creator) hazırla.",
  "Facebook Page bağlantısını doğrula; IG hesabını Page'e bağla.",
  "OAuth redirect URL planla: /support/growth (Supabase allowlist'e ekle).",
  "App Review gereken scope'ları not et: insights, comments, publish, messaging.",
] as const;

const SECURITY_GUARDRAILS = [
  "Private API yok — yalnızca resmi Meta / Instagram Graph API planlanır.",
  "Scraping yok.",
  "Otomatik takip / beğeni yok.",
  "Spam DM yok.",
  "Token frontend'de saklanmaz; service token'lar server-side olacak.",
  "Publish ve admin reply her zaman onaylı olacak.",
] as const;

function StatusBadge({ tone }: { tone: StatusTone }) {
  const styles: Record<StatusTone, string> = {
    ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    disconnected: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    planned: "border-cyan-400/28 bg-cyan-500/10 text-cyan-100",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${styles[tone]}`}>
      {tone === "ready" ? "●" : tone === "pending" ? "◐" : tone === "disconnected" ? "○" : "◇"}
    </span>
  );
}

async function reconcileGrowthCenterSession(
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

export function AdminGrowthCenterDashboard() {
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
    void reconcileGrowthCenterSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileGrowthCenterSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
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
        const redirectTo = getGrowthCenterMagicLinkRedirectTo();
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
      const redirectTo = getGrowthCenterMagicLinkRedirectTo();
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
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">Growth center</p>
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
            {otpSent ? <p className="text-xs text-cyan-200/90">Giriş bağlantısı e-postanıza gönderildi.</p> : null}
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
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/78">Admin · Growth</p>
          <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">LeylekTAG Growth Center</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
            Instagram API entegrasyonu için hazırlık merkezi. Faz 1 · Config shell — API çağrısı yok, token yok, mutation yok.
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

      <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-cyan-100/95" role="status">
        <strong className="font-bold">Faz 1 · Config shell.</strong> Instagram Graph API, webhook ve token entegrasyonu henüz yok.
        Bu ekran yalnızca hazırlık durumu ve güvenlik guardrail&apos;lerini gösterir.
      </div>

      <section className="mt-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Modül durumu</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STATUS_CARDS.map((card) => (
            <div key={card.id} className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-white">{card.label}</p>
                <StatusBadge tone={card.tone} />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{card.status}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.08] bg-black/25 p-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Meta Developer checklist</h2>
          <ul className="mt-3 space-y-2">
            {META_DEVELOPER_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full border border-cyan-400/40 bg-cyan-500/20" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-slate-500">
            Supabase redirect allowlist: <span className="font-mono text-slate-400">/support/growth</span> (prod + localhost).
          </p>
        </section>

        <section className="rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200/90">Güvenlik guardrail&apos;leri</h2>
          <ul className="mt-3 space-y-2">
            {SECURITY_GUARDRAILS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">İlgili modüller</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={SOCIAL_STUDIO_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-bold text-cyan-100 hover:border-cyan-400/35">
            Sosyal Medya Studio →
          </Link>
          <Link href={NOTIFICATION_CENTER_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-bold text-cyan-100 hover:border-cyan-400/35">
            Bildirim Merkezi →
          </Link>
          <Link href={OPS_HUB_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-bold text-cyan-100 hover:border-cyan-400/35">
            Operasyon Merkezi →
          </Link>
          <Link href={ADMIN_SUPPORT_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-4 py-2 text-xs font-bold text-slate-300 hover:border-white/20">
            Destek paneli
          </Link>
          <Link href={KYC_ADMIN_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-4 py-2 text-xs font-bold text-slate-300 hover:border-white/20">
            KYC İnceleme
          </Link>
        </div>
      </section>
    </section>
  );
}
