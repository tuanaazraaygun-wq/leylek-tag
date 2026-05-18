"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAdminSupportMagicLinkRedirectTo } from "@/lib/site-origin";
import {
  SUPPORT_ADMIN_TYPING_EVENT,
  SUPPORT_USER_TYPING_EVENT,
  supportTypingBridgeTopic,
} from "@/lib/support-typing-realtime";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";
import type { Session, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

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
  const vid = viewerId?.trim() ?? "";
  const assigned = row.assigned_admin_id?.trim() ?? "";

  const st = String(row.status ?? "").trim().toLowerCase();
  if (st === "resolved") {
    if (vid && assigned === vid) return "self_resolved";
    return "other_resolved";
  }
  if (st === "new") {
    return "claimable_new";
  }
  if (st === "reviewing") {
    if (!assigned) return "reviewing_missing_assignment";
    if (!vid) return "other_reviewing";
    if (assigned === vid) return "self_reviewing";
    return "other_reviewing";
  }
  return "claimable_new";
}

function listMessagePreview(row: SupportMessageRow, viewerId: string | undefined): string {
  const v = viewerConversationState(row, viewerId);
  if (v === "other_reviewing") return "Başka admin tarafından alınmış görüşme.";
  if (v === "other_resolved") return "Çözüldü — başka yönetici.";
  return row.message ?? "";
}

function ticketDeskPresenceLabel(
  row: SupportMessageRow,
  viewerId: string,
): { label: string; dotClass: string; textClass: string } {
  const st = rowStatusValue(row.status);
  const vid = viewerId.trim();
  const assigned = row.assigned_admin_id?.trim() ?? "";

  if (st === "new") {
    return {
      label: "Kuyruk · temsilci atanmadı",
      dotClass: "bg-violet-400",
      textClass: "text-violet-200/88",
    };
  }
  if (st === "reviewing") {
    if (!assigned) {
      return {
        label: "İnceleniyor · atama eksik",
        dotClass: "bg-amber-400",
        textClass: "text-amber-100/90",
      };
    }
    if (vid && assigned === vid) {
      return {
        label: "Sana atanmış · aktif",
        dotClass: "bg-emerald-400",
        textClass: "text-emerald-100/90",
      };
    }
    return {
      label: "Başka temsilci üzerinde",
      dotClass: "bg-slate-500",
      textClass: "text-slate-400/95",
    };
  }
  if (st === "resolved") {
    return {
      label: "Çözüldü",
      dotClass: "bg-emerald-500/70",
      textClass: "text-emerald-200/75",
    };
  }
  return {
    label: "—",
    dotClass: "bg-slate-600",
    textClass: "text-slate-500",
  };
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

function rowStatusValue(raw: string | null | undefined): RowStatus {
  const t = String(raw ?? "").trim() as RowStatus;
  return STATUSES.includes(t) ? t : "new";
}

type AdminRealtimeConnection = "connecting" | "live" | "reconnecting" | "offline";

function isoToMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatMediumIsoTr(iso: string | null | undefined): string {
  const ms = isoToMs(iso);
  return ms === null
    ? "—"
    : new Date(ms).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

/** Kısa relative (liste satırı) */
function formatShortRelativeTr(iso: string | null | undefined): string {
  const ms = isoToMs(iso);
  if (ms === null) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 45) return "şimdi";
  if (sec < 3600) return `${Math.floor(sec / 60)} dk`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} sa`;
  return `${Math.floor(sec / 86_400)} g`;
}

function resolveLastActivityIso(
  row: SupportMessageRow,
  lastChatAt: string | undefined,
): string | null {
  const candidates = [
    isoToMs(lastChatAt),
    isoToMs(row.closed_at),
    isoToMs(row.accepted_at),
    isoToMs(row.created_at),
  ].filter((v): v is number => typeof v === "number");
  if (!candidates.length) return row.created_at?.trim() ?? null;
  const best = candidates.reduce((a, b) => Math.max(a, b));
  return new Date(best).toISOString();
}

async function mergeLastChatTimestamps(
  client: SupabaseClient,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!ids.length) return out;
  const BATCH = 45;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { data, error } = await client
      .from("support_chat_messages")
      .select("support_message_id, created_at")
      .in("support_message_id", slice);
    if (error || !Array.isArray(data)) continue;
    for (const r of data as { support_message_id: string; created_at: string }[]) {
      const sid = r.support_message_id;
      const cur = out[sid];
      const nextMs = isoToMs(r.created_at);
      const curMs = isoToMs(cur);
      if (nextMs !== null && (curMs === null || nextMs > curMs)) out[sid] = r.created_at;
    }
  }
  return out;
}

function listStatusBadgeClass(st: RowStatus): string {
  switch (st) {
    case "new":
      return "border-violet-400/38 bg-violet-500/[0.12] text-violet-50/95 shadow-[0_0_18px_-8px_rgba(139,92,246,0.4)] ring-1 ring-violet-400/10";
    case "reviewing":
      return "border-amber-400/35 bg-amber-500/[0.12] text-amber-50/95 shadow-[0_0_18px_-8px_rgba(245,158,11,0.28)] ring-1 ring-amber-400/12";
    case "resolved":
      return "border-emerald-400/28 bg-emerald-500/[0.10] text-emerald-50/92 ring-1 ring-emerald-400/10";
    default:
      return "border-white/[0.08] bg-white/[0.05] text-slate-200";
  }
}

function AdminSupportHeadsetGlyph({ className = "h-[1.05rem] w-[1.05rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 14.5v2.2a2.8 2.8 0 0 0 2.8 2.8h.9V9.5H6.8A2.8 2.8 0 0 0 4 12.3v2.2Zm16 0v2.2a2.8 2.8 0 0 1-2.8 2.8h-.9V9.5h.9A2.8 2.8 0 0 1 20 12.3v2.2ZM7.7 19.5v.2a4.3 4.3 0 0 0 8.6 0v-.3"
      />
      <path strokeWidth="1.5" strokeLinecap="round" d="M9.2 10.2a3.7 3.7 0 0 1 5.6-.1" opacity="0.5" />
    </svg>
  );
}

function AdminSupportCheckGlyph({ className = "h-[1.05rem] w-[1.05rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 6 9 17l-5-5"
        className="text-emerald-200"
      />
    </svg>
  );
}

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "new", label: statusLabel("new") },
  { value: "reviewing", label: statusLabel("reviewing") },
  { value: "resolved", label: statusLabel("resolved") },
];

type SupportChatMessageRow = {
  id: string;
  support_message_id: string;
  sender_type: string;
  sender_email: string | null;
  body: string;
  created_at: string;
};

function dedupeDuplicateTicketLine(
  msgs: SupportChatMessageRow[],
  ticketBody: string,
): SupportChatMessageRow[] {
  const trimmed = ticketBody.trim();
  if (!trimmed) return msgs;

  let dropFirstDup = true;
  return msgs.filter((m) => {
    const st = m.sender_type.trim().toLowerCase();
    const body = m.body.trim();
    if (dropFirstDup && st === "user" && body === trimmed) {
      dropFirstDup = false;
      return false;
    }
    return true;
  });
}

type AdminComposerMode =
  | "active"
  | "claimable_new"
  | "self_resolved"
  | "other_admin"
  | "missing_assignment";

function adminComposerModeFromViewerState(v: ViewerConversationState): AdminComposerMode {
  switch (v) {
    case "claimable_new":
      return "claimable_new";
    case "self_reviewing":
      return "active";
    case "self_resolved":
      return "self_resolved";
    case "reviewing_missing_assignment":
      return "missing_assignment";
    case "other_reviewing":
    case "other_resolved":
      return "other_admin";
    default:
      return "other_admin";
  }
}

function AdminSupportChatSection({
  ticketId,
  ticketMessageBody,
  supabase,
  viewerState,
  viewerEmail,
  viewerId,
}: {
  ticketId: string;
  ticketMessageBody: string;
  supabase: SupabaseClient;
  viewerState: ViewerConversationState;
  viewerEmail: string;
  viewerId: string;
}) {
  const [rows, setRows] = useState<SupportChatMessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchHadError, setFetchHadError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [rtConn, setRtConn] = useState<AdminRealtimeConnection>("connecting");
  const [userTypingPeek, setUserTypingPeek] = useState(false);
  const [typingPipeReady, setTypingPipeReady] = useState(false);
  const [realtimeRepairKey, setRealtimeRepairKey] = useState(0);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const viewerEmailRef = useRef(viewerEmail);
  const viewerIdRef = useRef(viewerId);
  const realtimeSetupSeqRef = useRef(0);
  const realtimeRetryAttemptsRef = useRef(0);
  const realtimeRepairTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBurstRef = useRef(0);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const userTypingHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpUserTyping = useCallback(() => {
    setUserTypingPeek(true);
    if (userTypingHideTimerRef.current) clearTimeout(userTypingHideTimerRef.current);
    userTypingHideTimerRef.current = setTimeout(() => {
      setUserTypingPeek(false);
      userTypingHideTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    viewerEmailRef.current = viewerEmail;
    viewerIdRef.current = viewerId;
  }, [viewerEmail, viewerId]);

  useEffect(() => {
    realtimeRetryAttemptsRef.current = 0;
    queueMicrotask(() => {
      setRtConn("connecting");
      setRealtimeRepairKey(0);
      setTypingPipeReady(false);
      setUserTypingPeek(false);
    });
  }, [ticketId]);

  useEffect(() => {
    return () => {
      if (userTypingHideTimerRef.current) clearTimeout(userTypingHideTimerRef.current);
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
    };
  }, []);

  const composerMode = adminComposerModeFromViewerState(viewerState);
  const canUseComposer = composerMode === "active";

  const displayRows = useMemo(
    () => dedupeDuplicateTicketLine(rows, ticketMessageBody),
    [rows, ticketMessageBody],
  );

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [displayRows.length, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchHadError(false);
      setSendError(null);
      const { data, error } = await supabase
        .from("support_chat_messages")
        .select("id,support_message_id,sender_type,sender_email,body,created_at")
        .eq("support_message_id", ticketId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setLoading(false);
      if (error) {
        setFetchHadError(true);
        setRows([]);
        if (process.env.NODE_ENV !== "production") {
          console.error("[AdminSupportChat] support_chat_messages select failed", {
            code: error.code,
            message: error.message,
            selectedRowId: ticketId,
            sessionUserId: viewerIdRef.current,
            sessionEmail: viewerEmailRef.current,
          });
        }
        return;
      }
      setRows(Array.isArray(data) ? (data as SupportChatMessageRow[]) : []);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase, ticketId]);

  useEffect(() => {
    let cleaned = false;
    const seq = ++realtimeSetupSeqRef.current;
    const topic = `admin-support-chat:${ticketId}:${seq}`;

    const scheduleRepair = () => {
      if (cleaned) return;
      realtimeRetryAttemptsRef.current += 1;
      const n = realtimeRetryAttemptsRef.current;
      if (n > 8) {
        setRtConn("offline");
        return;
      }
      const delayMs = Math.min(30_000, 900 * 1.45 ** Math.min(n - 1, 12));
      if (process.env.NODE_ENV !== "production" && (n === 1 || n % 3 === 0)) {
        console.warn("[AdminSupportChat] realtime repair scheduled", { ticketId, n, delayMs });
      }
      setRtConn("reconnecting");
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      realtimeRepairTimerRef.current = setTimeout(() => {
        realtimeRepairTimerRef.current = null;
        if (!cleaned) setRealtimeRepairKey((k) => k + 1);
      }, delayMs);
    };

    queueMicrotask(() => {
      setRtConn("connecting");
    });

    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `support_message_id=eq.${ticketId}`,
        },
        (payload) => {
          if (cleaned) return;
          try {
            const row = payload.new as SupportChatMessageRow;
            if (!row?.id) return;
            setRows((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [...prev, row];
            });
          } catch {
            /* ignore coercion */
          }
        },
      )
      .subscribe((status, err) => {
        if (cleaned) return;
        if (status === "SUBSCRIBED") {
          realtimeRetryAttemptsRef.current = 0;
          setRtConn("live");
          return;
        }
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production" && err) {
          console.warn("[AdminSupportChat] realtime channel warning", err.message);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleRepair();
        }
      });

    return () => {
      cleaned = true;
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      realtimeRepairTimerRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, ticketId, realtimeRepairKey]);

  useEffect(() => {
    let disposed = false;
    const bridgeTopic = supportTypingBridgeTopic(ticketId);

    const ch = supabase
      .channel(bridgeTopic, { config: { broadcast: { ack: false } } })
      .on("broadcast", { event: SUPPORT_USER_TYPING_EVENT }, () => {
        if (!disposed) bumpUserTyping();
      })
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          typingChannelRef.current = ch;
          setTypingPipeReady(true);
          return;
        }
        typingChannelRef.current = null;
        setTypingPipeReady(false);
      });

    return () => {
      disposed = true;
      typingChannelRef.current = null;
      setTypingPipeReady(false);
      void supabase.removeChannel(ch);
    };
  }, [supabase, ticketId, bumpUserTyping]);

  useEffect(() => {
    if (!typingPipeReady || !canUseComposer || draft.trim().length < 1) return undefined;
    const ch = typingChannelRef.current;
    if (!ch) return undefined;

    typingBurstRef.current += 1;
    const burst = typingBurstRef.current;
    const t = window.setTimeout(() => {
      if (burst !== typingBurstRef.current) return;
      void ch
        .send({
          type: "broadcast",
          event: SUPPORT_ADMIN_TYPING_EVENT,
          payload: { at: Date.now() },
        })
        .catch(() => {});
    }, 520);
    return () => window.clearTimeout(t);
  }, [draft, canUseComposer, typingPipeReady]);

  const sendAdminMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSendError(null);
    const body = draft.trim();
    if (body.length < 1 || !canUseComposer || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from("support_chat_messages")
        .insert({
          support_message_id: ticketId,
          sender_type: "admin",
          sender_email: viewerEmail.trim() || null,
          body,
        })
        .select("id,support_message_id,sender_type,sender_email,body,created_at")
        .maybeSingle();

      if (error || !data) {
        setSendError("Mesaj gönderilemedi.");
        if (process.env.NODE_ENV !== "production") {
          console.error("[AdminSupportChat] support_chat_messages insert failed", {
            code: error?.code ?? null,
            message: error?.message ?? (data ? null : "insert returned no row"),
            selectedRowId: ticketId,
            sessionUserId: viewerId,
            sessionEmail: viewerEmail,
          });
        }
        return;
      }
      setDraft("");
      setRows((prev) =>
        prev.some((r) => r.id === data.id) ? prev : [...prev, data as SupportChatMessageRow],
      );
    } finally {
      setSending(false);
    }
  };

  const composerHint = (() => {
    switch (composerMode) {
      case "claimable_new":
        return "Önce görüşmeyi kabul etmelisin.";
      case "other_admin":
        return "Bu görüşme başka bir yönetici tarafından alınmış.";
      case "missing_assignment":
        return "Kayıtta atama eksik; veritabanı / RLS kontrolü gerekebilir.";
      case "self_resolved":
        return "Bu görüşme çözüldü olarak işaretlenmiş.";
      default:
        return null;
    }
  })();

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canUseComposer && draft.trim().length > 0 && !sending) {
        void sendAdminMessage();
      }
    }
  };

  const liveStatusClass =
    rtConn === "live"
      ? "border-emerald-400/38 bg-emerald-500/[0.12] text-emerald-100/95"
      : rtConn === "reconnecting"
        ? "border-amber-400/35 bg-amber-500/[0.1] text-amber-100/95"
        : rtConn === "offline"
          ? "border-rose-400/38 bg-rose-500/[0.1] text-rose-100/95"
          : "border-white/[0.1] bg-white/[0.05] text-slate-200";

  const liveStatusLabel =
    rtConn === "live"
      ? "Canlı"
      : rtConn === "reconnecting"
        ? "Yeniden bağlanıyor"
        : rtConn === "offline"
          ? "Kopuk — yeniden dene (sayfa yenile)"
          : "Bağlanıyor";

  return (
    <section
      aria-label="Canlı sohbet"
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/[0.06] pt-5"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Canlı masa</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Anlık sohbet; kullanıcıda “destek yazıyor…” göstergesi paylaşılır (site paneli güncelse).
          </p>
          {viewerState === "claimable_new" ? (
            <p className="mt-2 max-w-prose rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-2 text-[11px] font-medium leading-relaxed text-slate-400">
              Bu ticket kabul edilene kadar ziyaretçi tarafında genelde aktif temsilci yok hissi oluşabilir —
              süreci hızlı kabul ederek sıcak bağ kur.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ring-1 ring-white/[0.05] backdrop-blur-sm ${liveStatusClass}`}
          >
            ● {liveStatusLabel}
          </span>
          {loading ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">mesaj yükleme</span>
          ) : null}
          {typingPipeReady ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200/72">
              yazma sinyali açık
            </span>
          ) : null}
        </div>
      </div>

      {fetchHadError ? (
        <p className="mt-2 shrink-0 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-[12px] font-medium leading-relaxed text-rose-100/95" role="alert">
          Sohbet mesajları yüklenemedi (RLS veya ağ). Listeyi yenileyin veya daha sonra yeniden deneyin.
        </p>
      ) : null}

      {!canUseComposer && composerHint ? (
        <p className="mt-3 shrink-0 rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[12px] font-medium leading-snug text-slate-300">
          {composerHint}
        </p>
      ) : null}

      <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[1rem] border border-white/[0.07] bg-gradient-to-b from-black/45 to-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md md:px-3.5">
        {displayRows.length === 0 && !loading ? (
          <p className="px-1 py-6 text-center text-[12px] leading-relaxed text-slate-500">
            Henüz sohbet satırı yok. Önce görüşmeyi kabul et; sonra yanıt yaz.
          </p>
        ) : null}

        {displayRows.map((ln) => {
          const st = String(ln.sender_type ?? "").trim().toLowerCase();
          const base =
            "max-w-[min(100%,21rem)] rounded-2xl border px-3 py-2.5 text-[13px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]";

          const createdLabel = formatMediumIsoTr(ln.created_at);

          const timeEl = ln.created_at ? (
            <time className="mt-2 block font-mono text-[9px] text-slate-500/92" dateTime={ln.created_at}>
              {createdLabel}
            </time>
          ) : null;

          if (st === "system") {
            return (
              <div key={ln.id} className="mb-2 flex justify-center">
                <div
                  className={`${base} max-w-[95%] border-white/[0.08] bg-white/[0.04] text-center text-slate-200/92`}
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Sistem</span>
                  <div className="mt-1.5 whitespace-pre-wrap text-[12px]">{ln.body}</div>
                  {timeEl}
                </div>
              </div>
            );
          }

          if (st === "admin") {
            return (
              <div key={ln.id} className="mb-2 flex justify-end">
                <div
                  className={`${base} border-cyan-400/22 bg-gradient-to-br from-cyan-500/[0.16] to-black/52 text-slate-50/96`}
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100/75">Yanıtın</span>
                  <div className="mt-1.5 whitespace-pre-wrap">{ln.body}</div>
                  {ln.sender_email?.trim() ? (
                    <div className="mt-1 font-mono text-[9px] text-cyan-200/55">{ln.sender_email.trim()}</div>
                  ) : null}
                  {timeEl}
                </div>
              </div>
            );
          }

          return (
            <div key={ln.id} className="mb-2 flex justify-start">
              <div className={`${base} border-white/[0.08] bg-black/55 text-slate-100/94`}>
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Ziyaretçi</span>
                <div className="mt-1.5 whitespace-pre-wrap">{ln.body}</div>
                {timeEl}
              </div>
            </div>
          );
        })}

        {userTypingPeek ? (
          <div className="mb-2 px-1" role="status" aria-live="polite">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/55 px-3 py-1.5 backdrop-blur-sm">
              <span className="flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300 [animation-delay:280ms]" />
              </span>
              <span className="text-[11px] font-semibold tracking-tight text-slate-400">Ziyaretçi yazıyor…</span>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
      </div>

      <div className="admin-support-chat-composer shrink-0 border-t border-white/[0.06] bg-gradient-to-t from-slate-950/90 to-transparent pt-4">
        <form
          onSubmit={(ev) => void sendAdminMessage(ev)}
          className="space-y-2.5 rounded-xl border border-white/[0.06] bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-3.5"
        >
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Mesaj yaz</span>
            <textarea
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              onKeyDown={onComposerKeyDown}
              rows={3}
              disabled={!canUseComposer || sending}
              placeholder={canUseComposer ? "Profesyonel ve net yanıt…" : composerHint ?? "Önce görüşmeyi kabul et."}
              aria-label="Admin yanıtı"
              className="min-h-[88px] w-full resize-none rounded-xl border border-white/[0.1] bg-black/52 px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none ring-0 transition placeholder:text-slate-600 focus:border-cyan-400/38 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            {canUseComposer ? (
              <span className="text-[10px] text-slate-600">Enter ile gönder · Shift+Enter satır sonu</span>
            ) : null}
          </label>
          {sendError ? (
            <p className="text-[12px] font-medium text-rose-300/95" role="alert">
              {sendError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!canUseComposer || sending || draft.trim().length < 1}
            className="inline-flex min-h-[46px] w-full touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_36px_-14px_rgba(34,211,238,0.45)] ring-1 ring-cyan-200/22 transition hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {sending ? "Gönderiliyor…" : "Gönder"}
          </button>
        </form>
      </div>
    </section>
  );
}

function SupportAdminMessageDetail({
  row,
  viewerState,
  updating,
  onAccept,
  onMarkResolved,
  supabaseClient,
  viewerEmail,
  viewerId,
}: {
  row: SupportMessageRow;
  viewerState: ViewerConversationState;
  updating: boolean;
  onAccept: () => void;
  onMarkResolved: () => void;
  supabaseClient: SupabaseClient;
  viewerEmail: string;
  viewerId: string;
}) {
  const st = rowStatusValue(row.status);

  const canReadBody =
    viewerState === "claimable_new" ||
    viewerState === "self_reviewing" ||
    viewerState === "self_resolved" ||
    viewerState === "reviewing_missing_assignment";

  return (
    <article className="admin-support-detail-shell flex max-h-[min(92vh,calc(100vh-5.25rem))] min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-slate-950/[0.78] p-6 pb-4 shadow-[0_28px_80px_-40px_rgba(0,114,255,0.45)] ring-1 ring-cyan-400/[0.1] backdrop-blur-2xl md:max-h-[calc(100vh-4.5rem)] md:p-8 md:pb-5">
      <div className="relative z-[1] flex shrink-0 flex-col gap-5 border-b border-white/[0.07] pb-5 md:flex-row md:items-start md:justify-between md:gap-8 md:pb-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <time
              dateTime={isoToMs(row.created_at) !== null ? row.created_at : undefined}
              className="text-slate-400 [font-variant-numeric:tabular-nums]"
            >
              {formatMediumIsoTr(row.created_at)}
            </time>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${listStatusBadgeClass(st)}`}
            >
              {statusLabel(st)}
            </span>
            {row.page_path ? (
              <span className="rounded-lg border border-white/[0.08] bg-black/35 px-2 py-1 font-mono text-[10px] font-medium normal-case tracking-normal text-cyan-200/88">
                {row.page_path}
              </span>
            ) : null}
            {row.source?.trim() ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/22 bg-gradient-to-r from-cyan-500/[0.14] via-cyan-400/[0.08] to-emerald-500/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-50/96 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12),0_8px_28px_-14px_rgba(34,211,238,0.35)] backdrop-blur-sm">
                <span className="text-cyan-200/75">Kaynak</span>
                <span className="text-cyan-300/40" aria-hidden>
                  ·
                </span>
                <span className="font-mono text-[10px] font-bold normal-case tracking-normal text-white/90">
                  {row.source.trim()}
                </span>
              </span>
            ) : null}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 sm:gap-x-6">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5 backdrop-blur-md">
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Ad</dt>
              <dd className="mt-1 truncate text-[14px] font-semibold leading-snug text-slate-100/94">
                {row.name?.trim() ? row.name : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5 backdrop-blur-md">
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">E‑posta</dt>
              <dd className="mt-1 break-all text-[13px] font-medium leading-snug text-slate-200/92">
                {row.email?.trim() ? row.email : "—"}
              </dd>
            </div>
          </dl>

          {viewerState === "self_reviewing" ? (
            <p className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.1] px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-cyan-50/96 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.1)] backdrop-blur-sm">
              Bu görüşme sana atanmış.
            </p>
          ) : null}
          {viewerState === "other_reviewing" || viewerState === "other_resolved" ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.09] px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-amber-50/95 backdrop-blur-sm">
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
            <p className="rounded-xl border border-white/[0.1] bg-white/[0.05] px-3.5 py-2.5 text-[12px] font-medium leading-snug text-slate-300 backdrop-blur-sm">
              Kayıtta atama eksik (status inceleniyor). Veritabanını güncelledikten sonra bu kaydı yeniden açmayı deneyin
              — <span className="font-mono text-[11px] text-slate-400">website/supabase/support_assignments.sql</span>.
            </p>
          ) : null}
        </div>

        <div className="relative z-[1] flex w-full shrink-0 flex-col gap-2.5 md:w-auto md:items-end md:self-start">
          {viewerState === "claimable_new" ? (
            <button
              type="button"
              disabled={updating}
              aria-busy={updating}
              onClick={onAccept}
              className="admin-support-cta-accept inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-5 py-3 text-[13px] font-black text-white shadow-[0_14px_40px_-12px_rgba(34,211,238,0.45)] ring-1 ring-cyan-200/25 disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[15.5rem]"
            >
              {updating ? (
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white"
                />
              ) : (
                <AdminSupportHeadsetGlyph className="shrink-0 opacity-95" />
              )}
              <span>{updating ? "Kabul ediliyor…" : "Görüşmeyi kabul et"}</span>
            </button>
          ) : null}
          {viewerState === "self_reviewing" ? (
            <button
              type="button"
              disabled={updating}
              aria-busy={updating}
              onClick={onMarkResolved}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/28 bg-gradient-to-b from-emerald-500/[0.14] to-black/25 px-5 py-3 text-[13px] font-bold text-emerald-50/95 shadow-[0_10px_36px_-14px_rgba(16,185,129,0.35)] ring-1 ring-white/[0.06] backdrop-blur-md transition hover:border-emerald-400/45 hover:shadow-[0_14px_40px_-14px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[15.5rem]"
            >
              {updating ? (
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-200/35 border-t-emerald-100"
                />
              ) : (
                <AdminSupportCheckGlyph className="shrink-0 text-emerald-200" />
              )}
              <span>{updating ? "Kaydediliyor…" : "Çözüldü olarak işaretle"}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden pt-5">
        <div className="shrink-0 border-b border-white/[0.06] pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">İlk mesaj (ticket)</p>
        {canReadBody ? (
          <>
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md md:p-5">
              <p className="whitespace-pre-wrap text-[15px] font-normal leading-[1.65] text-slate-100/[0.94]">
                {row.message}
              </p>
            </div>
            {row.user_agent?.trim() ? (
              <p className="mt-4 break-all font-mono text-[10px] leading-relaxed text-slate-500/95">
                {row.user_agent}
              </p>
            ) : null}
            {viewerState === "self_resolved" && row.closed_at ? (
              <p className="mt-5 text-[12px] font-medium text-slate-500">
                Kapatıldı:{" "}
                <time
                  dateTime={isoToMs(row.closed_at) !== null ? row.closed_at! : undefined}
                  className="text-slate-400"
                >
                  {formatMediumIsoTr(row.closed_at)}
                </time>
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
            Mesaj içeriği yalnızca görüşmeyi kabul eden yönetici tarafından görüntülenebilir.
          </p>
        )}

        </div>

        <AdminSupportChatSection
          ticketId={row.id}
          ticketMessageBody={row.message}
          supabase={supabaseClient}
          viewerState={viewerState}
          viewerEmail={viewerEmail}
          viewerId={viewerId}
        />
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

    const normalizedEmail = session.user.email?.trim().toLowerCase() ?? "";

    const { data: adminRow, error: adminUsersError } = await supabase
      .from("admin_users")
      .select("id,email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (adminUsersError) {
      console.error("[AdminSupportDashboard] admin_users doğrulanamadı", {
        userId: session.user.id,
        sessionEmail: session.user.email,
        normalizedEmail,
        code: adminUsersError.code,
        message: adminUsersError.message,
      });
      setSession(session);
      setIsAdmin(false);
      return;
    }

    setSession(session);
    setIsAdmin(Boolean(adminRow));
  } catch (e) {
    console.error("[AdminSupportDashboard] reconcileSession beklenmeyen hata", e);
    setSession(null);
    setIsAdmin(false);
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
  /** ticket id → son sohbet satırının created_at ISO */
  const [lastChatAtByTicket, setLastChatAtByTicket] = useState<Record<string, string>>({});
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
      setLastChatAtByTicket({});
      return;
    }
    const tickets = Array.isArray(data) ? (data as SupportMessageRow[]) : [];

    try {
      if (tickets.length) {
        const lastMap = await mergeLastChatTimestamps(client, tickets.map((t) => t.id));
        setLastChatAtByTicket(lastMap);
      } else {
        setLastChatAtByTicket({});
      }
    } catch {
      setLastChatAtByTicket({});
    }

    setRows(tickets);
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
    setLastChatAtByTicket({});
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
    <section className="mx-auto min-h-[70vh] max-w-[min(92rem,calc(100vw-1.25rem))] px-3 pb-32 pt-8 sm:px-4 md:pb-24 md:pt-12">
      <header className="flex flex-col gap-6 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300/78">Admin</p>
          <h1 className="mt-2 flex flex-wrap items-center gap-2.5 text-[1.5rem] font-black tracking-[-0.02em] text-white sm:gap-3 md:text-[1.85rem] xl:text-[2rem]">
            <span className="leading-tight">Kurumsal canlı destek</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/32 bg-slate-950/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-emerald-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16),0_0_32px_-10px_rgba(34,211,238,0.45)] backdrop-blur-xl">
              <span className="livePulse h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              CANLI
            </span>
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-black/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-50/90 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden />
              Temsilci çevrimiçi
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-slate-400 md:text-[13.5px]">
            Gönderilen mesajları incele; kullanıcı adı/e‑posta yalnızca formdan geldiği gibidir — hesap ile
            eşlenmez.
          </p>
          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
            <span className="font-medium text-slate-500">Oturum</span>
            <span className="truncate rounded-md border border-white/[0.06] bg-black/35 px-2 py-0.5 font-mono text-[11px] text-slate-300/95">
              {session.user.email}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:justify-end">
          <div
            role="toolbar"
            aria-label="Durum filtresi"
            className="admin-support-segment flex flex-wrap gap-1 rounded-[0.85rem] border border-white/[0.09] bg-black/45 p-1 backdrop-blur-xl"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={statusFilter === opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`touch-manipulation rounded-[0.62rem] px-3.5 py-2 text-[11.5px] font-bold tracking-tight md:px-4 md:text-[12px] ${
                  statusFilter === opt.value
                    ? "admin-support-segment__btn--active bg-gradient-to-b from-cyan-400/[0.2] to-cyan-600/[0.08] text-cyan-50"
                    : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadMessages()}
            disabled={listLoading}
            className="admin-support-toolbar-outline inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-transparent px-4 py-2.5 text-[12px] font-bold text-cyan-100/95 disabled:pointer-events-none disabled:opacity-55"
          >
            {listLoading ? (
              <>
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-400/35 border-t-cyan-100"
                />
                Yükleniyor
              </>
            ) : (
              "Yenile"
            )}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="admin-support-toolbar-outline min-h-[44px] shrink-0 touch-manipulation rounded-xl border border-rose-500/35 bg-rose-500/[0.04] px-4 py-2.5 text-[12px] font-bold text-rose-100/95 hover:border-rose-400/52"
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
        <p className="mt-10 flex items-center gap-2 text-[13px] text-slate-500">
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-500/40 border-t-cyan-300/80"
          />
          Liste yükleniyor…
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-12 rounded-xl border border-white/[0.08] bg-black/42 px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <p className="text-sm font-medium text-slate-400">Bu filtrede görünecek ileti yok.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-2 md:hidden">
            <div className="rounded-[1rem] border border-white/[0.065] bg-gradient-to-br from-black/52 to-black/38 p-4 text-[11px] leading-relaxed text-slate-500 backdrop-blur-md">
              <p className="font-bold uppercase tracking-[0.14em] text-slate-400">Ziyaretçi bildirimi</p>
              <p className="mt-2">
                Yeni bilette sık görülen:{" "}
                <span className="font-semibold text-slate-400">«Şu anda aktif destek temsilcisi bulunmuyor.»</span>{" "}
                — kabul yazıcısı sen ol.
              </p>
            </div>
            {rows.map((row) => {
              const active = row.id === resolvedListSelectionId;
              const st = rowStatusValue(row.status);
              const lastAct = resolveLastActivityIso(row, lastChatAtByTicket[row.id]);
              const presence = ticketDeskPresenceLabel(row, viewerId);
              return (
                <button
                  key={`m-${row.id}`}
                  type="button"
                  onClick={() => setPickedId(row.id)}
                  className={`admin-support-list-card w-full rounded-[1rem] border border-white/[0.08] bg-gradient-to-br from-black/62 to-black/44 p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${
                    active
                      ? "admin-support-list-card--active border-cyan-400/50 bg-white/[0.08]"
                      : "border-white/[0.065]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${presence.textClass}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${presence.dotClass}`} aria-hidden />
                      <span>{presence.label}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${listStatusBadgeClass(st)}`}
                    >
                      {statusLabel(st)}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-[12.5px] font-semibold text-slate-100/94">
                    {row.name?.trim() || row.email?.trim() || "Kimlik bilgisi yok"}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <time
                      dateTime={lastAct ?? row.created_at}
                      className="rounded-md border border-white/[0.06] bg-black/35 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-400 [font-variant-numeric:tabular-nums]"
                      title={
                        formatMediumIsoTr(lastAct ?? row.created_at ?? undefined) ??
                        ""
                      }
                    >
                      Son: {formatShortRelativeTr(lastAct ?? row.created_at ?? undefined)}
                    </time>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-slate-500">
                    {listMessagePreview(row, viewerId)}
                  </p>
                </button>
              );
            })}
            <div className="pt-2">
              {selectedRow ? (
                <SupportAdminMessageDetail
                  row={selectedRow}
                  viewerState={viewerConversationState(selectedRow, viewerId)}
                  updating={Boolean(updatingIds[selectedRow.id])}
                  onAccept={() => void acceptConversation(selectedRow.id, viewerId, viewerEmail)}
                  onMarkResolved={() => void markConversationResolved(selectedRow.id, viewerId)}
                  supabaseClient={client}
                  viewerEmail={viewerEmail}
                  viewerId={viewerId}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-8 hidden md:grid md:grid-cols-[minmax(260px,min(32vw,340px))_1fr] md:items-start md:gap-6 lg:gap-8 xl:grid-cols-[minmax(280px,360px)_1fr]">
            <div className="flex min-h-0 flex-col gap-5 pr-1.5">
              <aside
                className="admin-support-inbox-scroll max-h-[calc(100vh-14rem)] space-y-1.5 overflow-y-auto overscroll-contain lg:max-h-[calc(100vh-12rem)]"
                aria-label="Mesaj listesi"
              >
                {rows.map((row) => {
                  const active = row.id === resolvedListSelectionId;
                  const st = rowStatusValue(row.status);
                  const lastAct = resolveLastActivityIso(row, lastChatAtByTicket[row.id]);
                  const presence = ticketDeskPresenceLabel(row, viewerId);
                  return (
                    <button
                      key={`d-${row.id}`}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setPickedId(row.id)}
                      className={`admin-support-list-card w-full rounded-[1rem] border border-white/[0.07] bg-gradient-to-br from-black/62 to-black/44 p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${
                        active
                          ? "admin-support-list-card--active border-cyan-400/52 bg-white/[0.09]"
                          : "border-white/[0.055]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide ${presence.textClass}`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${presence.dotClass}`} aria-hidden />
                          <span>{presence.label}</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${listStatusBadgeClass(st)}`}
                        >
                          {statusLabel(st)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[12px] font-semibold tracking-tight text-slate-100/93">
                        {row.name?.trim() || row.email?.trim() || "Kimlik bilgisi yok"}
                      </p>
                      <div className="mt-2">
                        <span
                          className="rounded-md border border-white/[0.066] bg-black/38 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-400 [font-variant-numeric:tabular-nums]"
                          title={formatMediumIsoTr(lastAct ?? row.created_at ?? undefined) ?? ""}
                        >
                          Son aktivite · {formatShortRelativeTr(lastAct ?? row.created_at ?? undefined)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-slate-500">
                        {listMessagePreview(row, viewerId)}
                      </p>
                    </button>
                  );
                })}
              </aside>
              <div
                className="rounded-[1rem] border border-white/[0.065] bg-gradient-to-br from-black/55 to-black/35 p-4 text-[11px] leading-relaxed text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl"
                aria-label="Masaya not"
              >
                <p className="font-bold uppercase tracking-[0.16em] text-slate-400">Ziyaretçi bildirimi</p>
                <p className="mt-2 text-slate-500">
                  Bekleyen biletlerde site tarafında{" "}
                  <span className="font-semibold text-slate-400">
                    «Şu anda aktif destek temsilcisi bulunmuyor.»
                  </span>{" "}
                  benzeri mesaj sık görülür — görüşmeyi üstlenerek sıcak bağ kur.
                </p>
              </div>
            </div>
            <div className="flex min-h-0 flex-col md:sticky md:top-5 lg:top-7">
              {selectedRow ? (
                <SupportAdminMessageDetail
                  row={selectedRow}
                  viewerState={viewerConversationState(selectedRow, viewerId)}
                  updating={Boolean(updatingIds[selectedRow.id])}
                  onAccept={() => void acceptConversation(selectedRow.id, viewerId, viewerEmail)}
                  onMarkResolved={() => void markConversationResolved(selectedRow.id, viewerId)}
                  supabaseClient={client}
                  viewerEmail={viewerEmail}
                  viewerId={viewerId}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
