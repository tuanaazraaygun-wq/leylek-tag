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
  supportTypingBridgeTopic,
} from "@/lib/support-typing-realtime";
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
  "Merhaba, Leylek TAG destek hattına hoş geldin. Konunu kısaca yaz; ekibimiz uygun olduğunda bu görüşmeye katılır.";

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

function trimRowStatus(raw: string | null | undefined): string {
  return raw?.trim()?.toLowerCase() ?? "";
}

type FormStatus = "idle" | "loading" | "error";

type ThreadSnap = { ok: true; meta: SupportTicketMetaRow } | { ok: false };

export function SiteSupportPanel() {
  const pathname = usePathname();
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const { authReady, session, profile } = useSiteAuth();
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
  const [email, setEmail] = useState("");
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
  const [typingPipeReady, setTypingPipeReady] = useState(false);

  const chatScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const knownChatIdsRef = useRef<Set<string>>(new Set());
  const siteSupportRealtimeSeqRef = useRef(0);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingBurstRef = useRef(0);
  const adminTypingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRetryAttemptsRef = useRef(0);
  const realtimeRepairTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Gönder sonrası bekleme bitiş zamanı (ms epoch); 0 = soğuma yok */
  const cooldownEndsAtRef = useRef(0);
  const [cooldownSession, bumpCooldownSession] = useState(0);
  const [cooldownRemainSec, setCooldownRemainSec] = useState(0);

  const scrollChatToBottom = useCallback(() => {
    chatScrollAnchorRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatLines, adminTypingPeek, scrollChatToBottom]);

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
    };
  }, []);

  const realtimeTicketId = ticketMeta?.id ?? null;

  useEffect(() => {
    realtimeRetryAttemptsRef.current = 0;
    typingChannelRef.current = null;
    queueMicrotask(() => {
      setPostgresRepairKey(0);
      setTypingPipeReady(false);
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
      const emailHint = session?.user?.email?.trim() ?? "";
      queueMicrotask(() => {
        setName((p) => (p.trim() === "" ? nameHint : p));
        setEmail((p) => (p.trim() === "" ? emailHint : p));
      });
    }
  }, [authReady, configured, profile?.full_name, session?.user?.email]);

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

  const togglePanel = useCallback(() => {
    setOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen && configured && authReady) {
        const nameHint = profile?.full_name?.trim() ?? "";
        const emailHint = session?.user?.email?.trim() ?? "";
        queueMicrotask(() => {
          setName((p) => (p.trim() === "" ? nameHint : p));
          setEmail((p) => (p.trim() === "" ? emailHint : p));
        });
      }
      return nextOpen;
    });
  }, [authReady, configured, profile?.full_name, session?.user?.email]);

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

  useEffect(() => {
    if (!open || !configured) return undefined;

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
  }, [open, configured, fetchThreadSnapshot]);

  useEffect(() => {
    const tk = supportClientToken?.trim() ?? "";
    if (!open || !configured || !realtimeTicketId || !tk) return undefined;

    const tc = getSupabaseTicketChatClient(tk);
    if (!tc) return undefined;

    let cleaned = false;
    const seq = ++siteSupportRealtimeSeqRef.current;
    const topic = `site-support-chat:${realtimeTicketId}:${seq}`;

    const scheduleRepair = () => {
      if (cleaned) return;
      realtimeRetryAttemptsRef.current += 1;
      const n = realtimeRetryAttemptsRef.current;
      if (n > 8) return;
      const delayMs = Math.min(30_000, 900 * 1.45 ** Math.min(n - 1, 12));
      if (process.env.NODE_ENV !== "production" && (n === 1 || n % 3 === 0)) {
        console.warn("[SiteSupportPanel] realtime repair scheduled", { ticketId: realtimeTicketId, n, delayMs });
      }
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      realtimeRepairTimerRef.current = setTimeout(() => {
        realtimeRepairTimerRef.current = null;
        if (!cleaned) setPostgresRepairKey((v) => v + 1);
      }, delayMs);
    };

    const channel = tc
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `support_message_id=eq.${realtimeTicketId}`,
        },
        (payload) => {
          if (cleaned) return;
          try {
            const row = payload.new as SupportChatRow;
            if (!row?.id) return;
            setChatLines((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [...prev, row];
            });
          } catch {
            /* ignore */
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_messages",
          filter: `id=eq.${realtimeTicketId}`,
        },
        (payload) => {
          if (cleaned) return;
          try {
            const nw = payload.new as SupportTicketMetaRow;
            setTicketMeta(nw);
          } catch {
            /* ignore */
          }
        },
      )
      .subscribe((status, err) => {
        if (cleaned) return;
        if (status === "SUBSCRIBED") {
          realtimeRetryAttemptsRef.current = 0;
          return;
        }
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production" && err) {
          console.warn("[SiteSupportPanel] realtime channel warning", err.message);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleRepair();
        }
      });

    return () => {
      cleaned = true;
      if (realtimeRepairTimerRef.current) clearTimeout(realtimeRepairTimerRef.current);
      realtimeRepairTimerRef.current = null;
      void tc.removeChannel(channel);
    };
  }, [configured, open, realtimeTicketId, supportClientToken, postgresRepairKey]);

  useEffect(() => {
    const tk = supportClientToken?.trim() ?? "";
    if (!open || !configured || !realtimeTicketId || !tk) return undefined;

    const tc = getSupabaseTicketChatClient(tk);
    if (!tc) return undefined;

    let disposed = false;
    const bridgeTopic = supportTypingBridgeTopic(realtimeTicketId);
    const ch = tc
      .channel(bridgeTopic, { config: { broadcast: { ack: false } } })
      .on("broadcast", { event: SUPPORT_ADMIN_TYPING_EVENT }, () => {
        if (!disposed) bumpAdminTyping();
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
      void tc.removeChannel(ch);
    };
  }, [configured, open, realtimeTicketId, supportClientToken, bumpAdminTyping]);

  useEffect(() => {
    if (!typingPipeReady || !open || realtimeTicketId == null) return undefined;
    const ch = typingChannelRef.current;
    if (!ch) return undefined;
    const trimmed = chatInput.trim();
    if (trimmed.length < 1) return undefined;

    typingBurstRef.current += 1;
    const burst = typingBurstRef.current;
    const t = window.setTimeout(() => {
      if (burst !== typingBurstRef.current) return;
      void ch
        .send({
          type: "broadcast",
          event: SUPPORT_USER_TYPING_EVENT,
          payload: { at: Date.now() },
        })
        .catch(() => {});
    }, 700);
    return () => window.clearTimeout(t);
  }, [chatInput, typingPipeReady, open, realtimeTicketId]);

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
        email: email.trim() || null,
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
            sender_email: email.trim() || null,
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
        setEmail("");
        setMessage("");
        setFeedback(null);
      } catch {
        setStatus("error");
        setFeedback("Bir şeyler ters gitti. Lütfen tekrar dene.");
      }
    },
    [
      configured,
      email,
      fetchThreadSnapshot,
      honey,
      message,
      mergeChatBootstrap,
      name,
      pathname,
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
      if (!ticketId || !tk || stResolved || chatSending) return;

      const tc = getSupabaseTicketChatClient(tk);
      if (!tc) return;

      setChatSending(true);
      try {
        const { data, error } = await tc
          .from("support_chat_messages")
          .insert({
            support_message_id: ticketId,
            sender_type: "user",
            sender_email: email.trim() || null,
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
    [chatInput, chatSending, email, supportClientToken, ticketMeta],
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

  const hasAssignedAdmin = Boolean((ticketMeta?.assigned_admin_id ?? "").trim().length > 0);
  const queueStatusPrimary =
    hasAssignedAdmin
      ? "Canlı destek görüşmesi başladı."
      : "Sıradasın — ekibimiz uygun olduğunda görüşmeye katılır.";

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
            ) : panelView === "thread" && ticketMeta?.id ? (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
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
                            Ekibimize mesaj bıraktın; yanıtlar bu pencerede görünür.
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

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 flex-col gap-3 pb-2">
                    {threadBootstrap ? (
                      <p className="text-[12px] text-slate-500">Senkronize ediliyor…</p>
                    ) : null}

                    <div className="rounded-2xl rounded-tl-md border border-cyan-400/26 bg-[linear-gradient(148deg,rgba(34,211,238,0.12)_0%,rgba(15,23,42,0.88)_48%,rgba(8,47,73,0.55)_100%)] px-3.5 py-3 shadow-[0_0_32px_-12px_rgba(34,211,238,0.35),inset_0_0_0_1px_rgba(103,232,249,0.14)] backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/78">
                        Destek karşılaması
                      </p>
                      <p className="mt-2 break-words text-[13px] leading-relaxed text-slate-50/96">
                        {LIVE_SUPPORT_WELCOME}
                      </p>
                    </div>

                    <div className="max-w-[min(100%,21rem)] self-start rounded-2xl rounded-tl-md border border-white/[0.08] bg-black/40 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Bilgi
                      </p>
                      <p className="mt-2 break-words text-[12.5px] leading-relaxed text-slate-300/95">
                        Mesajın güvenli şekilde iletildi. Ekibimiz yanıt yazdığında konuşma akışında görünecek.
                      </p>
                    </div>

                    {chatLines.map((ln) => {
                      const sender = ln.sender_type?.trim()?.toLowerCase() ?? "";

                      const baseWrap =
                        "max-w-[min(100%,19rem)] break-words rounded-2xl border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-sm";

                      if (sender === "system") {
                        return (
                          <div
                            key={ln.id}
                            className={`mx-auto ${baseWrap} max-w-[95%] self-center rounded-2xl border-white/[0.08] bg-white/[0.04] text-center text-slate-200/92`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                              Sistem
                            </span>
                            <div className="mt-2 text-[12px]">{ln.body}</div>
                          </div>
                        );
                      }

                      if (sender === "admin") {
                        return (
                          <div
                            key={ln.id}
                            className={`${baseWrap} max-w-[min(100%,19rem)] self-end rounded-tr-md border-violet-400/22 bg-black/52 text-slate-50/96`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200/75">
                              Destek ekibi
                            </span>
                            <div className="mt-2 whitespace-pre-wrap">{ln.body}</div>
                          </div>
                        );
                      }

                      /** user */
                      return (
                        <div
                          key={ln.id}
                          className={`${baseWrap} self-start rounded-tl-md border-white/[0.08] bg-black/52 text-slate-100/94`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                            Sen
                          </span>
                          <div className="mt-2 whitespace-pre-wrap">{ln.body}</div>
                        </div>
                      );
                    })}
                    {adminTypingPeek ? (
                      <div className="flex justify-end px-1 pb-2" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/26 bg-black/52 px-3 py-1.5 backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                          <span className="flex gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:280ms]" />
                          </span>
                          <span className="text-[11px] font-semibold text-violet-100/92">Destek yazıyor…</span>
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

                <div className="relative shrink-0 border-t border-white/[0.07] bg-black/35 px-4 py-3 sm:px-5">
                  <form onSubmit={handleSendChat}>
                    <textarea
                      value={chatInput}
                      aria-label="Sohbet mesajı"
                      rows={resolvedStatus ? 3 : 2}
                      placeholder={
                        resolvedStatus ? "Çözülü görüşmede yazı gönderilemez." : "Yanıt yaz…"
                      }
                      disabled={resolvedStatus || chatSending}
                      onChange={(ev) => setChatInput(ev.target.value)}
                      className="min-h-[76px] w-full resize-none rounded-[1rem] rounded-tr-md border border-cyan-400/18 bg-gradient-to-br from-white/[0.07] to-black/40 px-3.5 py-3 text-[13px] leading-relaxed text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-45"
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        type="submit"
                        disabled={resolvedStatus || chatSending}
                        className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_14px_36px_-18px_rgba(0,198,255,0.45)] ring-1 ring-cyan-300/18 transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {resolvedStatus ? "Kapalı" : chatSending ? "Gönderiliyor…" : "Gönder"}
                      </button>
                      <button
                        type="button"
                        className={`inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition ${
                          resolvedStatus
                            ? "border-emerald-400/45 bg-emerald-500/[0.1] text-emerald-50/95 hover:border-emerald-400/62"
                            : "border-white/[0.1] bg-white/[0.04] text-slate-200 hover:border-white/[0.15]"
                        }`}
                        disabled={chatSending || threadBootstrap}
                        onClick={() => void onNewConversationClick()}
                      >
                        {resolvedStatus ? "Yeni görüşme" : "Yeni mesaj"}
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
                        Ekibimize mesaj bırakabilir, yanıt geldiğinde bu pencereden takip edebilirsin.
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
                      En az {MESSAGE_MIN_LEN} karakter; gerekiyorsa aşağıdan iletişim bilgisini ekleyebilirsin.
                    </span>
                  </label>

                  <details className="group mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 text-[12px] font-bold text-slate-200 hover:text-white">
                      <span>
                        İletişim bilgileri{" "}
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
                    <div className="mt-3 grid gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-2">
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
                      <label className="grid gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          E‑posta
                        </span>
                        <input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={email}
                          onChange={(ev) => setEmail(ev.target.value)}
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
        aria-label="Destek paneli · canlı yazışma"
        className="tap-highlight relative ml-auto inline-flex max-w-full min-w-0 touch-manipulation items-center justify-center gap-1 overflow-visible rounded-full border border-cyan-400/35 bg-slate-950/92 px-3 py-3 pr-[1.375rem] text-[13px] font-black shadow-[0_14px_52px_rgba(0,114,255,0.38),0_0_32px_-8px_rgba(34,211,238,0.22)] backdrop-blur-md transition-[border-color,box-shadow] hover:border-cyan-300/55 hover:shadow-[0_18px_56px_rgba(0,198,255,0.32),0_0_38px_-6px_rgba(34,211,238,0.28)] sm:gap-2 sm:px-5 sm:pr-6 md:w-auto md:max-w-none"
      >
        <span
          className="livePulse pointer-events-none absolute right-4 top-[0.625rem] h-2 w-2 shrink-0 rounded-full bg-emerald-400 md:right-[1.125rem]"
          aria-hidden
        />
        <SupportHeadsetGlyph className="relative z-[1] h-[1.05rem] w-[1.05rem] shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]" />
        <span className="relative z-[1] flex min-w-0 shrink items-baseline whitespace-nowrap text-white/94">
          <span className="truncate text-[13px] font-bold tracking-tight sm:text-sm">Destek</span>
          <span className="mx-[0.2em] shrink-0 text-slate-500/95" aria-hidden>
            -
          </span>
          <span className="liveBlink shrink-0 text-[1rem] font-black tracking-tight text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.52),0_0_22px_rgba(34,211,238,0.16)] sm:text-[1.125rem] md:text-xl">
            Canlı
          </span>
        </span>
      </button>
    </div>
  );
}
