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
  source: string | null;
  user_agent: string | null;
  status: string;
  assigned_admin_id: string | null;
  assigned_admin_email: string | null;
  accepted_at: string | null;
  closed_at: string | null;
};

type StatusFilter = "all" | RowStatus;

type ViewerConversationState =
  | "claimable_new"
  | "self_reviewing"
  | "self_resolved"
  | "other_reviewing"
  | "other_resolved"
  | "reviewing_missing_assignment";

function viewerConversationState(row: SupportMessageRow, viewerId: string | undefined): ViewerConversationState {
  const st = row.status.trim().toLowerCase();
  if (st === "resolved") {
    if (viewerId && row.assigned_admin_id === viewerId) return "self_resolved";
    return "other_resolved";
  }
  if (st === "new") {
    return "claimable_new";
  }
  if (st === "reviewing") {
    if (!row.assigned_admin_id) return "reviewing_missing_assignment";
    if (!viewerId) return "other_reviewing";
    if (row.assigned_admin_id === viewerId) return "self_reviewing";
    return "other_reviewing";
  }
  return "claimable_new";
}

function listMessagePreview(row: SupportMessageRow, viewerId: string | undefined): string {
  const v = viewerConversationState(row, viewerId);
  if (v === "other_reviewing") return "Başka admin tarafından alınmış görüşme.";
  if (v === "other_resolved") return "Çözüldü — başka yönetici.";
  return row.message;
}

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

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "new", label: statusLabel("new") },
  { value: "reviewing", label: statusLabel("reviewing") },
  { value: "resolved", label: statusLabel("resolved") },
];

function SupportAdminMessageDetail({
  row,
  viewerState,
  updating,
  onAccept,
  onMarkResolved,
}: {
  row: SupportMessageRow;
  viewerState: ViewerConversationState;
  updating: boolean;
  onAccept: () => void;
  onMarkResolved: () => void;
}) {
  const st = rowStatusValue(row.status);

  const canReadBody =
    viewerState === "claimable_new" ||
    viewerState === "self_reviewing" ||
    viewerState === "self_resolved" ||
    viewerState === "reviewing_missing_assignment";

  return (
    <article className="rounded-[1.25rem] border border-white/[0.09] bg-slate-950/[0.9] p-5 shadow-[0_24px_72px_-42px_rgba(0,114,255,0.38)] ring-1 ring-cyan-400/[0.08] backdrop-blur-xl md:p-6">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <time dateTime={row.created_at} className="text-slate-400">
              {new Date(row.created_at).toLocaleString("tr-TR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
            <span className="rounded-full border border-white/[0.08] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-100/92">
              {statusLabel(st)}
            </span>
            {row.page_path ? (
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] normal-case tracking-normal text-cyan-200/85">
                {row.page_path}
              </span>
            ) : null}
            {row.source?.trim() ? (
              <span className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Kaynak · {row.source}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-300">
            <span>
              <span className="text-slate-500">Ad: </span>
              {row.name?.trim() ? row.name : "—"}
            </span>
            <span className="min-w-0 break-all">
              <span className="text-slate-500">E‑posta: </span>
              {row.email?.trim() ? row.email : "—"}
            </span>
          </div>
          {viewerState === "self_reviewing" ? (
            <p className="rounded-xl border border-cyan-400/22 bg-cyan-400/[0.08] px-3 py-2 text-[12px] font-semibold leading-snug text-cyan-50/96">
              Bu görüşme sana atanmış.
            </p>
          ) : null}
          {viewerState === "other_reviewing" || viewerState === "other_resolved" ? (
            <p className="rounded-xl border border-amber-500/22 bg-amber-500/[0.08] px-3 py-2 text-[12px] font-semibold leading-snug text-amber-50/95">
              Bu görüşme başka bir yönetici tarafından{" "}
              {viewerState === "other_resolved" ? "yönetilip çözüldü" : "alındı"}.
              {row.assigned_admin_email?.trim() ? (
                <span className="mt-1 block font-mono text-[11px] font-medium text-slate-300/92">
                  {row.assigned_admin_email.trim()}
                </span>
              ) : null}
            </p>
          ) : null}
          {viewerState === "reviewing_missing_assignment" ? (
            <p className="rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[12px] font-medium leading-snug text-slate-300">
              Kayıtta atama eksik (status inceleniyor). Veritabanını güncelledikten sonra bu kaydı yeniden açmayı deneyin
              — <span className="font-mono text-[11px] text-slate-400">website/supabase/support_assignments.sql</span>.
            </p>
          ) : null}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:items-end md:justify-end md:self-start">
          {viewerState === "claimable_new" ? (
            <button
              type="button"
              disabled={updating}
              onClick={onAccept}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_14px_36px_-18px_rgba(0,198,255,0.45)] ring-1 ring-cyan-300/18 transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55 md:w-56"
            >
              {updating ? "İşleniyor…" : "Görüşmeyi kabul et"}
            </button>
          ) : null}
          {viewerState === "self_reviewing" ? (
            <button
              type="button"
              disabled={updating}
              onClick={onMarkResolved}
              className="min-h-[44px] w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-[13px] font-bold text-white transition hover:border-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-55 md:w-56"
            >
              {updating ? "Kaydediliyor…" : "Çözüldü olarak işaretle"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Mesaj</p>
        {canReadBody ? (
          <>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100/95">{row.message}</p>
            {row.user_agent?.trim() ? (
              <p className="mt-4 break-all font-mono text-[10px] leading-relaxed text-slate-500">{row.user_agent}</p>
            ) : null}
            {viewerState === "self_resolved" && row.closed_at ? (
              <p className="mt-4 text-[12px] text-slate-500">
                Kapatıldı:{" "}
                <time dateTime={row.closed_at}>
                  {new Date(row.closed_at).toLocaleString("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Mesaj içeriği yalnızca görüşmeyi kabul eden yönetici tarafından görüntülenebilir.
          </p>
        )}
      </div>
    </article>
  );
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
  const [pickedId, setPickedId] = useState<string | null>(null);
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
      .select(
        "id,created_at,name,email,message,page_path,source,user_agent,status,assigned_admin_id,assigned_admin_email,accepted_at,closed_at",
      )
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
    setPickedId(null);
    setOtpSent(false);
    setEmailInput("");
    setStatusFilter("all");
  }, [client]);

  const acceptConversation = useCallback(
    async (rowId: string, adminId: string, adminEmail: string) => {
      if (!client) return;
      setLoadError(null);
      setUpdatingIds((m) => ({ ...m, [rowId]: true }));
      try {
        const acceptedAtIso = new Date().toISOString();
        const { data, error } = await client
          .from("support_messages")
          .update({
            status: "reviewing",
            assigned_admin_id: adminId,
            assigned_admin_email: adminEmail.trim() || "",
            accepted_at: acceptedAtIso,
            closed_at: null,
          })
          .eq("id", rowId)
          .eq("status", "new")
          .is("assigned_admin_id", null)
          .select("id");

        if (error) {
          setLoadError("Görüşme kabul edilemedi. Tekrar deneyin veya listeyi yenile.");
          return;
        }

        const rowsReturned = Array.isArray(data) ? data.length : 0;
        if (rowsReturned !== 1) {
          setLoadError("Bu görüşme başka bir yönetici tarafından alınmış olabilir. Listeyi yenile.");
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

  const markConversationResolved = useCallback(
    async (rowId: string, adminId: string) => {
      if (!client) return;
      setLoadError(null);
      setUpdatingIds((m) => ({ ...m, [rowId]: true }));
      try {
        const closedAtIso = new Date().toISOString();
        const { data, error } = await client
          .from("support_messages")
          .update({
            status: "resolved",
            closed_at: closedAtIso,
          })
          .eq("id", rowId)
          .eq("assigned_admin_id", adminId)
          .eq("status", "reviewing")
          .select("id");

        if (error) {
          setLoadError("Çözüldü işaretlenemedi. Tekrar dene.");
          return;
        }

        const rowsReturned = Array.isArray(data) ? data.length : 0;
        if (rowsReturned !== 1) {
          setLoadError("Kayıt güncellenemedi. Listeyi yenile.");
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

  const resolvedListSelectionId = useMemo(() => {
    if (!rows.length) return null;
    if (pickedId != null && rows.some((row) => row.id === pickedId)) return pickedId;
    return rows[0].id;
  }, [rows, pickedId]);

  const selectedRow = useMemo(
    () =>
      resolvedListSelectionId != null ? rows.find((row) => row.id === resolvedListSelectionId) ?? null : null,
    [rows, resolvedListSelectionId],
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

  const viewerId = session.user.id;
  const viewerEmail = session.user.email ?? "";

  return (
    <section className="mx-auto min-h-[70vh] max-w-[min(90rem,calc(100vw-2rem))] px-4 pb-32 pt-10 md:pb-24 md:pt-14">
      <header className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/75">Admin</p>
          <h1 className="mt-2 text-[1.65rem] font-black tracking-tight text-white md:text-3xl">
            Destek gelen kutusu
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            Gönderilen mesajları incele; kullanıcı adı/e‑posta yalnızca formdan geldiği gibidir — hesap ile
            eşlenmez.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            <span>Oturum: </span>
            <span className="font-medium text-slate-300">{session.user.email}</span>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div
            role="toolbar"
            aria-label="Durum filtresi"
            className="flex flex-wrap gap-2 rounded-[1rem] border border-white/[0.06] bg-black/30 p-1.5"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={statusFilter === opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`touch-manipulation rounded-[0.7rem] px-3.5 py-2 text-[12px] font-bold transition-[background-color,color,box-shadow] ${
                  statusFilter === opt.value
                    ? "bg-cyan-400/14 text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.18)]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadMessages()}
            className="min-h-[44px] shrink-0 touch-manipulation rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[12px] font-bold text-cyan-100 transition hover:border-cyan-400/35"
          >
            Yenile
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-[44px] shrink-0 touch-manipulation rounded-xl border border-rose-500/28 bg-rose-500/[0.08] px-4 py-2.5 text-[12px] font-bold text-rose-100 transition hover:border-rose-400/45"
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
        <p className="mt-10 text-[13px] text-slate-500">Liste yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="mt-12 rounded-[1.125rem] border border-white/[0.07] bg-black/38 px-6 py-10 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-400">Bu filtrede görünecek ileti yok.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-3 md:hidden">
            {rows.map((row) => {
              const active = row.id === resolvedListSelectionId;
              const st = rowStatusValue(row.status);
              return (
                <button
                  key={`m-${row.id}`}
                  type="button"
                  onClick={() => setPickedId(row.id)}
                  className={`w-full rounded-[1.05rem] border p-4 text-left transition-[border-color,background-color] ${
                    active
                      ? "border-cyan-400/35 bg-white/[0.08]"
                      : "border-white/[0.07] bg-black/42 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <time dateTime={row.created_at}>
                        {new Date(row.created_at).toLocaleString("tr-TR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </p>
                    <span className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100/92">
                      {statusLabel(st)}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] text-slate-400">
                    {row.name?.trim() || row.email?.trim() || "Kimlik bilgisi yok"}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-slate-300/95">
                    {listMessagePreview(row, viewerId)}
                  </p>
                </button>
              );
            })}
            <div className="pt-3">
              {selectedRow ? (
                <SupportAdminMessageDetail
                  row={selectedRow}
                  viewerState={viewerConversationState(selectedRow, viewerId)}
                  updating={Boolean(updatingIds[selectedRow.id])}
                  onAccept={() => void acceptConversation(selectedRow.id, viewerId, viewerEmail)}
                  onMarkResolved={() => void markConversationResolved(selectedRow.id, viewerId)}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-8 hidden md:grid md:grid-cols-[minmax(280px,360px)_1fr] md:items-start md:gap-6">
            <aside
              className="max-h-[calc(100vh-11rem)] space-y-2 overflow-y-auto overscroll-contain pr-1"
              aria-label="Mesaj listesi"
            >
              {rows.map((row) => {
                const active = row.id === resolvedListSelectionId;
                const st = rowStatusValue(row.status);
                return (
                  <button
                    key={`d-${row.id}`}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => setPickedId(row.id)}
                    className={`w-full rounded-[1.05rem] border p-3.5 text-left transition-[border-color,background-color] ${
                      active
                        ? "border-cyan-400/38 bg-white/[0.08] shadow-[0_14px_40px_-26px_rgba(0,198,255,0.35)]"
                        : "border-white/[0.06] bg-black/40 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <time
                        dateTime={row.created_at}
                        className="font-mono text-[10px] font-semibold text-slate-500"
                      >
                        {new Date(row.created_at).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </time>
                      <span className="rounded-full bg-cyan-400/10 px-2 py-px text-[9px] font-black uppercase tracking-wider text-cyan-100/90">
                        {statusLabel(st)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[12px] font-semibold text-slate-300">
                      {row.name?.trim() || row.email?.trim() || "Kimlik bilgisi yok"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500">
                      {listMessagePreview(row, viewerId)}
                    </p>
                  </button>
                );
              })}
            </aside>
            <div className="min-h-[calc(22rem-env(safe-area-inset-bottom,0px))] md:sticky md:top-6">
              {selectedRow ? (
                <SupportAdminMessageDetail
                  row={selectedRow}
                  viewerState={viewerConversationState(selectedRow, viewerId)}
                  updating={Boolean(updatingIds[selectedRow.id])}
                  onAccept={() => void acceptConversation(selectedRow.id, viewerId, viewerEmail)}
                  onMarkResolved={() => void markConversationResolved(selectedRow.id, viewerId)}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
