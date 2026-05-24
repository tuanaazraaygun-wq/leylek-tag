"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  audienceLabel,
  isBulkNotificationAudience,
  NOTIFICATION_AUDIENCE_LABELS,
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationDraft,
} from "@/lib/admin-notification-draft-types";
import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  ADMIN_SUPPORT_ROUTE_PATH,
  getNotificationCenterMagicLinkRedirectTo,
  KYC_ADMIN_ROUTE_PATH,
} from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

const CHANNEL_OPTIONS: { id: NotificationChannel; label: string; disabled?: boolean; hint?: string }[] = [
  { id: "push", label: "Push" },
  { id: "sms", label: "SMS", disabled: true, hint: "Yakında" },
  { id: "whatsapp", label: "WhatsApp", disabled: true, hint: "Yakında" },
];

async function reconcileNotificationAdminSession(
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

function newDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}`;
}

function PreviewPhoneCard({ title, body }: { title: string; body: string }) {
  const displayTitle = title.trim() || "Bildirim başlığı";
  const displayBody = body.trim() || "Mesaj önizlemesi burada görünür.";

  return (
    <div className="mx-auto w-full max-w-[17rem]">
      <div className="rounded-[1.75rem] border border-white/[0.12] bg-slate-950 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04]">
        <div className="rounded-[1.35rem] border border-white/[0.06] bg-black/60 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Leylek TAG</p>
          <p className="mt-2 text-[13px] font-bold leading-snug text-white">{displayTitle}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">{displayBody}</p>
          <p className="mt-3 text-[9px] text-slate-600">Şimdi · Push (taslak)</p>
        </div>
      </div>
    </div>
  );
}

type ConfirmModalProps = {
  open: boolean;
  audience: NotificationAudience;
  title: string;
  body: string;
  kvkkAck: boolean;
  onKvkkChange: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function DraftConfirmModal({
  open,
  audience,
  title,
  body,
  kvkkAck,
  onKvkkChange,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  const bulk = isBulkNotificationAudience(audience);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-slate-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="draft-confirm-title" className="text-sm font-bold text-white">
          {bulk ? "Toplu taslak onayı" : "Taslak onayı"}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {bulk
            ? "Bu taslak geniş bir kitleyi hedefler. Gerçek gönderim henüz aktif değil; yalnızca taslak kaydedilir."
            : "Taslak yerel olarak kaydedilecek. Gerçek gönderim yapılmaz."}
        </p>
        <dl className="mt-4 space-y-2 rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5 text-[11px]">
          <div>
            <dt className="font-semibold text-slate-500">Hedef</dt>
            <dd className="mt-0.5 text-slate-200">{audienceLabel(audience)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Başlık</dt>
            <dd className="mt-0.5 text-slate-200">{title.trim()}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Mesaj</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-slate-300">{body.trim()}</dd>
          </div>
        </dl>
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-slate-400">
          <input
            type="checkbox"
            checked={kvkkAck}
            onChange={(e) => onKvkkChange(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-black/40 accent-cyan-400"
          />
          <span>
            Mesajın mevzuata uygun olduğunu, gereksiz kişisel veri içermediğini ve yalnızca yetkili admin
            tarafından kullanılacağını onaylıyorum.
          </span>
        </label>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] rounded-xl border border-white/[0.12] px-4 py-2 text-xs font-bold text-slate-300 hover:border-white/20"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={!kvkkAck}
            onClick={onConfirm}
            className="min-h-[40px] rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-100 ring-1 ring-cyan-400/30 disabled:pointer-events-none disabled:opacity-45"
          >
            Taslak olarak kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminNotificationCenterDashboard() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = configured ? getSupabaseBrowserClient() : null;

  const [busy, setBusy] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [audience, setAudience] = useState<NotificationAudience>("all_users");
  const [channel] = useState<NotificationChannel>("push");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [specificTarget, setSpecificTarget] = useState("");
  const [draftSuccess, setDraftSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<NotificationDraft[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKvkk, setConfirmKvkk] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return undefined;
    void reconcileNotificationAdminSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileNotificationAdminSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
    });

    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!draftSuccess) return undefined;
    const id = window.setTimeout(() => setDraftSuccess(null), 6000);
    return () => window.clearTimeout(id);
  }, [draftSuccess]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setDrafts([]);
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
        const redirectTo = getNotificationCenterMagicLinkRedirectTo();
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
      const redirectTo = getNotificationCenterMagicLinkRedirectTo();
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) setFormError(error.message);
    },
    [client],
  );

  const validateForm = useCallback((): string | null => {
    const t = title.trim();
    const b = body.trim();
    if (!t) return "Bildirim başlığı gerekli.";
    if (t.length > NOTIFICATION_TITLE_MAX) return `Başlık en fazla ${NOTIFICATION_TITLE_MAX} karakter olabilir.`;
    if (!b) return "Bildirim mesajı gerekli.";
    if (b.length > NOTIFICATION_BODY_MAX) return `Mesaj en fazla ${NOTIFICATION_BODY_MAX} karakter olabilir.`;
    if (audience === "specific_user" && !specificTarget.trim()) {
      return "Belirli kullanıcı hedefi için telefon, e-posta veya kullanıcı kimliği girin.";
    }
    return null;
  }, [audience, body, specificTarget, title]);

  const saveDraft = useCallback(() => {
    if (!session?.user.email) return;
    const err = validateForm();
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);

    const draft: NotificationDraft = {
      id: newDraftId(),
      audience,
      channel,
      title: title.trim(),
      body: body.trim(),
      specificTarget: audience === "specific_user" ? specificTarget.trim() : null,
      createdAt: new Date().toISOString(),
      createdByEmail: session.user.email,
    };

    setDrafts((prev) => [draft, ...prev].slice(0, 20));
    setDraftSuccess("Taslak kaydedildi. Gerçek gönderim henüz aktif değil.");
    setConfirmOpen(false);
    setConfirmKvkk(false);
  }, [audience, body, channel, session, specificTarget, title, validateForm]);

  const handleDraftClick = useCallback(() => {
    const err = validateForm();
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    setConfirmKvkk(false);
    setConfirmOpen(true);
  }, [validateForm]);

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
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">Bildirim merkezi</p>
          <h1 className="mt-3 text-xl font-black text-white">Yetkili giriş</h1>
          <p className="mt-2 text-sm text-slate-400">Destek ve KYC paneli ile aynı admin hesabı kullanılır.</p>
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
            {otpSent ? (
              <p className="text-xs text-cyan-200/90">Giriş bağlantısı e-postanıza gönderildi.</p>
            ) : null}
          </form>
          <Link href={ADMIN_SUPPORT_ROUTE_PATH} className="mt-6 block text-center text-xs text-slate-500 hover:text-slate-300">
            Destek paneline dön
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
    <section className="mx-auto min-h-[70vh] max-w-[min(92rem,calc(100vw-1.25rem))] px-3 pb-24 pt-8 sm:px-4 md:pt-12">
      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/78">Admin · Bildirim</p>
          <h1 className="mt-1.5 text-xl font-black text-white">Bildirim Merkezi</h1>
          <p className="mt-1.5 max-w-2xl text-xs text-slate-400">
            Taslak bildirim oluşturun. Gerçek gönderim backend entegrasyonu sonrası aktif olacak.
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={ADMIN_SUPPORT_ROUTE_PATH}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35"
          >
            Destek paneli
          </Link>
          <Link
            href={KYC_ADMIN_ROUTE_PATH}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35"
          >
            KYC İnceleme
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-rose-500/35 px-3 py-2 text-xs font-bold text-rose-100/95"
          >
            Çıkış
          </button>
        </div>
      </header>

      <div
        className="mt-5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-amber-100/95"
        role="status"
      >
        <strong className="font-bold">Taslak modu.</strong> Gerçek gönderim backend entegrasyonu sonrası aktif
        olacak. Bu aşamada hiçbir kullanıcıya push, SMS veya WhatsApp iletilmez.
      </div>

      {draftSuccess ? (
        <p
          className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-100"
          role="status"
        >
          {draftSuccess}
        </p>
      ) : null}

      {fieldError ? (
        <p className="mt-4 text-xs text-rose-300" role="alert">
          {fieldError}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4 ring-1 ring-white/[0.03]">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Kanal</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((opt) => {
                const active = channel === opt.id && !opt.disabled;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled}
                    title={opt.disabled ? opt.hint : undefined}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                      opt.disabled
                        ? "cursor-not-allowed border-white/[0.06] bg-black/20 text-slate-600"
                        : active
                          ? "border-cyan-400/45 bg-cyan-500/15 text-cyan-100"
                          : "border-white/[0.12] bg-black/30 text-slate-400"
                    }`}
                  >
                    {opt.label}
                    {opt.hint ? ` · ${opt.hint}` : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4 ring-1 ring-white/[0.03]">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Hedef kitle</h2>
            <fieldset className="mt-3 space-y-2">
              {NOTIFICATION_AUDIENCES.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5 text-[11px] text-slate-300 transition hover:border-white/[0.12]"
                >
                  <input
                    type="radio"
                    name="audience"
                    value={id}
                    checked={audience === id}
                    onChange={() => setAudience(id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-cyan-400"
                  />
                  <span>{NOTIFICATION_AUDIENCE_LABELS[id]}</span>
                </label>
              ))}
            </fieldset>
            {audience === "specific_user" ? (
              <input
                type="text"
                value={specificTarget}
                onChange={(e) => setSpecificTarget(e.target.value)}
                placeholder="Telefon, e-posta veya kullanıcı kimliği"
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35"
              />
            ) : null}
            <p className="mt-3 text-[10px] text-slate-500">
              Tahmini hedef: entegrasyon sonrası hesaplanacak
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4 ring-1 ring-white/[0.03]">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">İçerik</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="notif-title" className="text-[10px] font-semibold text-slate-500">
                  Bildirim başlığı
                </label>
                <input
                  id="notif-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, NOTIFICATION_TITLE_MAX))}
                  maxLength={NOTIFICATION_TITLE_MAX}
                  placeholder="Kısa başlık"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35"
                />
                <p className="mt-1 text-[9px] text-slate-600">
                  {title.length}/{NOTIFICATION_TITLE_MAX}
                </p>
              </div>
              <div>
                <label htmlFor="notif-body" className="text-[10px] font-semibold text-slate-500">
                  Bildirim mesajı
                </label>
                <textarea
                  id="notif-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, NOTIFICATION_BODY_MAX))}
                  maxLength={NOTIFICATION_BODY_MAX}
                  rows={5}
                  placeholder="Kullanıcıya iletilecek mesaj"
                  className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35"
                />
                <p className="mt-1 text-[9px] text-slate-600">
                  {body.length}/{NOTIFICATION_BODY_MAX}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-200/80">KVKK ve kullanım</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-relaxed text-slate-400">
              <li>Toplu bildirimler kişisel veri işlemi sayılabilir; yalnızca yetkili admin kullanmalıdır.</li>
              <li>Mesaj gövdesine gereksiz telefon, e-posta veya kimlik numarası yazmayın.</li>
              <li>Pazarlama içeriği için ayrı hukuki süreç gerekebilir.</li>
            </ul>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={handleDraftClick}
              className="min-h-[44px] rounded-xl bg-cyan-500/20 px-5 py-2.5 text-xs font-bold text-cyan-100 ring-1 ring-cyan-400/30 hover:bg-cyan-500/25"
            >
              Taslak oluştur
            </button>
            <button
              type="button"
              disabled
              title="Backend entegrasyonu tamamlanana kadar kapalı"
              className="min-h-[44px] cursor-not-allowed rounded-xl border border-white/[0.08] bg-black/30 px-5 py-2.5 text-xs font-bold text-slate-600 opacity-70"
            >
              Gönder (devre dışı)
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-white/[0.08] bg-slate-950/90 p-4 ring-1 ring-white/[0.03]">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Önizleme</h2>
            <p className="mt-1 text-[10px] text-slate-500">Push bildirimi cihazda kabaca böyle görünür.</p>
            <div className="mt-4">
              <PreviewPhoneCard title={title} body={body} />
            </div>
            <dl className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-[10px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Hedef</dt>
                <dd className="text-right text-slate-300">{audienceLabel(audience)}</dd>
              </div>
              {audience === "specific_user" && specificTarget.trim() ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Alıcı</dt>
                  <dd className="truncate text-right font-mono text-slate-300">{specificTarget.trim()}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {drafts.length > 0 ? (
            <section className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Son taslaklar (yerel)
              </h2>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {drafts.slice(0, 5).map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg border border-white/[0.06] bg-slate-950/80 px-2.5 py-2 text-[10px]"
                  >
                    <p className="font-semibold text-slate-200">{d.title}</p>
                    <p className="mt-0.5 text-slate-500">{audienceLabel(d.audience)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <DraftConfirmModal
        open={confirmOpen}
        audience={audience}
        title={title}
        body={body}
        kvkkAck={confirmKvkk}
        onKvkkChange={setConfirmKvkk}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmKvkk(false);
        }}
        onConfirm={saveDraft}
      />

      <p className="sr-only" aria-live="polite">
        {draftSuccess ?? ""}
      </p>
    </section>
  );
}
