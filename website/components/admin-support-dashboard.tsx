"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminSupportMagicLinkRedirectTo } from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";
import type { Session } from "@supabase/supabase-js";

const STATUSES = ["new", "reviewing", "resolved"] as const;
type RowStatus = (typeof STATUSES)[number];

const OAUTH_FALLBACK_HINT = "Giriş sağlayıcısı Supabase üzerinde aktif olmayabilir.";

function assertAbsoluteHttpUrl(redirectTo: string): boolean {
  try {
    const u = new URL(redirectTo);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type SupportMessageRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  message: string;
  page_path: string | null;
  status: string;
};

type StatusFilter = "all" | RowStatus;

function statusLabel(s: RowStatus): string {
  switch (s) {
    case "new":
      return "Yeni";
    case "reviewing":
      return "İnceleniyor";
    case "resolved":
      return "Çözüldü";
    default:
      return s;
  }
}

function rowStatusValue(raw: string): RowStatus {
  const t = raw.trim() as RowStatus;
  return STATUSES.includes(t) ? t : "new";
}

function GoogleOAuthGlyph({ className = "h-[22px] w-[22px]" }: { className?: string }) {
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

function AppleOAuthGlyph({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.106 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.029 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

async function reconcileSession(
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

    const { data: adminRow } = await supabase.from("admin_users").select("id").maybeSingle();
    setSession(session);
    setIsAdmin(Boolean(adminRow));
  } finally {
    setBusy(false);
  }
}

/** Canonical path: `/support/admin` (OAuth + magic link); admin_users ile yetki kontrolü. */
export function AdminSupportDashboard() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = configured ? getSupabaseBrowserClient() : null;

  const [busy, setBusy] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rows, setRows] = useState<SupportMessageRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [oauthProviderBusy, setOauthProviderBusy] = useState<null | "google" | "apple">(null);

  const authUiLocked = otpSending || oauthProviderBusy !== null;

  const signInWithOAuthProvider = useCallback(
    async (provider: "google" | "apple") => {
      setFormError(null);
      setOtpSent(false);
      if (!client) return;

      const redirectTo = getAdminSupportMagicLinkRedirectTo();
      if (!assertAbsoluteHttpUrl(redirectTo)) {
        setFormError(
          `Giriş başlatılamadı: yönlendirme adresi geçersiz. ${OAUTH_FALLBACK_HINT}`.trim(),
        );
        return;
      }

      setOauthProviderBusy(provider);
      try {
        /** Tam sayfa redirect akışı (popup değil). Başarıda tarayıcı ayrılıyor; busy state sıfırlanmaz. */
        const { error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: false,
            ...(provider === "google"
              ? {
                  queryParams: { prompt: "select_account" },
                }
              : {}),
          },
        });
        if (error) {
          setFormError(
            `${
              provider === "google" ? "Google ile giriş başlatılamadı." : "Apple ile giriş başlatılamadı."
            } ${OAUTH_FALLBACK_HINT}`,
          );
          setOauthProviderBusy(null);
          return;
        }
      } catch {
        setFormError(
          `${provider === "google" ? "Google ile giriş başlatılamadı." : "Apple ile giriş başlatılamadı."} ${OAUTH_FALLBACK_HINT}`,
        );
        setOauthProviderBusy(null);
      }
    },
    [client],
  );

  const runReconcile = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    await reconcileSession(client, setSession, setIsAdmin, setBusy);
  }, [client]);

  useEffect(() => {
    if (!client) return undefined;
    void reconcileSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      void reconcileSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
    });

    return () => subscription.unsubscribe();
  }, [client]);

  const loadMessages = useCallback(async () => {
    if (!client || !session || !isAdmin) return;
    setListLoading(true);
    setLoadError(null);

    let q = client
      .from("support_messages")
      .select("id,created_at,name,email,message,page_path,status")
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") {
      q = q.eq("status", statusFilter);
    }

    const { data, error } = await q;

    setListLoading(false);
    if (error) {
      setLoadError("Mesajlar yüklenemedi. Oturumu kontrol et veya tekrar dene.");
      setRows([]);
      return;
    }
    setRows(Array.isArray(data) ? (data as SupportMessageRow[]) : []);
  }, [client, session, isAdmin, statusFilter]);

  useEffect(() => {
    if (!session || !isAdmin) return undefined;
    queueMicrotask(() => {
      void loadMessages();
    });
    return undefined;
  }, [session, isAdmin, loadMessages]);

  const sendMagicLink = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setOtpSent(false);
      if (!client) return;
      const email = emailInput.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        setFormError("Geçerli bir e‑posta adresi girin.");
        return;
      }
      setOtpSending(true);
      try {
        const redirectTo = getAdminSupportMagicLinkRedirectTo();
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: true,
          },
        });
        if (error) {
          setFormError(
            "Giriş bağlantısı gönderilemedi. Supabase Redirect URL ayarlarını kontrol edin.",
          );
          setOtpSending(false);
          return;
        }
        setOtpSent(true);
      } finally {
        setOtpSending(false);
      }
    },
    [client, emailInput],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setRows([]);
    setOtpSent(false);
    setEmailInput("");
    setStatusFilter("all");
  }, [client]);

  const updateRowStatus = useCallback(
    async (rowId: string, nextStatus: RowStatus) => {
      if (!client) return;
      setUpdatingIds((m) => ({ ...m, [rowId]: true }));
      try {
        const { error } = await client.from("support_messages").update({ status: nextStatus }).eq("id", rowId);

        if (error) {
          setLoadError("Durum güncellenemedi. Tekrar deneyin.");
          return;
        }

        await loadMessages();
      } finally {
        setUpdatingIds((m) => {
          const cp = { ...m };
          delete cp[rowId];
          return cp;
        });
      }
    },
    [client, loadMessages],
  );

  if (!configured || !client) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-16 text-center md:py-24">
        <h1 className="text-xl font-black tracking-tight text-white md:text-2xl">Admin destek</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Supabase ortamı yapılandırılmamış. Projede{" "}
          <code className="rounded-md bg-black/35 px-1.5 py-0.5 text-cyan-200/85">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          ve anahtarların tanımlı olduğundan emin olun.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center self-center rounded-full border border-white/[0.1] px-6 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/35"
        >
          Ana sayfaya dön
        </Link>
      </section>
    );
  }

  if (busy) {
    return (
      <section className="mx-auto flex min-h-[48vh] max-w-xl items-center justify-center px-4 py-20">
        <p className="text-sm font-medium text-slate-400">Yükleniyor…</p>
      </section>
    );
  }

  if (!session?.user.email) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-[min(28rem,calc(100vw-2rem))] flex-col justify-center px-4 pb-28 pt-14 md:pt-20">
        <div className="relative rounded-2xl border border-white/[0.088] bg-slate-950/[0.94] p-7 shadow-[0_28px_80px_-28px_rgba(0,0,0,0.75)] ring-1 ring-cyan-400/[0.1] backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] bg-gradient-to-br from-cyan-400/[0.05] via-transparent to-violet-500/[0.04]"
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/75">
              Leylek TAG yönetim
            </p>
            <h1 className="mt-4 text-[1.45rem] font-black leading-snug tracking-tight text-white md:text-[1.6rem]">
              Destek mesajları
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Google, Apple veya e‑posta bağlantısı ile yetkili hesap olarak giriş yapın.
            </p>

            {formError ? (
              <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3.5 py-2.5 text-sm font-medium leading-snug text-rose-100/95" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="mt-10 rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.06] via-black/20 to-violet-500/[0.04] p-4 shadow-inner ring-1 ring-white/[0.04] backdrop-blur-sm">
              <p className="text-center text-[10px] font-black uppercase tracking-[0.26em] text-slate-500">
                Hesabınla giriş
              </p>
              <button
                type="button"
                aria-busy={oauthProviderBusy === "google"}
                disabled={authUiLocked}
                onClick={() => void signInWithOAuthProvider("google")}
                className="group relative mt-4 flex min-h-[3.25rem] w-full cursor-pointer touch-manipulation items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/[0.11] bg-white/[0.045] px-5 text-[0.938rem] font-semibold tracking-tight text-white shadow-[0_14px_44px_-22px_rgba(0,114,255,0.45)] ring-1 ring-white/[0.06] backdrop-blur-xl transition duration-300 hover:border-cyan-400/22 hover:bg-white/[0.08] hover:shadow-[0_20px_54px_-22px_rgba(34,211,238,0.22)] hover:ring-cyan-400/18 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/[0.11] disabled:hover:bg-white/[0.045] disabled:hover:shadow-none disabled:hover:ring-white/[0.06] sm:font-bold sm:tracking-normal"
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.1)_0%,transparent_48%,rgba(34,211,238,0.06)_100%)] opacity-75 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />
                <GoogleOAuthGlyph className="relative z-[1] h-6 w-6 shrink-0 drop-shadow-sm" />
                <span className="relative z-[1] inline-flex items-center gap-2">
                  {oauthProviderBusy === "google" ? (
                    <>
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-cyan-300"
                      />
                      Yönlendiriliyor…
                    </>
                  ) : (
                    "Google ile giriş yap"
                  )}
                </span>
              </button>
              <button
                type="button"
                disabled={authUiLocked}
                onClick={() => void signInWithOAuthProvider("apple")}
                className="relative mt-3 flex min-h-[3.125rem] w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.12] bg-black/55 px-5 text-[0.938rem] font-bold text-white shadow-[0_14px_48px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-black/65 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <AppleOAuthGlyph className="h-6 w-6 shrink-0 text-white" />
                {oauthProviderBusy === "apple" ? "Yönlendiriliyor…" : "Apple ile giriş yap"}
              </button>
            </div>

            <div className="relative my-10 flex items-center justify-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
              <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Alternatif
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/75">
                E‑posta bağlantısı
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Kutunuza düşecek bağlantıyla güvenli giriş — <span className="text-slate-400">yedek yöntem</span>.
              </p>

              <form className="mt-5 grid gap-4" onSubmit={sendMagicLink}>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200/72">
                    E‑posta
                  </span>
                  <input
                    type="email"
                    value={emailInput}
                    autoComplete="email"
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="yetkili@alanadiniz.com"
                    className="rounded-xl border border-white/[0.08] bg-black/38 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/32 disabled:opacity-45"
                    disabled={authUiLocked}
                  />
                </label>
                <button
                  type="submit"
                  disabled={authUiLocked}
                  className="rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-3 text-sm font-black text-white shadow-[0_16px_40px_-16px_rgba(0,198,255,0.45)] ring-1 ring-cyan-300/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {otpSending ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}
                </button>
                {otpSent ? (
                  <p className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-2.5 text-sm leading-relaxed text-cyan-100/95">
                    Giriş bağlantısı e‑postanıza gönderildi.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={oauthProviderBusy !== null}
                  onClick={() => void runReconcile()}
                  className="text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  Oturumu yenile (OAuth veya bağlantı sonrası)
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 pb-28 pt-16">
        <div className="rounded-2xl border border-amber-500/28 bg-slate-950/[0.96] p-8 text-center backdrop-blur-xl">
          <h1 className="text-xl font-black text-white">Yetkisiz</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Bu panel yalnızca tanımlı yöneticiler içindir. E‑postanız yetkili listesinde değil veya liste henüz
            oluşturulmadı.
          </p>
          <p className="mt-5 break-all font-mono text-xs text-slate-500">{session.user.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-8 w-full rounded-xl border border-white/[0.12] bg-white/[0.04] py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/35"
          >
            Çıkış yap
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-32 pt-10 md:pb-24 md:pt-14">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">Admin</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">Destek mesajları</h1>
          <p className="mt-2 text-sm text-slate-400">
            <span className="text-slate-500">Oturum:</span>{" "}
            <span className="font-medium text-slate-300">{session.user.email}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="uppercase tracking-wider">Filtre</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400/35"
            >
              <option value="all">Tümü</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadMessages()}
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-400/35"
          >
            Yenile
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-rose-500/28 bg-rose-500/[0.08] px-4 py-2 text-xs font-bold text-rose-100 transition hover:border-rose-400/45"
          >
            Çıkış
          </button>
        </div>
      </header>

      {loadError ? (
        <p className="mt-6 text-sm font-medium text-rose-300/95" role="alert">
          {loadError}
        </p>
      ) : null}

      {listLoading ? (
        <p className="mt-10 text-sm text-slate-500">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-sm text-slate-500">Bu filtrede kayıt yok.</p>
      ) : (
        <div className="mt-8 grid gap-4 md:gap-5">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-white/[0.07] bg-slate-950/[0.88] p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)] ring-1 ring-cyan-400/[0.06] backdrop-blur-xl md:p-6"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    <time dateTime={row.created_at} className="text-slate-400">
                      {new Date(row.created_at).toLocaleString("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    {row.page_path ? (
                      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] normal-case tracking-normal text-cyan-200/80">
                        {row.page_path}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
                    <span>
                      <span className="text-slate-500">Ad: </span>
                      {row.name?.trim() ? row.name : "—"}
                    </span>
                    <span>
                      <span className="text-slate-500">E‑posta: </span>
                      {row.email?.trim() ? row.email : "—"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200/95">{row.message}</p>
                </div>
                <div className="shrink-0 md:w-44">
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">
                      Durum
                    </span>
                    <select
                      value={rowStatusValue(row.status)}
                      disabled={updatingIds[row.id]}
                      onChange={(e) => void updateRowStatus(row.id, e.target.value as RowStatus)}
                      className="w-full rounded-xl border border-white/[0.1] bg-black/45 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-400/35 disabled:opacity-50"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
