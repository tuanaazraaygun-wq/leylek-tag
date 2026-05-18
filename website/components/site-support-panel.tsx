"use client";

import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSiteAuth } from "@/components/site-auth-provider";
import { getSupabaseTicketChatClient } from "@/lib/support-chat-client";
import {
  SUPPORT_ADMIN_TYPING_EVENT,
  SUPPORT_USER_TYPING_EVENT,
} from "@/lib/support-typing-realtime";
import {
  newRealtimeInstanceId,
  subscribeSiteTicketSupportPostgresRealtime,
  subscribeSupportTypingBroadcastBridge,
} from "@/lib/support-chat-realtime-subscribe";
import { SUPPORT_EMAIL } from "@/lib/site-contact";
import {
  clearStoredSupportTicket,
  readStoredSupportTicket,
  writeStoredSupportTicket,
} from "@/lib/support-ticket-storage";
import { isSupabaseConfigured } from "@/lib/supabase-client";

const MESSAGE_MIN_LEN = 10;
const CHAT_MESSAGE_MIN_LEN = 1;
const SUBMIT_COOLDOWN_MS = 36_000;
const USER_AGENT_MAX = 512;

/** Karşılama balonunda sabit sistem metni (AI iddiası yok). */
const LIVE_SUPPORT_WELCOME =
  "Merhaba, Leylek TAG kurumsal canlı destek hattına hoş geldin. Konunu kısaca yazabilirsin; bir temsilci bağlandığında yanıtlar bu akışta görünür.";

type SupportTicketMetaRow = {
  id: string;
  status: string;
  assigned_admin_id: string | null;
};

type SupportChatRow = {
  id: string;
  support_message_id: string;
  sender_type: string;
  sender_email: string | null;
  body: string;
  created_at: string;
};

type PanelView = "composer" | "thread";

/** AI replies must remain server-side only. */

function mapSupportMessageInsertFeedback(error: {
  code?: string;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): string {
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  const code = error.code ?? "";

  const tableLikelyMissing =
    code === "42P01" ||
    code === "42703" ||
    code.startsWith("PGRST205") ||
    code.startsWith("PGRST302") ||
    /schema cache/i.test(msg) ||
    /\bcould not find the table\b/i.test(msg) ||
    /\brelation\b.*\bsupport_messages\b.*\bdoes not exist\b/i.test(msg) ||
    /\bdoes not exist\b.*\bsupport_messages\b/i.test(msg) ||
    /\b(column|could not find (the )?relation)\b.*\bsupport_messages\b/i.test(msg);

  if (tableLikelyMissing) return "Destek sistemi henüz yapılandırılmamış.";

  const permissionLikely =
    code === "42501" ||
    /permission denied|new row violates row-level security|violates row-level security|\brls\b/i.test(msg);

  if (permissionLikely) return "Mesaj kaydedilemedi. Yetki ayarları kontrol edilmeli.";

  if (
    code === "23514" ||
    msg.includes("violates check constraint") ||
    msg.includes("check constraint")
  ) {
    return `Mesaj en az ${MESSAGE_MIN_LEN} karakter olmalı.`;
  }

  return "Bir şeyler ters gitti. Lütfen tekrar dene.";
}

function SupportLeylekBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-cyan-400/35 bg-gradient-to-br from-cyan-500/[0.16] via-cyan-400/[0.08] to-slate-900/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-50/96 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.22),0_6px_20px_-8px_rgba(34,211,238,0.35)] ${className}`}
    >
      Leylek Zeka
    </span>
  );
}

function SupportLiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/32 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-100/94 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)]">
      <span className="livePulse h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
      Canlı destek
    </span>
  );
}

function SupportHeadsetGlyph({ className = "h-[1.125rem] w-[1.125rem]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M5 13.5v3a2 2 0 0 0 2 2h1v-8H7a2 2 0 0 0-2 2v1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        className="text-cyan-300/92"
      />
      <path
        d="M19 13.5v3a2 2 0 0 1-2 2h-1v-8h1a2 2 0 0 1 2 2v1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        className="text-cyan-300/92"
      />
      <path
        d="M7 17.5V18a5 5 0 1 0 10 0v-.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="text-cyan-200/82"
      />
      <path
        d="M9 11.75a3.25 3.25 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** Temsilci mesajı gelene kadar gösterilen kurumsal bekleme metni */
const LIVE_SUPPORT_QUEUE_COPY = `Canlı destek ekibimiz talebinizi aldı.
Kısa süre içinde bir temsilci görüşmeye katılacaktır.
Bu pencereyi kapatmadan bekleyebilir veya e-posta ile dönüş talep edebilirsiniz.`;

function trimRowStatus(raw: string | null | undefined): string {
  return raw?.trim()?.toLowerCase() ?? "";
}

function formatChatTimeTr(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const t = new Date(iso).getTime();
  return Number.isNaN(t)
    ? ""
    : new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function mergeSiteChatRowSorted(prev: SupportChatRow[], incoming: SupportChatRow): SupportChatRow[] {
  if (prev.some((r) => r.id === incoming.id)) return prev;
  return [...prev, incoming].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

type FormStatus = "idle" | "loading" | "error";

type ThreadSnap = { ok: true; meta: SupportTicketMetaRow } | { ok: false };

function SiteSupportGateGoogleGlyph({ className = "h-5 w-5" }: { className?: string }) {
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

function SupportLockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/[0.1] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-100/92 ${className}`}
    >
      <svg className="h-3 w-3 text-amber-200/95" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
      Giriş gerekli
    </span>
  );
}

export function SiteSupportPanel() {
  const pathname = usePathname();
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const { authReady, session, profile, oauthBusy, signInWithGoogle } = useSiteAuth();

  const sessionContactEmail = useMemo(
    () => session?.user?.email?.trim().toLowerCase() ?? "",
    [session?.user?.email],
  );

  const supportUnlocked = Boolean(configured && authReady && session?.user?.id && sessionContactEmail);
  const honeyId = useId();
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  const [open, setOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>("composer");
  const [threadBootstrap, setThreadBootstrap] = useState(false);

  const [ticketMeta, setTicketMeta] = useState<SupportTicketMetaRow | null>(null);
  const [supportClientToken, setSupportClientToken] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  const [chatLines, setChatLines] = useState<SupportChatRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatBanner, setChatBanner] = useState<string | null>(null);
  const [adminTypingPeek, setAdminTypingPeek] = useState(false);
  const [postgresRepairKey, setPostgresRepairKey] = useState(0);
  const [typingBridgeRepairKey, setTypingBridgeRepairKey] = useState(0);
  const [typingBridgeSendReady, setTypingBridgeSendReady] = useState(false);

  const chatScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const knownChatIdsRef = useRef<Set<string>>(new Set());
  const typingBridgeSendOnlyRef = useRef<RealtimeChannel | null>(null);
  const typingBurstRef = useRef(0);
  const adminTypingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRetryAttemptsRef = useRef(0);
  const realtimeRepairTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBridgeRepairTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Gönder sonrası bekleme bitiş zamanı (ms epoch); 0 = soğuma yok */
  const cooldownEndsAtRef = useRef(0);
  const [cooldownSession, bumpCooldownSession] = useState(0);
  const [cooldownRemainSec, setCooldownRemainSec] = useState(0);

  const scrollChatToBottom = useCallback(() => {
    chatScrollAnchorRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatLines, adminTypingPeek, chatSending, scrollChatToBottom]);

  useEffect(() => {
    const endAt = cooldownEndsAtRef.current;
    if (!endAt) {
      setCooldownRemainSec(0);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setCooldownRemainSec(left);
      if (left <= 0) cooldownEndsAtRef.current = 0;
    };
    tick();
    const id = window.setInterval(tick, 450);
    return () => window.clearInterval(id);
  }, [cooldownSession]);

  const cooldownActiveForUi = cooldownRemainSec > 0;

  const bumpAdminTyping = useCallback(() => {
    setAdminTypingPeek(true);
    if (adminTypingHideRef.current) clearTimeout(adminTypingHideRef.current);
    adminTypingHideRef.current = setTimeout(() => {
      setAdminTypingPeek(false);
      adminTypingHideRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (adminTypingHideRef.current) clearTimeout(adminTypingHideRef.current);
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      if (typingBridgeRepairTimerRef.current) clearTimeout(typingBridgeRepairTimerRef.current);
    };
  }, []);

  const realtimeTicketId = ticketMeta?.id ?? null;

  useEffect(() => {
    realtimeRetryAttemptsRef.current = 0;
    typingBridgeSendOnlyRef.current = null;
    queueMicrotask(() => {
      setPostgresRepairKey(0);
      setTypingBridgeRepairKey(0);
      setTypingBridgeSendReady(false);
      setAdminTypingPeek(false);
    });
  }, [realtimeTicketId, supportClientToken]);

  const closePanel = useCallback(() => setOpen(false), []);

  const resetComposerOnly = useCallback(() => {
    setStatus("idle");
    setFeedback(null);
    setMessage("");
    if (configured && authReady) {
      const nameHint = profile?.full_name?.trim() ?? "";
      queueMicrotask(() => {
        setName((p) => (p.trim() === "" ? nameHint : p));
      });
    }
  }, [authReady, configured, profile?.full_name]);

  const leaveThreadClearStorage = useCallback(() => {
    clearStoredSupportTicket();
    setSupportClientToken(null);
    setTicketMeta(null);
    setChatLines([]);
    knownChatIdsRef.current = new Set();
    setChatInput("");
    setChatBanner(null);
    setAdminTypingPeek(false);
    setPanelView("composer");
    resetComposerOnly();
  }, [resetComposerOnly]);

  /** Girişsiz dönemden kalan bilet anahtarını diskten sil (state döngüsü yok). */
  useEffect(() => {
    if (!configured || !authReady) return;
    if (session?.user?.id) return;
    clearStoredSupportTicket();
  }, [configured, authReady, session?.user?.id]);

  const prevSessionUidRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const uid = session?.user?.id;
    const prev = prevSessionUidRef.current;
    prevSessionUidRef.current = uid;
    if (prev && !uid) {
      leaveThreadClearStorage();
    }
  }, [session?.user?.id, leaveThreadClearStorage]);

  const togglePanel = useCallback(() => {
    setOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen && configured && authReady) {
        const nameHint = profile?.full_name?.trim() ?? "";
        queueMicrotask(() => {
          setName((p) => (p.trim() === "" ? nameHint : p));
        });
      }
      return nextOpen;
    });
  }, [authReady, configured, profile?.full_name]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [closePanel]);

  const fetchThreadSnapshot = useCallback(
    async (ticketId: string, tokenForHeader: string): Promise<ThreadSnap> => {
      const tc = getSupabaseTicketChatClient(tokenForHeader);
      if (!tc) return { ok: false };

      const [{ data: meta, error: metaErr }, { data: lines, error: linesErr }] = await Promise.all([
        tc
          .from("support_messages")
          .select("id,status,assigned_admin_id")
          .eq("id", ticketId)
          .maybeSingle(),
        tc
          .from("support_chat_messages")
          .select("id,support_message_id,sender_type,sender_email,body,created_at")
          .eq("support_message_id", ticketId)
          .order("created_at", { ascending: true }),
      ]);

      if (metaErr || !meta) return { ok: false };

      const nextChat = Array.isArray(lines) && !linesErr ? (lines as SupportChatRow[]) : [];
      const metaRow = meta as SupportTicketMetaRow;

      setSupportClientToken(tokenForHeader.trim().toLowerCase());
      setTicketMeta(metaRow);

      knownChatIdsRef.current = new Set(nextChat.map((r) => r.id));
      setChatLines(nextChat);
      setPanelView("thread");
      return { ok: true, meta: metaRow };
    },
    [],
  );

  const pollTicketChatMessages = useCallback(async (ticketId: string, tokenForHeader: string) => {
    const tc = getSupabaseTicketChatClient(tokenForHeader);
    if (!tc) return;

    const { data, error } = await tc
      .from("support_chat_messages")
      .select("id,support_message_id,sender_type,sender_email,body,created_at")
      .eq("support_message_id", ticketId)
      .order("created_at", { ascending: true });

    if (error || !Array.isArray(data)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[SiteSupportPanel] poll support_chat_messages:", error?.message ?? "no data");
      }
      return;
    }

    const next = data as SupportChatRow[];
    knownChatIdsRef.current = new Set(next.map((r) => r.id));
    setChatLines(next);
  }, []);

  useEffect(() => {
    if (!open || !configured || !supportUnlocked) return undefined;

    let cancelled = false;

    async function hydrateFromStorage() {
      const stored = readStoredSupportTicket();
      if (!stored) return;

      setThreadBootstrap(true);
      try {
        const snap = await fetchThreadSnapshot(stored.ticketId, stored.clientToken);
        if (!snap.ok && !cancelled) clearStoredSupportTicket();
      } finally {
        if (!cancelled) setThreadBootstrap(false);
      }
    }

    void hydrateFromStorage();
    return () => {
      cancelled = true;
    };
  }, [open, configured, supportUnlocked, fetchThreadSnapshot]);

  useEffect(() => {
    const tk = supportClientToken?.trim() ?? "";
    if (!open || !configured || !realtimeTicketId || !tk || !supportUnlocked) return undefined;

    const tc = getSupabaseTicketChatClient(tk);
    if (!tc) return undefined;

    let mounted = true;
    const instanceId = newRealtimeInstanceId();

    const scheduleRepair = () => {
      if (!mounted) return;
      realtimeRetryAttemptsRef.current += 1;
      const n = realtimeRetryAttemptsRef.current;
      if (n > 8) return;
      const delayMs = Math.min(30_000, 900 * 1.45 ** Math.min(n - 1, 12));
      if (process.env.NODE_ENV !== "production" && (n === 1 || n % 3 === 0)) {
        console.warn("[SiteSupportPanel] postgres realtime repair scheduled", {
          ticketId: realtimeTicketId,
          n,
          delayMs,
        });
      }
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      realtimeRepairTimerRef.current = setTimeout(() => {
        realtimeRepairTimerRef.current = null;
        if (mounted) setPostgresRepairKey((v) => v + 1);
      }, delayMs);
    };

    const pgChannel = subscribeSiteTicketSupportPostgresRealtime({
      client: tc,
      ticketId: realtimeTicketId,
      instanceId,
      onChatInsert(payload) {
        if (!mounted) return;
        try {
          const row = payload as unknown as SupportChatRow;
          if (!row?.id) return;
          setChatLines((prev) => mergeSiteChatRowSorted(prev, row));
        } catch {
          /* ignore */
        }
      },
      onTicketMetaUpdate(payload) {
        if (!mounted) return;
        try {
          const nw = payload as unknown as SupportTicketMetaRow;
          setTicketMeta(nw);
        } catch {
          /* ignore */
        }
      },
      onChannelStatus(status, err) {
        if (!mounted) return;
        if (status === "SUBSCRIBED") {
          realtimeRetryAttemptsRef.current = 0;
          return;
        }
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production" && err) {
          console.warn("[SiteSupportPanel] postgres channel warning", (err as Error)?.message ?? err);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleRepair();
        }
      },
    });

    return () => {
      mounted = false;
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      realtimeRepairTimerRef.current = null;
      void tc.removeChannel(pgChannel);
    };
  }, [configured, open, realtimeTicketId, supportClientToken, postgresRepairKey, supportUnlocked]);

  /** Realtime yetersiz kalırsa (WS / header): panel açıkken hafif yedek yükleme. */
  useEffect(() => {
    const tk = supportClientToken?.trim() ?? "";
    const tid = realtimeTicketId;
    if (!open || !configured || !tid || !tk || !supportUnlocked) return undefined;
    const id = window.setInterval(() => {
      void pollTicketChatMessages(tid, tk);
    }, 4400);
    return () => clearInterval(id);
  }, [
    open,
    configured,
    realtimeTicketId,
    supportClientToken,
    supportUnlocked,
    pollTicketChatMessages,
  ]);

  useEffect(() => {
    const tk = supportClientToken?.trim() ?? "";
    if (!open || !configured || !realtimeTicketId || !tk || !supportUnlocked) return undefined;

    const tc = getSupabaseTicketChatClient(tk);
    if (!tc) return undefined;

    let mounted = true;
    typingBridgeSendOnlyRef.current = null;
    queueMicrotask(() => setTypingBridgeSendReady(false));

    const scheduleTypingBridgeRepair = () => {
      if (!mounted) return;
      queueMicrotask(() => setTypingBridgeSendReady(false));
      if (typingBridgeRepairTimerRef.current) clearTimeout(typingBridgeRepairTimerRef.current);
      typingBridgeRepairTimerRef.current = setTimeout(() => {
        typingBridgeRepairTimerRef.current = null;
        if (mounted) setTypingBridgeRepairKey((v) => v + 1);
      }, 1500);
    };

    const bridgeChannel = subscribeSupportTypingBroadcastBridge({
      client: tc,
      ticketId: realtimeTicketId,
      incomingEvent: SUPPORT_ADMIN_TYPING_EVENT,
      onIncoming: () => {
        if (mounted) bumpAdminTyping();
      },
      onSubscribedReady(sendCh) {
        if (!mounted) return;
        typingBridgeSendOnlyRef.current = sendCh;
        setTypingBridgeSendReady(true);
      },
      onChannelStatus(status, err) {
        if (!mounted) return;
        if (status === "SUBSCRIBED") return;
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production" && err) {
          console.warn("[SiteSupportPanel] typing bridge warning", (err as Error)?.message ?? err);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleTypingBridgeRepair();
        }
      },
    });

    return () => {
      mounted = false;
      typingBridgeSendOnlyRef.current = null;
      if (typingBridgeRepairTimerRef.current) clearTimeout(typingBridgeRepairTimerRef.current);
      typingBridgeRepairTimerRef.current = null;
      queueMicrotask(() => setTypingBridgeSendReady(false));
      void tc.removeChannel(bridgeChannel);
    };
  }, [
    configured,
    open,
    realtimeTicketId,
    supportClientToken,
    supportUnlocked,
    bumpAdminTyping,
    typingBridgeRepairKey,
  ]);

  useEffect(() => {
    if (!typingBridgeSendReady || !open || realtimeTicketId == null) return undefined;
    const sendCh = typingBridgeSendOnlyRef.current;
    if (!sendCh) return undefined;
    const trimmed = chatInput.trim();
    if (trimmed.length < 1) return undefined;

    typingBurstRef.current += 1;
    const burst = typingBurstRef.current;
    const t = window.setTimeout(() => {
      if (burst !== typingBurstRef.current) return;
      void sendCh
        .send({
          type: "broadcast",
          event: SUPPORT_USER_TYPING_EVENT,
          payload: { at: Date.now() },
        })
        .catch(() => {});
    }, 700);
    return () => window.clearTimeout(t);
  }, [chatInput, typingBridgeSendReady, open, realtimeTicketId]);

  const mergeChatBootstrap = useCallback((rows: SupportChatRow[]) => {
    setChatLines(rows);
    const s = knownChatIdsRef.current;
    s.clear();
    rows.forEach((r) => s.add(r.id));
  }, []);

  const validateComposer = useCallback(() => {
    const m = message.trim();
    if (m.length < MESSAGE_MIN_LEN) {
      setFeedback(`Mesaj en az ${MESSAGE_MIN_LEN} karakter olmalı.`);
      return false;
    }
    setFeedback(null);
    return true;
  }, [message]);

  const handleComposerSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFeedback(null);
      setChatBanner(null);

      if (honey.trim() !== "") return;

      if (!supportUnlocked || !sessionContactEmail) {
        setFeedback("Canlı destek için önce giriş yapın.");
        setStatus("error");
        return;
      }

      if (cooldownEndsAtRef.current > Date.now()) {
        setFeedback("Lütfen bir süre bekleyip tekrar dene.");
        setStatus("error");
        return;
      }

      const storedActive = readStoredSupportTicket();
      if (storedActive) {
        setThreadBootstrap(true);
        try {
          const snap = await fetchThreadSnapshot(storedActive.ticketId, storedActive.clientToken);
          if (snap.ok) {
            setFeedback("Bu tarayıcıda açık bir görüşmen var.");
            setStatus("idle");
            return;
          }
          clearStoredSupportTicket();
        } finally {
          setThreadBootstrap(false);
        }
      }

      if (!validateComposer()) {
        setStatus("error");
        return;
      }

      if (!configured) {
        setFeedback("Destek sistemi henüz yapılandırılmamış.");
        setStatus("error");
        return;
      }

      const clientTokenHeader = crypto.randomUUID();
      const ticketClient = getSupabaseTicketChatClient(clientTokenHeader);
      if (!ticketClient) {
        setFeedback("Destek sistemi henüz yapılandırılmamış.");
        setStatus("error");
        return;
      }

      setStatus("loading");

      const payload = {
        name: name.trim() || null,
        email: sessionContactEmail,
        message: message.trim(),
        page_path: pathname ?? null,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, USER_AGENT_MAX) : null,
        source: "website",
        status: "new",
        client_token: clientTokenHeader.toLowerCase(),
      };

      try {
        const { data: created, error: createErr } = await ticketClient
          .from("support_messages")
          .insert(payload)
          .select("id, client_token")
          .single();

        if (createErr || !created?.id || !created.client_token?.trim()) {
          setStatus("error");
          setFeedback(mapSupportMessageInsertFeedback(createErr ?? { message: "" }));
          return;
        }

        const tokenNormalized = created.client_token.trim().toLowerCase();
        /** Token insert sonrası aynı header ile yükle — cache anahtarı eşlesin */
        const ticketClientReturning = getSupabaseTicketChatClient(tokenNormalized);

        const { error: chatErr } = await ticketClientReturning!
          .from("support_chat_messages")
          .insert({
            support_message_id: created.id,
            sender_type: "user",
            sender_email: sessionContactEmail,
            body: message.trim(),
          })
          .select("id,support_message_id,sender_type,sender_email,body,created_at")
          .maybeSingle();

        if (chatErr) {
          setStatus("error");
          setFeedback("Ticket oluştu ancak sohbet satırı kaydedilemedi. Yeniden dene.");
          return;
        }

        writeStoredSupportTicket(created.id, tokenNormalized);
        setSupportClientToken(tokenNormalized);

        cooldownEndsAtRef.current = Date.now() + SUBMIT_COOLDOWN_MS;
        bumpCooldownSession((n) => n + 1);

        const { data: lines } = await ticketClientReturning!
          .from("support_chat_messages")
          .select("id,support_message_id,sender_type,sender_email,body,created_at")
          .eq("support_message_id", created.id)
          .order("created_at", { ascending: true });

        mergeChatBootstrap(Array.isArray(lines) ? (lines as SupportChatRow[]) : []);

        const { data: meta } = await ticketClientReturning!
          .from("support_messages")
          .select("id,status,assigned_admin_id")
          .eq("id", created.id)
          .maybeSingle();

        if (meta) setTicketMeta(meta as SupportTicketMetaRow);

        setPanelView("thread");
        setStatus("idle");
        setName("");
        setMessage("");
        setFeedback(null);
      } catch {
        setStatus("error");
        setFeedback("Bir şeyler ters gitti. Lütfen tekrar dene.");
      }
    },
    [
      configured,
      fetchThreadSnapshot,
      honey,
      message,
      mergeChatBootstrap,
      name,
      pathname,
      sessionContactEmail,
      supportUnlocked,
      validateComposer,
    ],
  );

  const handleSendChat = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);

      const body = chatInput.trim();
      if (body.length < CHAT_MESSAGE_MIN_LEN) {
        setChatBanner("Mesaj yaz.");
        return;
      }

      const ticketId = ticketMeta?.id;
      const tk = supportClientToken?.trim();

      const stResolved = trimRowStatus(ticketMeta?.status) === "resolved";
      if (!supportUnlocked || !sessionContactEmail || !ticketId || !tk || stResolved || chatSending)
        return;

      const tc = getSupabaseTicketChatClient(tk);
      if (!tc) return;

      setChatSending(true);
      try {
        const { data, error } = await tc
          .from("support_chat_messages")
          .insert({
            support_message_id: ticketId,
            sender_type: "user",
            sender_email: sessionContactEmail,
            body,
          })
          .select("id,support_message_id,sender_type,sender_email,body,created_at")
          .maybeSingle();

        if (error || !data) {
          setChatBanner("Mesaj gönderilemedi. Bağlantıyı kontrol et.");
          return;
        }

        setChatLines((prev) => (prev.some((r) => r.id === data.id) ? prev : [...prev, data as SupportChatRow]));
        setChatInput("");
      } finally {
        setChatSending(false);
      }
    },
    [chatInput, chatSending, sessionContactEmail, supportClientToken, supportUnlocked, ticketMeta],
  );

  const onNewConversationClick = useCallback(async () => {
    setFeedback(null);
    setChatBanner(null);

    const stored = readStoredSupportTicket();

    /** Thread yoksa sadece yeni bileti formdan doldurmak için */
    if (!stored?.ticketId) {
      resetComposerOnly();
      setPanelView("composer");
      return;
    }

    setThreadBootstrap(true);
    try {
      const snap = await fetchThreadSnapshot(stored.ticketId, stored.clientToken);
      if (!snap.ok) {
        clearStoredSupportTicket();
        leaveThreadClearStorage();
        return;
      }

      if (trimRowStatus(snap.meta.status) === "resolved") {
        leaveThreadClearStorage();
        setFeedback(null);
      } else {
        setFeedback("Bu görüşme hâlâ açık. Mesajların aşağıda.");
      }
    } finally {
      setThreadBootstrap(false);
    }
  }, [fetchThreadSnapshot, leaveThreadClearStorage, resetComposerOnly]);

  const resolvedStatus =
    trimRowStatus(ticketMeta?.status) === "resolved";

  const hasAdminReplyInThread = useMemo(
    () => chatLines.some((ln) => (ln.sender_type ?? "").trim().toLowerCase() === "admin"),
    [chatLines],
  );

  const hasAssignedAdmin = Boolean((ticketMeta?.assigned_admin_id ?? "").trim().length > 0);
  const queueStatusPrimary =
    resolvedStatus || hasAdminReplyInThread
      ? "Görüşme aktif — Destek Ekibi yanıtları aşağıdaki akışta."
      : hasAssignedAdmin
        ? "Temsilci görüşmeye dahil oldu; ilk mesajlar yükleniyor."
        : "Talebiniz alındı; canlı destek ekibi temsilci ataması yapıyor.";

  return (
    <div className="fixed bottom-[calc(5.35rem+env(safe-area-inset-bottom,0px))] right-4 z-[72] flex w-[calc(100%-2rem)] max-w-[min(26rem,calc(100vw-2rem))] flex-col items-end md:bottom-8 md:right-8 md:w-auto md:max-w-none">
      {open ? (
        <>
          <button
            type="button"
            aria-label="Panoyu kapat"
            onClick={closePanel}
            className="fixed inset-0 z-[71] bg-black/45 backdrop-blur-[3px]"
          />

          <div
            role="dialog"
            id={dialogId}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="relative z-[73] mb-3 flex max-h-[min(42rem,calc(100vh-5rem))] w-full max-w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.11] bg-slate-950/[0.94] shadow-[0_28px_90px_-28px_rgba(0,114,255,0.52),0_0_56px_-12px_rgba(34,211,238,0.24),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-400/[0.12] backdrop-blur-2xl"
          >
            <div
              className="pointer-events-none absolute inset-px rounded-[1.1875rem] bg-[linear-gradient(155deg,rgba(34,211,238,0.07)_0%,transparent_42%,rgba(108,99,255,0.06)_100%)] opacity-95"
              aria-hidden
            />

            {!configured ? (
              <div className="relative p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    id={titleId}
                    className="text-lg font-black leading-snug tracking-tight text-white"
                  >
                    Leylek TAG Canlı Destek
                  </p>
                  <SupportLiveBadge />
                </div>
                <p id={descId} className="mt-3 text-[13px] leading-relaxed text-slate-400">
                  Canlı bağlantı yapılandırılmadığında ekibimize güvenli biçimde e‑posta ile ulaşabilirsin.
                </p>
                <Link
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG destek · geri bildirim")}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/45"
                >
                  E‑posta ile yaz
                </Link>
                <button
                  type="button"
                  onClick={closePanel}
                  className="mt-3 w-full rounded-xl px-4 py-2 text-center text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
                >
                  Kapat
                </button>
              </div>
            ) : !authReady ? (
              <div className="relative p-8 sm:p-10">
                <p id={titleId} className="text-lg font-bold tracking-tight text-white">
                  Canlı Destek
                </p>
                <p id={descId} className="mt-3 text-[13px] leading-relaxed text-slate-500">
                  Oturum bilgisi kontrol ediliyor…
                </p>
                <div
                  aria-busy="true"
                  className="mt-6 mx-auto flex h-9 w-9 animate-spin rounded-full border-2 border-white/18 border-t-slate-200"
                />
              </div>
            ) : !session ? (
              <div className="relative px-6 py-8 sm:px-8 sm:py-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p id={titleId} className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                      Canlı destek için giriş yapın
                    </p>
                    <SupportLockBadge className="mt-3" />
                  </div>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-white/15 hover:text-slate-200"
                  >
                    Kapat
                  </button>
                </div>
                <p id={descId} className="mt-4 text-[13px] leading-relaxed text-slate-400">
                  Görüşmelerinizin güvenliği ve size doğru dönüş yapılabilmesi için canlı desteğe giriş
                  yaptıktan sonra bağlanabilirsiniz.
                </p>
                <p className="mt-5 text-[12px] leading-relaxed text-slate-500">
                  Şu anda <span className="font-semibold text-slate-400">Google ile giriş</span> kullanılmaktadır.
                  Gmail / Google Workspace hesapları desteklenir.
                </p>

                <div className="mt-7 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={oauthBusy}
                    aria-busy={oauthBusy}
                    onClick={() => void signInWithGoogle()}
                    className="relative inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-white/[0.12] bg-gradient-to-br from-white/[0.09] to-white/[0.03] px-4 py-3 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition hover:border-white/20 hover:from-white/[0.11] hover:to-white/[0.04] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <SiteSupportGateGoogleGlyph className="h-5 w-5 shrink-0" />
                    {oauthBusy ? "Yönlendiriliyor…" : "Google ile giriş yap"}
                  </button>

                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex min-h-[48px] w-full cursor-not-allowed touch-manipulation items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[13px] font-medium text-slate-500 opacity-85"
                  >
                    Apple ile giriş yakında
                  </button>
                </div>

                <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-600">
                  Apple ile giriş yakında etkinleşecek — App Store doğrulamalarına uygun şekilde
                  yayınlanacaktır.
                </p>

                <Link
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG Canlı Destek")}`}
                  className="mt-4 block py-2 text-center text-[11px] font-medium text-slate-500 underline-offset-4 transition hover:text-slate-400 hover:underline"
                >
                  Hesabın yok mu? E‑posta ile yaz
                </Link>
              </div>
            ) : session && !sessionContactEmail ? (
              <div className="relative px-6 py-8 sm:px-8 sm:py-10">
                <p id={titleId} className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  E‑posta gerekiyor
                </p>
                <p id={descId} className="mt-4 text-[13px] leading-relaxed text-slate-400">
                  Hesabınızda görünen bir e‑posta adresi olmadığı için canlı destek kaydı oluşturulamıyor.
                  Lütfen Google hesabınızda bir e‑posta doğrulayın veya e‑posta ile bize yazın.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 text-[13px] font-semibold text-white transition hover:border-white/18"
                  >
                    Kapat
                  </button>
                  <Link
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG destek · e-posta yok")}`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/[0.08] px-4 text-center text-[13px] font-semibold text-slate-400 transition hover:text-slate-200"
                  >
                    E‑posta ile yaz
                  </Link>
                </div>
              </div>
            ) : panelView === "thread" && ticketMeta?.id ? (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 border-b border-white/[0.07] px-4 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4 md:px-6">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <p
                        id={titleId}
                        className="text-[0.95rem] font-black leading-tight tracking-tight text-white sm:text-lg"
                      >
                        Leylek TAG Canlı Destek
                      </p>
                      {!resolvedStatus ? (
                        <>
                          <p
                            id={descId}
                            className="mt-2 text-[12px] font-semibold leading-snug text-cyan-100/88"
                          >
                            {queueStatusPrimary}
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                            {hasAdminReplyInThread
                              ? "Bu pencereden ekibimizle yazışmaya devam edebilirsiniz."
                              : "Durumunuzu bu pencereden takip edebilir; yanıtlar kayıt altına alınır."}
                          </p>
                        </>
                      ) : (
                        <p
                          id={descId}
                          className="mt-2 text-[12px] font-semibold leading-snug text-amber-200/90"
                        >
                          Bu görüşme çözüldü olarak kapandı. Yeni sorun için aşağıdan yeni görüşme
                          başlatabilirsin.
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SupportLiveBadge />
                        <SupportLeylekBadge />
                        <span
                          className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"
                          title="Deneysel"
                        >
                          Beta
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 transition hover:border-cyan-400/25 hover:text-slate-200"
                    >
                      Kapat
                    </button>
                  </div>
                </div>

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-3 md:px-5">
                  <div className="flex min-w-0 flex-col gap-2 pb-1.5 sm:gap-2.5">
                    {threadBootstrap ? (
                      <p className="text-[12px] text-slate-500">Senkronize ediliyor…</p>
                    ) : null}

                    <div className="rounded-xl rounded-tl-sm border border-cyan-400/26 bg-[linear-gradient(148deg,rgba(34,211,238,0.12)_0%,rgba(15,23,42,0.88)_48%,rgba(8,47,73,0.55)_100%)] px-3 py-2.5 shadow-[0_0_24px_-10px_rgba(34,211,238,0.3),inset_0_0_0_1px_rgba(103,232,249,0.12)] backdrop-blur-md sm:rounded-2xl sm:px-3.5 sm:py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/78">
                        Destek karşılaması
                      </p>
                      <p className="mt-2 break-words text-[13px] leading-relaxed text-slate-50/96">
                        {LIVE_SUPPORT_WELCOME}
                      </p>
                    </div>

                    {!resolvedStatus && !hasAdminReplyInThread && !hasAssignedAdmin ? (
                      <div className="max-w-[min(100%,21rem)] self-start rounded-xl rounded-tl-sm border border-cyan-400/22 bg-[linear-gradient(148deg,rgba(34,211,238,0.08)_0%,rgba(15,23,42,0.75)_55%)] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.1)] backdrop-blur-sm sm:rounded-2xl sm:px-3.5 sm:py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/78">
                          Beklemede
                        </p>
                        <p className="mt-2 whitespace-pre-line break-words text-[12.5px] font-medium leading-relaxed text-slate-200/95">
                          {LIVE_SUPPORT_QUEUE_COPY}
                        </p>
                      </div>
                    ) : null}
                    {!resolvedStatus && !hasAdminReplyInThread && hasAssignedAdmin ? (
                      <div className="max-w-[min(100%,21rem)] self-start rounded-xl rounded-tl-sm border border-emerald-400/26 bg-emerald-500/[0.08] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)] backdrop-blur-sm sm:rounded-2xl sm:px-3.5 sm:py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/88">
                          Temsilci
                        </p>
                        <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-emerald-50/93">
                          Görüşmeye bağlanıldı; karşılama ve yanıtlar kısa süre içinde akışta görünür.
                        </p>
                      </div>
                    ) : null}
                    {chatLines.map((ln) => {
                      const sender = ln.sender_type?.trim()?.toLowerCase() ?? "";
                      const timeLabel = formatChatTimeTr(ln.created_at);

                      const baseWrap =
                        "max-w-[min(100%,18.5rem)] break-words rounded-xl border px-2.5 py-2 text-[13px] leading-snug shadow-sm backdrop-blur-sm sm:rounded-2xl sm:px-3 sm:py-2";

                      if (sender === "system") {
                        return (
                          <div
                            key={ln.id}
                            className={`mx-auto ${baseWrap} max-w-[min(96%,24rem)] self-center border-amber-400/32 bg-gradient-to-br from-amber-500/[0.12] to-black/55 text-center text-amber-50/95 ring-1 ring-amber-400/15`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200/85">
                              Sistem
                            </span>
                            <div className="mt-1.5 text-[12px] font-medium whitespace-pre-wrap leading-snug">{ln.body}</div>
                            {timeLabel ? (
                              <time
                                className="mt-1.5 block font-mono text-[10px] font-medium tabular-nums text-amber-100/55"
                                dateTime={ln.created_at}
                              >
                                {timeLabel}
                              </time>
                            ) : null}
                          </div>
                        );
                      }

                      if (sender === "admin") {
                        return (
                          <div
                            key={ln.id}
                            className={`${baseWrap} max-w-[min(100%,18.5rem)] self-end rounded-tr-sm border-cyan-400/35 bg-gradient-to-br from-cyan-600/22 to-slate-950/85 text-slate-50 ring-1 ring-cyan-400/12 sm:rounded-tr-md`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100/92">
                              Destek Ekibi
                            </span>
                            <div className="mt-1 whitespace-pre-wrap">{ln.body}</div>
                            {timeLabel ? (
                              <time
                                className="mt-1 block text-right font-mono text-[10px] font-medium tabular-nums text-cyan-100/50"
                                dateTime={ln.created_at}
                              >
                                {timeLabel}
                              </time>
                            ) : null}
                          </div>
                        );
                      }

                      /** user */
                      return (
                        <div
                          key={ln.id}
                          className={`${baseWrap} self-start rounded-tl-sm border-white/[0.1] bg-slate-900/80 text-slate-100 ring-1 ring-white/[0.04] sm:rounded-tl-md`}
                        >
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                            Sen
                          </span>
                          <div className="mt-1 whitespace-pre-wrap">{ln.body}</div>
                          {timeLabel ? (
                            <time className="mt-1 block font-mono text-[10px] font-medium tabular-nums text-slate-500" dateTime={ln.created_at}>
                              {timeLabel}
                            </time>
                          ) : null}
                        </div>
                      );
                    })}
                    {chatSending ? (
                      <div className="flex justify-start px-0.5" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/[0.12] px-3 py-2 text-[12px] font-bold text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.15)] ring-1 ring-cyan-400/20">
                          <span
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-200/25 border-t-cyan-100"
                          />
                          Gönderiliyor…
                        </div>
                      </div>
                    ) : null}
                    {adminTypingPeek ? (
                      <div className="flex justify-end px-0.5 pb-1" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-gradient-to-r from-cyan-500/15 to-slate-950/80 px-3.5 py-2 shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)] ring-1 ring-cyan-400/15 backdrop-blur-sm">
                          <span className="flex gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:280ms]" />
                          </span>
                          <span className="text-[12px] font-bold text-cyan-50/95">Destek Ekibi yazıyor…</span>
                        </div>
                      </div>
                    ) : null}
                    <div ref={chatScrollAnchorRef} aria-hidden className="h-px w-full shrink-0" />
                  </div>
                </div>

                {feedback ? (
                  <div className="shrink-0 px-5 pt-2 text-[13px] font-medium leading-snug text-rose-300/95" role="alert">
                    {feedback}
                  </div>
                ) : null}
                {chatBanner ? (
                  <div className="shrink-0 px-5 pt-2 text-[12px] text-amber-200/92" role="status">
                    {chatBanner}
                  </div>
                ) : null}

                <div className="relative shrink-0 border-t border-white/[0.07] bg-black/45 px-3 py-2.5 backdrop-blur-md sm:px-4 sm:py-3 md:px-5">
                  <form onSubmit={handleSendChat}>
                    <textarea
                      value={chatInput}
                      aria-label="Sohbet mesajı"
                      rows={resolvedStatus ? 3 : 2}
                      placeholder={
                        resolvedStatus ? "Çözülü görüşmede yazı gönderilemez." : "Yanıtınızı yazın…"
                      }
                      disabled={resolvedStatus || chatSending}
                      onChange={(ev) => setChatInput(ev.target.value)}
                      className="min-h-[72px] w-full resize-none rounded-xl rounded-tr-md border border-cyan-400/22 bg-gradient-to-br from-white/[0.08] to-black/45 px-3 py-2.5 text-[13px] leading-relaxed text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] outline-none transition focus:border-cyan-400/45 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[76px] sm:px-3.5 sm:py-3"
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        type="submit"
                        disabled={resolvedStatus || chatSending}
                        className="inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-3 text-[14px] font-black tracking-tight text-white shadow-[0_14px_40px_-14px_rgba(0,198,255,0.48)] ring-1 ring-cyan-300/22 transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {resolvedStatus ? "Kapalı" : chatSending ? "Gönderiliyor…" : "Gönder"}
                      </button>
                      <button
                        type="button"
                        className={`inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl border px-3 py-3 text-[13px] font-bold leading-tight transition sm:px-4 ${
                          resolvedStatus
                            ? "border-emerald-400/45 bg-emerald-500/[0.12] text-emerald-50/95 hover:border-emerald-400/62"
                            : "border-white/[0.12] bg-white/[0.06] text-slate-50 hover:border-cyan-400/25 hover:bg-white/[0.08]"
                        }`}
                        disabled={chatSending || threadBootstrap}
                        onClick={() => void onNewConversationClick()}
                      >
                        Yeni görüşme başlat
                      </button>
                    </div>

                    {!resolvedStatus ? (
                      <button
                        type="button"
                        onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=Leylek%20TAG`)}
                        className="mx-auto mt-2 block py-2 text-[11px] font-semibold text-slate-500 underline-offset-4 transition hover:text-cyan-200/85 hover:underline"
                      >
                        E‑posta ile de ulaş
                      </button>
                    ) : null}
                  </form>
                  <button
                    type="button"
                    onClick={() => leaveThreadClearStorage()}
                    className="mt-2 w-full rounded-lg px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-400"
                  >
                    Bu görüşmeyi cihazda kapat
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        id={titleId}
                        className="text-[0.98rem] font-black leading-tight tracking-tight text-white sm:text-lg"
                      >
                        Leylek TAG Canlı Destek
                      </p>
                      <p id={descId} className="mt-2 text-[12px] leading-relaxed text-slate-400 sm:text-[13px]">
                        Ekibimize güvenli şekilde yazabilir; yanıtlar bu pencereden takip edilir. Kayıt için oturum açtığınız{" "}
                        <span className="font-medium text-slate-300">Google hesabınızın e-postası</span> kullanılır.
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <SupportLiveBadge />
                        <SupportLeylekBadge />
                        <span
                          className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400"
                          title="Deneysel"
                        >
                          Beta
                        </span>
                      </div>
                      {threadBootstrap ? (
                        <p className="mt-3 text-[12px] text-slate-500">Önceki görüşme kontrol ediliyor…</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 transition hover:border-cyan-400/25 hover:text-slate-200"
                    >
                      Kapat
                    </button>
                  </div>
                </div>

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4 sm:px-5">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="relative overflow-hidden rounded-[1.15rem] border border-cyan-400/24 bg-[linear-gradient(150deg,rgba(34,211,238,0.14)_0%,rgba(15,23,42,0.82)_52%,rgba(8,47,73,0.45)_100%)] px-3.5 py-3 shadow-[0_0_40px_-14px_rgba(34,211,238,0.42),inset_0_0_0_1px_rgba(103,232,249,0.16)] backdrop-blur-md">
                      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" aria-hidden />
                      <div className="relative flex flex-wrap items-center gap-2">
                        <SupportLiveBadge />
                        <SupportLeylekBadge />
                      </div>
                      <p className="relative mt-2.5 text-[11px] font-black uppercase tracking-[0.13em] text-cyan-100/85">
                        Sistem mesajı
                      </p>
                      <p className="relative mt-2 break-words text-[13px] leading-relaxed text-slate-50/[0.96]">
                        {LIVE_SUPPORT_WELCOME}
                      </p>
                    </div>
                  </div>
                </div>

                <form
                  className="relative shrink-0 border-t border-white/[0.07] bg-black/38 px-4 py-4 sm:px-5"
                  onSubmit={handleComposerSubmit}
                  noValidate
                >
                  <label className="relative grid gap-2">
                    <span className="sr-only">
                      Mesajınız, en az {MESSAGE_MIN_LEN} karakter
                    </span>
                    <textarea
                      name="message"
                      title="Görüşmeyi başlatmak için mesaj"
                      aria-label={`Mesajını yaz, en az ${MESSAGE_MIN_LEN} karakter`}
                      required
                      minLength={MESSAGE_MIN_LEN}
                      rows={4}
                      value={message}
                      onChange={(ev) => setMessage(ev.target.value)}
                      disabled={status === "loading" || threadBootstrap}
                      placeholder="Mesajını yaz…"
                      className="min-h-[118px] w-full resize-none rounded-[1rem] rounded-tr-md border border-cyan-400/22 bg-gradient-to-br from-white/[0.09] to-black/45 px-3.5 py-3 text-[13px] leading-relaxed text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_12px_40px_-28px_rgba(34,211,238,0.25)] outline-none transition focus:border-cyan-400/48 focus:shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12),0_16px_48px_-26px_rgba(34,211,238,0.35)] disabled:opacity-55"
                    />
                    <span className="text-[11px] font-medium text-slate-500">
                      En az {MESSAGE_MIN_LEN} karakter. İsterseniz aşağıdan ad soyad ekleyebilirsiniz; e-posta alanı
                      giriş yaptığınız Google adresinizle otomatik eşleşir.
                    </span>
                  </label>

                  <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Destek kaydı e-postası
                    </p>
                    <p className="mt-1 break-all font-mono text-[12px] font-medium text-slate-200">
                      {sessionContactEmail}
                    </p>
                  </div>

                  <details className="group mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 text-[12px] font-bold text-slate-200 hover:text-white">
                      <span>
                        Ad soyad{" "}
                        <span className="font-semibold lowercase text-slate-500">opsiyonel</span>
                      </span>
                      <svg
                        className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path
                          d="m6 9 6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </summary>
                    <div className="mt-3 grid gap-2 border-t border-white/[0.07] pt-3">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Ad soyad
                        </span>
                        <input
                          type="text"
                          name="name"
                          autoComplete="name"
                          value={name}
                          onChange={(ev) => setName(ev.target.value)}
                          disabled={status === "loading" || threadBootstrap}
                          className="min-h-[38px] rounded-lg border border-white/[0.08] bg-black/50 px-2.5 py-1.5 text-[13px] text-white outline-none transition focus:border-cyan-400/35 disabled:opacity-55"
                        />
                      </label>
                    </div>
                  </details>

                  <div className="absolute left-[-10000px] top-0 h-px w-px overflow-hidden" aria-hidden>
                    <label htmlFor={honeyId}>Şirket web sitesi</label>
                    <input
                      id={honeyId}
                      tabIndex={-1}
                      type="text"
                      name="support_company_website_v1"
                      autoComplete="off"
                      value={honey}
                      onChange={(ev) => setHoney(ev.target.value)}
                    />
                  </div>

                  {feedback ? (
                    <p className="mt-3 text-[13px] font-medium leading-snug text-rose-300/95" role="alert">
                      {feedback}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={status === "loading" || cooldownActiveForUi || threadBootstrap}
                      className="inline-flex min-h-[46px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_14px_40px_-16px_rgba(0,198,255,0.5)] ring-1 ring-cyan-300/22 transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {status === "loading" ? "Başlatılıyor…" : "Görüşmeyi başlat"}
                    </button>

                    {cooldownActiveForUi ? (
                      <p className="text-center text-[11px] leading-snug text-slate-500">
                        Kısa bekleme uygulanıyor.
                        <span aria-live="polite"> ({cooldownRemainSec}s)</span>
                      </p>
                    ) : null}

                    <Link
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG Canlı Destek")}`}
                      className="py-1 text-center text-[11px] font-semibold text-slate-500 underline-offset-4 transition hover:text-cyan-200/85 hover:underline"
                    >
                      E‑posta ile ulaş
                    </Link>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label={
          supportUnlocked
            ? "Leylek TAG canlı destek — sohbeti aç"
            : "Destek — canlı destek için giriş gerekli"
        }
        className={`tap-highlight relative ml-auto inline-flex max-w-full min-w-0 touch-manipulation items-center justify-center gap-1 overflow-visible rounded-full px-3 py-3 pr-[1.375rem] text-[13px] backdrop-blur-md transition-[border-color,box-shadow,background-color] sm:gap-2 sm:px-5 sm:pr-6 md:w-auto md:max-w-none ${
          supportUnlocked
            ? "border border-cyan-400/35 bg-slate-950/92 font-black shadow-[0_14px_52px_rgba(0,114,255,0.38),0_0_32px_-8px_rgba(34,211,238,0.22)] hover:border-cyan-300/55 hover:shadow-[0_18px_56px_rgba(0,198,255,0.32),0_0_38px_-6px_rgba(34,211,238,0.28)]"
            : "border border-amber-500/28 bg-slate-950/96 font-semibold shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)] hover:border-amber-400/40 hover:bg-slate-950"
        }`}
      >
        {supportUnlocked ? (
          <span
            className="livePulse pointer-events-none absolute right-4 top-[0.625rem] h-2 w-2 shrink-0 rounded-full bg-emerald-400 md:right-[1.125rem]"
            aria-hidden
          />
        ) : (
          <span
            className="pointer-events-none absolute right-3.5 top-[0.55rem] md:right-5"
            aria-hidden
          >
            <svg
              className="h-2.5 w-2.5 text-amber-300/90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11Z"
              />
            </svg>
          </span>
        )}
        <SupportHeadsetGlyph className="relative z-[1] h-[1.05rem] w-[1.05rem] shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]" />
        <span className="relative z-[1] flex min-w-0 flex-1 flex-wrap items-baseline gap-x-[0.25em] gap-y-0 leading-tight text-white/94 sm:flex-nowrap sm:whitespace-nowrap">
          <span className="text-[12px] font-bold tracking-tight sm:text-[13px]">Destek</span>
          <span className="shrink-0 text-slate-500/90" aria-hidden>
            —
          </span>
          {supportUnlocked ? (
            <span className="liveBlink shrink-0 text-[13px] font-black tracking-tight text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.52),0_0_22px_rgba(34,211,238,0.16)] sm:text-[1.125rem] md:text-xl">
              Canlı
            </span>
          ) : (
            <span className="max-w-[9.5rem] shrink text-[11px] font-semibold leading-snug text-amber-100/95 sm:max-w-none sm:text-[12px]">
              Giriş gerekli
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
