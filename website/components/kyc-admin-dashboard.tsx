"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { KycActionDialog } from "@/components/kyc-action-dialog";
import { KycApplicationCard } from "@/components/kyc-application-card";
import { KycDocLightbox, type KycDocItem } from "@/components/kyc-doc-lightbox";
import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  kycCountLabel,
  kycDisplayField,
  kycEmptyListMessage,
  type KycActionResponse,
  type KycPendingRow,
  type KycReviewAction,
  type KycStatusFilter,
} from "@/lib/kyc-admin-types";
import { getKycAdminMagicLinkRedirectTo } from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type PendingResponse = {
  success?: boolean;
  pending_count?: number;
  total_count?: number;
  status_filter?: string;
  requests?: KycPendingRow[];
  error?: string;
};

const STATUS_FILTERS: { id: KycStatusFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "pending", label: "Bekleyen" },
  { id: "approved", label: "Onaylanan" },
  { id: "rejected", label: "Reddedilen" },
];

const ACTION_SUCCESS: Record<KycReviewAction, string> = {
  approve: "Başvuru onaylandı.",
  reject: "Başvuru reddedildi.",
  request_docs: "Eksik belge talebi kaydedildi.",
};

async function fetchKycList(
  accessToken: string,
  statusFilter: KycStatusFilter,
): Promise<{ rows: KycPendingRow[]; error: string | null }> {
  try {
    const qs = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
    const res = await fetch(`/api/admin/kyc/pending${qs}`, {
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

async function postKycAction(
  accessToken: string,
  payload: {
    action: KycReviewAction;
    user_id: string;
    user_message?: string;
    admin_note?: string;
    expected_kyc_status: string;
  },
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch("/api/admin/kyc/action", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as KycActionResponse;
  if (!res.ok) {
    return {
      ok: false,
      message: body.message ?? body.error ?? "İşlem başarısız.",
    };
  }
  return { ok: true, message: ACTION_SUCCESS[payload.action] };
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<KycStatusFilter>("all");

  const [actionTarget, setActionTarget] = useState<KycPendingRow | null>(null);
  const [actionType, setActionType] = useState<KycReviewAction>("approve");
  const [actionDialogKey, setActionDialogKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{
    items: KycDocItem[];
    index: number;
    subtitle: string;
  } | null>(null);

  const loadList = useCallback(async () => {
    if (!session?.access_token || !isAdmin) return;
    setListLoading(true);
    setLoadError(null);
    try {
      const { rows: nextRows, error } = await fetchKycList(session.access_token, statusFilter);
      setRows(nextRows);
      if (error) setLoadError(error);
    } finally {
      setListLoading(false);
    }
  }, [session, isAdmin, statusFilter]);

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
      void loadList();
    });
    return undefined;
  }, [session, isAdmin, loadList]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setRows([]);
  }, [client]);

  const openAction = useCallback((row: KycPendingRow, action: KycReviewAction) => {
    setActionDialogKey((k) => k + 1);
    setActionTarget(row);
    setActionType(action);
    setActionError(null);
  }, []);

  const closeAction = useCallback(() => {
    if (actionLoading) return;
    setActionTarget(null);
    setActionError(null);
  }, [actionLoading]);

  const confirmAction = useCallback(
    async (fields: { user_message: string; admin_note: string }) => {
      if (!session?.access_token || !actionTarget) return;
      setActionLoading(true);
      setActionError(null);
      setActingUserId(actionTarget.user_id);
      try {
        const result = await postKycAction(session.access_token, {
          action: actionType,
          user_id: actionTarget.user_id,
          user_message: fields.user_message || undefined,
          admin_note: fields.admin_note || undefined,
          expected_kyc_status: "pending",
        });
        if (!result.ok) {
          setActionError(result.message);
          return;
        }
        setActionTarget(null);
        setActionSuccess(result.message);
        await loadList();
      } catch {
        setActionError("İşlem başarısız.");
      } finally {
        setActionLoading(false);
        setActingUserId(null);
      }
    },
    [session, actionTarget, actionType, loadList],
  );

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
      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/78">Admin · KYC</p>
          <h1 className="mt-1.5 text-xl font-black text-white">KYC başvuruları</h1>
          <p className="mt-1.5 max-w-2xl text-xs text-slate-400">
            Bekleyen başvuruları inceleyin; onay, red veya eksik belge talebi gönderin. Push bildirimi bu
            sürümde gönderilmez.
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/support/ops"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35"
          >
            Operasyon Merkezi
          </Link>
          <Link
            href="/support/notifications"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35"
          >
            Bildirim Merkezi
          </Link>
          <Link
            href="/support/admin"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35"
          >
            Destek paneli
          </Link>
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={listLoading}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 disabled:opacity-50"
          >
            {listLoading ? "Yükleniyor…" : "Yenile"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-rose-500/35 px-3 py-2 text-xs font-bold text-rose-100/95"
          >
            Çıkış
          </button>
        </div>
      </header>

      {actionSuccess ? (
        <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-100" role="status">
          {actionSuccess}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setActionSuccess(null)}
          >
            Kapat
          </button>
        </p>
      ) : null}

      {loadError ? (
        <p className="mt-4 text-xs text-rose-300" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              disabled={listLoading}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                active
                  ? "border-cyan-400/45 bg-cyan-500/15 text-cyan-100"
                  : "border-white/[0.12] bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {kycCountLabel(statusFilter, rows.length, listLoading && !rows.length)}
      </p>

      <div className="mt-4 grid gap-3">
        {!listLoading && rows.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-8 text-center text-sm text-slate-500">
            {kycEmptyListMessage(statusFilter)}
          </p>
        ) : (
          rows.map((row) => (
            <KycApplicationCard
              key={row.user_id}
              row={row}
              acting={actingUserId === row.user_id}
              onOpenDoc={(items, index, subtitle) => setLightbox({ items, index, subtitle })}
              onAction={(action) => openAction(row, action)}
            />
          ))
        )}
      </div>

      <KycActionDialog
        key={actionDialogKey}
        open={Boolean(actionTarget)}
        action={actionType}
        userName={kycDisplayField(actionTarget?.name)}
        loading={actionLoading}
        error={actionError}
        onClose={closeAction}
        onConfirm={(fields) => void confirmAction(fields)}
      />

      <KycDocLightbox
        open={Boolean(lightbox)}
        items={lightbox?.items ?? []}
        index={lightbox?.index ?? 0}
        subtitle={lightbox?.subtitle ?? ""}
        onClose={() => setLightbox(null)}
        onSelectIndex={(index) =>
          setLightbox((prev) => (prev ? { ...prev, index } : null))
        }
      />
    </section>
  );
}
