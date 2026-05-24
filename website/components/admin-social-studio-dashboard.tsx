"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  ADMIN_SUPPORT_ROUTE_PATH,
  getSocialStudioMagicLinkRedirectTo,
  KYC_ADMIN_ROUTE_PATH,
  NOTIFICATION_CENTER_ROUTE_PATH,
  OPS_HUB_ROUTE_PATH,
} from "@/lib/site-origin";
import {
  buildSocialContent,
  formatSocialCopyBundle,
  SOCIAL_CITIES,
  SOCIAL_CITY_LABELS,
  SOCIAL_CONTENT_TYPES,
  SOCIAL_CONTENT_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  SOCIAL_RISK_COPY_NOTES,
  SOCIAL_TONE_LABELS,
  SOCIAL_TONES,
  type SocialCity,
  type SocialContentType,
  type SocialPlatform,
  type SocialTone,
} from "@/lib/social-content-templates";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

async function reconcileSocialStudioSession(
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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-slate-950">
            {labels[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}

function CopyButton({ label, text, onCopied }: { label: string; text: string; onCopied: (ok: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => void copyText(text).then(onCopied)}
      className="inline-flex min-h-[36px] items-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-100 hover:border-cyan-400/40"
    >
      {label}
    </button>
  );
}

export function AdminSocialStudioDashboard() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = configured ? getSupabaseBrowserClient() : null;

  const [busy, setBusy] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [contentType, setContentType] = useState<SocialContentType>("post");
  const [city, setCity] = useState<SocialCity>("genel");
  const [tone, setTone] = useState<SocialTone>("kurumsal");
  const [variationIndex, setVariationIndex] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return undefined;
    void reconcileSocialStudioSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileSocialStudioSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
    });

    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!copyFeedback) return undefined;
    const id = window.setTimeout(() => setCopyFeedback(null), 2500);
    return () => window.clearTimeout(id);
  }, [copyFeedback]);

  const onPlatformChange = useCallback((v: SocialPlatform) => {
    setPlatform(v);
    setVariationIndex(0);
  }, []);

  const onContentTypeChange = useCallback((v: SocialContentType) => {
    setContentType(v);
    setVariationIndex(0);
  }, []);

  const onCityChange = useCallback((v: SocialCity) => {
    setCity(v);
    setVariationIndex(0);
  }, []);

  const onToneChange = useCallback((v: SocialTone) => {
    setTone(v);
    setVariationIndex(0);
  }, []);

  const content = useMemo(
    () => buildSocialContent(platform, contentType, city, tone, variationIndex),
    [platform, contentType, city, tone, variationIndex],
  );

  const fullBundle = useMemo(() => formatSocialCopyBundle(content), [content]);
  const hashtagLine = content.hashtags.join(" ");

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
        const redirectTo = getSocialStudioMagicLinkRedirectTo();
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
      const redirectTo = getSocialStudioMagicLinkRedirectTo();
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) setFormError(error.message);
    },
    [client],
  );

  const onCopied = useCallback((ok: boolean) => {
    setCopyFeedback(ok ? "Panoya kopyalandı." : "Kopyalama başarısız.");
  }, []);

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
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">Sosyal medya studio</p>
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
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/78">Admin · Sosyal</p>
          <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">Sosyal Medya Studio</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
            Taslak-only · Otomatik paylaşım yok · Instagram API kullanılmaz · Kopyala ve manuel paylaş
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={OPS_HUB_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35">
            Operasyon Merkezi
          </Link>
          <Link href={ADMIN_SUPPORT_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35">
            Destek
          </Link>
          <Link href={KYC_ADMIN_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35">
            KYC
          </Link>
          <Link href={NOTIFICATION_CENTER_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35">
            Bildirimler
          </Link>
          <button type="button" onClick={() => void signOut()} className="inline-flex min-h-[40px] items-center rounded-xl border border-rose-500/35 px-3 py-2 text-xs font-bold text-rose-100/95">
            Çıkış
          </button>
        </div>
      </header>

      <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-cyan-100/95" role="status">
        <strong className="font-bold">Faz 1 · Taslak-only.</strong> Statik şablonlar; harici AI/LLM ve sosyal platform API&apos;si yok.
        İçeriği panoya kopyalayıp kendi hesabınızdan manuel paylaşın.
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SelectField id="platform" label="Platform" value={platform} options={SOCIAL_PLATFORMS} labels={SOCIAL_PLATFORM_LABELS} onChange={onPlatformChange} />
        <SelectField id="content-type" label="İçerik türü" value={contentType} options={SOCIAL_CONTENT_TYPES} labels={SOCIAL_CONTENT_TYPE_LABELS} onChange={onContentTypeChange} />
        <SelectField id="city" label="Şehir" value={city} options={SOCIAL_CITIES} labels={SOCIAL_CITY_LABELS} onChange={onCityChange} />
        <SelectField id="tone" label="Ton" value={tone} options={SOCIAL_TONES} labels={SOCIAL_TONE_LABELS} onChange={onToneChange} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setVariationIndex((v) => v + 1)}
          className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-bold text-white hover:border-cyan-400/30"
        >
          Yeni varyasyon
        </button>
        <span className="text-[10px] text-slate-500">Varyasyon: {content.variationLabel}</span>
        {copyFeedback ? <span className="text-[10px] font-semibold text-emerald-300">{copyFeedback}</span> : null}
      </div>

      <p className="mt-4 text-[10px] text-slate-500">{content.platformNote}</p>

      <div className="mt-6 space-y-4">
        <article className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Caption</h2>
            <CopyButton label="Caption kopyala" text={content.caption} onCopied={onCopied} />
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{content.caption}</p>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Hashtag önerileri</h2>
            <CopyButton label="Hashtag kopyala" text={hashtagLine} onCopied={onCopied} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-cyan-100/90">{hashtagLine}</p>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Story / kısa metin</h2>
            <CopyButton label="Story kopyala" text={content.storyText} onCopied={onCopied} />
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{content.storyText}</p>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">CTA önerisi</h2>
            <CopyButton label="CTA kopyala" text={content.cta} onCopied={onCopied} />
          </div>
          <p className="mt-3 text-sm text-slate-200">{content.cta}</p>
        </article>

        <div className="flex flex-wrap gap-2">
          <CopyButton label="Tümünü kopyala" text={fullBundle} onCopied={onCopied} />
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200/90">Güvenli copy notları</h2>
        <ul className="mt-3 space-y-2">
          {SOCIAL_RISK_COPY_NOTES.map((note) => (
            <li key={note} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
