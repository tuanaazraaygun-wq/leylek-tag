"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  isSafeKycImageUrl,
  kycDisplayField,
  kycVehicleKindLabel,
  type KycPendingRow,
} from "@/lib/kyc-admin-types";
import { getKycAdminMagicLinkRedirectTo } from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type PendingResponse = {
  success?: boolean;
  pending_count?: number;
  requests?: KycPendingRow[];
  error?: string;
};

function KycDocSlot({ label, url }: { label: string; url: string | null }) {
  if (!url || !isSafeKycImageUrl(url)) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-2 text-sm text-slate-500">Yok</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block overflow-hidden rounded-lg ring-1 ring-white/[0.08] transition hover:ring-cyan-400/35"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="h-28 w-full object-cover bg-slate-900" loading="lazy" />
      </a>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-[11px] font-semibold text-cyan-300/90 underline-offset-2 hover:underline"
      >
        Tam boyut aç
      </a>
    </div>
  );
}

function PendingKycCard({ row }: { row: KycPendingRow }) {
  const kind = row.pending_vehicle_kind || row.kyc_vehicle_kind;
  const warnings = row.ai_warnings?.length ? row.ai_warnings.join(" · ") : "—";

  return (
    <article className="rounded-2xl border border-white/[0.09] bg-slate-950/[0.92] p-5 shadow-[0_20px_60px_-32px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-white">{kycDisplayField(row.name)}</h2>
          <p className="mt-1 font-mono text-xs text-slate-400">{row.phone ?? "—"}</p>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{row.user_id}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <span className="rounded-full border border-amber-400/35 bg-amber-500/[0.1] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
            {row.kyc_status}
          </span>
          <span className="text-[11px] text-slate-500">
            {row.kyc_submitted_at ? new Date(row.kyc_submitted_at).toLocaleString("tr-TR") : "—"}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Araç tipi</dt>
          <dd className="mt-0.5 text-slate-200">{kycVehicleKindLabel(kind)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Plaka</dt>
          <dd className="mt-0.5 text-slate-200">{kycDisplayField(row.plate_number)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Araç</dt>
          <dd className="mt-0.5 text-slate-200">
            {kycDisplayField(row.vehicle_brand)} {kycDisplayField(row.vehicle_model)} (
            {kycDisplayField(row.vehicle_year)}) · {kycDisplayField(row.vehicle_color)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">AI durumu</dt>
          <dd className="mt-0.5 text-slate-200">{kycDisplayField(row.ai_status)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">AI uyarıları</dt>
          <dd className="mt-0.5 text-slate-300">{warnings}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KycDocSlot label="Ehliyet" url={row.license_photo_url} />
        <KycDocSlot label="Araç" url={row.vehicle_photo_url} />
        <KycDocSlot label="Motor" url={row.motorcycle_photo_url} />
        <KycDocSlot label="Selfie" url={row.selfie_url} />
      </div>
    </article>
  );
}

async function fetchPendingList(accessToken: string): Promise<{
  rows: KycPendingRow[];
  error: string | null;
}> {
  try {
    const res = await fetch("/api/admin/kyc/pending", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = (await res.json()) as PendingResponse;
    if (!res.ok) {
      const msg =
        body.error === "forbidden"
          ? "Bu hesap KYC paneline yetkili değil."
          : body.error === "unauthorized"
            ? "Oturum geçersiz. Tekrar giriş yapın."
            : "Liste yüklenemedi.";
      return { rows: [], error: msg };
    }
    return { rows: Array.isArray(body.requests) ? body.requests : [], error: null };
  } catch {
    return { rows: [], error: "Liste yüklenemedi." };
  }
}

async function reconcileKycAdminSession(
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

export function KycAdminDashboard() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = configured ? getSupabaseBrowserClient() : null;

  const [busy, setBusy] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rows, setRows] = useState<KycPendingRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const loadPending = useCallback(async () => {
    if (!session?.access_token || !isAdmin) return;
    setListLoading(true);
    setLoadError(null);
    try {
      const { rows: nextRows, error } = await fetchPendingList(session.access_token);
      setRows(nextRows);
      if (error) setLoadError(error);
    } finally {
      setListLoading(false);
    }
  }, [session, isAdmin]);

  useEffect(() => {
    if (!client) return undefined;
    void reconcileKycAdminSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileKycAdminSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
    });

    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!session || !isAdmin) return undefined;
    queueMicrotask(() => {
      void loadPending();
    });
    return undefined;
  }, [session, isAdmin, loadPending]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setRows([]);
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
        const redirectTo = getKycAdminMagicLinkRedirectTo();
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
      const redirectTo = getKycAdminMagicLinkRedirectTo();
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
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">KYC inceleme</p>
          <h1 className="mt-3 text-xl font-black text-white">Yetkili giriş</h1>
          <p className="mt-2 text-sm text-slate-400">Destek paneli ile aynı admin hesabı kullanılır.</p>
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
          <Link href="/support/admin" className="mt-6 block text-center text-xs text-slate-500 hover:text-slate-300">
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
      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/78">Admin · KYC</p>
          <h1 className="mt-2 text-2xl font-black text-white">Sürücü belge inceleme</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Bekleyen KYC başvurularını görüntüleyin. Bu panel{" "}
            <strong className="font-semibold text-amber-200/95">salt okunur</strong> moddadır; onay veya red işlemi
            yapılamaz.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/support/admin"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-white/[0.12] px-4 py-2.5 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35"
          >
            Destek paneli
          </Link>
          <button
            type="button"
            onClick={() => void loadPending()}
            disabled={listLoading}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-white/[0.12] px-4 py-2.5 text-xs font-bold text-cyan-100/95 disabled:opacity-50"
          >
            {listLoading ? "Yükleniyor…" : "Yenile"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-rose-500/35 px-4 py-2.5 text-xs font-bold text-rose-100/95"
          >
            Çıkış
          </button>
        </div>
      </header>

      <div
        className="mt-6 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/95"
        role="status"
      >
        Salt okunur mod — karar verme ve bildirim gönderme Faz 2&apos;de eklenecek.
      </div>

      {loadError ? (
        <p className="mt-6 text-sm text-rose-300" role="alert">
          {loadError}
        </p>
      ) : null}

      <p className="mt-6 text-sm text-slate-400">
        {listLoading && !rows.length ? "Yükleniyor…" : `${rows.length} bekleyen başvuru`}
      </p>

      <div className="mt-6 grid gap-5">
        {!listLoading && rows.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-8 text-center text-sm text-slate-500">
            Bekleyen KYC başvurusu yok.
          </p>
        ) : (
          rows.map((row) => <PendingKycCard key={row.user_id} row={row} />)
        )}
      </div>
    </section>
  );
}
