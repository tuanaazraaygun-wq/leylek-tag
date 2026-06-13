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
import {
  SiteSupportPhoneShell,
  SupportEntryGateway,
  SupportPhoneModalHeader,
} from "@/components/site-support-phone-shell";
import { LeylekZekaMark } from "@/components/leylek-zeka-mark";
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
import { notifySupportAdminsClient } from "@/lib/support-admin-notify-client";
import { requestSupportLeylekZeka, type LeylekZekaErrorCode } from "@/lib/support-leylek-zeka-client";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";
import { trackSupportOpen } from "@/lib/track-event";

const MESSAGE_MIN_LEN = 10;
const CHAT_MESSAGE_MIN_LEN = 1;
const SUBMIT_COOLDOWN_MS = 36_000;
const USER_AGENT_MAX = 512;

/** Karşılama — bilgilendirme/yönlendirme; anında insan operatör vaadi yok. */
const LIVE_SUPPORT_WELCOME =
  "Merhaba. Leylek Zeka bilgilendirme ve yönlendirme sağlar; karar vermez. Mesajların destek ekibine güvenli biçimde iletilir. Yanıtlar müsaitlik durumunda buradan gelir.";

const APP_SCOPE_NOTE =
  "Uygulama içi işlemler — teklif, eşleşme, QR doğrulama — mobil uygulamada tamamlanır.";

const SUPPORT_QUICK_TOPICS = [
  { id: "qr", label: "QR doğrulama", prompt: "QR doğrulama süreci hakkında bilgi almak istiyorum." },
  { id: "trust-call", label: "Güven görüşmesi", prompt: "Görüntülü güven görüşmesi hakkında bilgi almak istiyorum." },
  { id: "account", label: "Hesap ve giriş", prompt: "Hesap ve giriş konusunda yardım almak istiyorum." },
  { id: "ride-share", label: "Yol paylaşımı", prompt: "Yol paylaşımı akışı hakkında bilgi almak istiyorum." },
  { id: "offer-match", label: "Teklif ve eşleşme", prompt: "Teklif ve eşleşme süreci hakkında bilgi almak istiyorum." },
  { id: "security", label: "Güvenlik bildirimi", prompt: "Güvenlik bildirimi yapmak istiyorum." },
] as const;

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

type SupportEntryIntent = "leylek" | "live" | null;

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

function SupportResponseCenterBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.11em] text-slate-300/90">
      <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-300/80" aria-hidden />
      Destek merkezi
    </span>
  );
}

function SupportWelcomeStrip() {
  return (
    <p className="rounded-lg border border-cyan-400/12 bg-cyan-500/[0.05] px-3 py-2 text-[12px] leading-relaxed text-slate-300/90">
      {LIVE_SUPPORT_WELCOME}
    </p>
  );
}

function SupportAppScopeNote() {
  return (
    <p className="text-[11px] leading-relaxed text-slate-500">
      {APP_SCOPE_NOTE}
    </p>
  );
}

function SupportQuickTopicChips({
  onSelect,
  disabled,
  compact = false,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <p
        className={`font-semibold uppercase tracking-[0.1em] text-slate-500 ${compact ? "text-[9px]" : "text-[10px]"}`}
      >
        Hızlı konular
      </p>
      <div className={`flex flex-wrap ${compact ? "mt-1 gap-1" : "mt-1.5 gap-1.5"}`}>
        {SUPPORT_QUICK_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(topic.prompt)}
            className={`rounded-full border border-white/[0.08] bg-white/[0.03] font-medium text-slate-300 transition hover:border-cyan-400/22 hover:bg-cyan-400/[0.06] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-45 ${
              compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-[11px]"
            }`}
          >
            {topic.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SupportThreadMinimalFooter() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.05] pt-2 text-[10px] text-slate-500">
      <span>Destek ekibi müsait olduğunda devreye girer.</span>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG · Destek")}`}
        className="shrink-0 font-medium text-slate-400 underline-offset-2 transition hover:text-cyan-200/90 hover:underline"
      >
        {SUPPORT_EMAIL}
      </a>
    </div>
  );
}

function SupportChatSendGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 14-7-4 7 4 7-14-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SupportBubbleAvatar({ variant }: { variant: "leylek" | "admin" }) {
  if (variant === "leylek") {
    return <LeylekZekaMark size="sm" variant="tile" className="mb-0.5" />;
  }

  return (
    <span
      className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-violet-400/22 bg-gradient-to-br from-violet-500/15 to-slate-900/90"
      aria-hidden
    >
      <span className="text-[9px] font-bold text-violet-200/90">D</span>
    </span>
  );
}

const LEYLEK_ZEKA_NO_SESSION_BANNER =
  "Leylek Zeka için oturum yenilenemedi; mesajınız destek ekibine iletildi.";

function leylekZekaFailBanner(error?: LeylekZekaErrorCode, status?: number): string {
  const code = error ?? "";
  if (status === 401 || code === "unauthorized") {
    return "Oturum yenilenemedi; mesajınız destek ekibine iletildi.";
  }
  if (status === 403 || code === "forbidden") {
    return "Görüşme doğrulanamadı; destek ekibi yanıtlayacak.";
  }
  if (status === 429 || code === "rate_limited") {
    return "Leylek Zeka için birkaç saniye bekleyin; mesajınız kaydedildi.";
  }
  if (
    status === 502 ||
    status === 503 ||
    code === "ai_unavailable" ||
    code === "server_misconfigured" ||
    code === "persist_failed"
  ) {
    return "Leylek Zeka geçici olarak yanıt veremedi; destek ekibi yanıtlayacak.";
  }
  return "Leylek Zeka şu an yanıt veremedi; mesajınız destek ekibine iletildi.";
}

function shouldSkipLeylekZekaAi(
  meta: SupportTicketMetaRow | null,
  lines: SupportChatRow[],
): boolean {
  if (lines.some((ln) => (ln.sender_type ?? "").trim().toLowerCase() === "admin")) return true;
  if (!meta) return false;
  if (trimRowStatus(meta.status) === "resolved") return true;
  if ((meta.assigned_admin_id ?? "").trim().length > 0) return true;
  return false;
}

function handleChatTextareaEnterSubmit(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  imeComposing: boolean,
): void {
  if (e.key !== "Enter" || e.shiftKey || imeComposing || e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.form?.requestSubmit();
}

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

function formatChatDateChipTr(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Bugün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
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
  const aiInFlightRef = useRef(false);

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
  const [entryIntent, setEntryIntent] = useState<SupportEntryIntent>(null);
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
  const [aiTyping, setAiTyping] = useState(false);
  const [chatBanner, setChatBanner] = useState<string | null>(null);
  const [leylekZekaBanner, setLeylekZekaBanner] = useState<string | null>(null);
  const [adminTypingPeek, setAdminTypingPeek] = useState(false);
  const [postgresRepairKey, setPostgresRepairKey] = useState(0);
  const [typingBridgeRepairKey, setTypingBridgeRepairKey] = useState(0);
  const [typingBridgeSendReady, setTypingBridgeSendReady] = useState(false);

  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const threadImeComposingRef = useRef(false);
  const composerImeComposingRef = useRef(false);
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
    requestAnimationFrame(() => {
      const el = chatScrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      chatScrollAnchorRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatLines, adminTypingPeek, chatSending, aiTyping, scrollChatToBottom]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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

  const closePanel = useCallback(() => {
    setOpen(false);
    setEntryIntent(null);
  }, []);

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
    setEntryIntent(null);
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
      if (nextOpen) {
        trackSupportOpen({ page: pathname ?? undefined, placement: "support_bubble" });
      }
      if (nextOpen && configured && authReady) {
        const nameHint = profile?.full_name?.trim() ?? "";
        queueMicrotask(() => {
          setName((p) => (p.trim() === "" ? nameHint : p));
        });
      }
      return nextOpen;
    });
  }, [authReady, configured, pathname, profile?.full_name]);

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

  const resolveSiteAccessToken = useCallback(async (): Promise<string> => {
    const fromSession = session?.access_token?.trim();
    if (fromSession) return fromSession;
    const client = getSupabaseBrowserClient();
    if (!client) return "";
    const { data } = await client.auth.getSession();
    return data.session?.access_token?.trim() ?? "";
  }, [session?.access_token]);

  const fireAdminNotify = useCallback(
    async (
      event: "new_ticket" | "user_message",
      ticketId: string,
      clientToken: string,
    ) => {
      const accessToken = await resolveSiteAccessToken();
      if (!accessToken) return;
      void notifySupportAdminsClient({
        event,
        ticketId,
        clientToken,
        accessToken,
      });
    },
    [resolveSiteAccessToken],
  );

  const invokeLeylekZekaAfterUserMessage = useCallback(
    async (
      ticketId: string,
      clientToken: string,
      userMessage: string,
      skipCheckMeta: SupportTicketMetaRow | null,
      skipCheckLines: SupportChatRow[],
    ) => {
      if (aiInFlightRef.current) return;
      if (shouldSkipLeylekZekaAi(skipCheckMeta, skipCheckLines)) return;

      const accessToken = await resolveSiteAccessToken();
      if (!accessToken) {
        setLeylekZekaBanner(LEYLEK_ZEKA_NO_SESSION_BANNER);
        return;
      }

      aiInFlightRef.current = true;
      setAiTyping(true);
      setLeylekZekaBanner(null);
      scrollChatToBottom();
      try {
        const result = await requestSupportLeylekZeka({
          accessToken,
          ticketId,
          clientToken,
          message: userMessage,
        });
        if ("skipped" in result && result.skipped) return;
        if (!result.success) {
          setLeylekZekaBanner(leylekZekaFailBanner(result.error, result.status));
          return;
        }
        await pollTicketChatMessages(ticketId, clientToken);
        scrollChatToBottom();
      } catch {
        setLeylekZekaBanner(leylekZekaFailBanner());
      } finally {
        aiInFlightRef.current = false;
        setAiTyping(false);
        scrollChatToBottom();
      }
    },
    [pollTicketChatMessages, resolveSiteAccessToken, scrollChatToBottom],
  );

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
      setLeylekZekaBanner(null);

      if (honey.trim() !== "") return;

      if (!supportUnlocked || !sessionContactEmail) {
        setFeedback("Destek talebi için önce oturum açın.");
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

      const userMsgText = message.trim();

      const payload = {
        name: name.trim() || null,
        email: sessionContactEmail,
        message: userMsgText,
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
            body: userMsgText,
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

        const bootLines = Array.isArray(lines) ? (lines as SupportChatRow[]) : [];
        mergeChatBootstrap(bootLines);

        const { data: meta } = await ticketClientReturning!
          .from("support_messages")
          .select("id,status,assigned_admin_id")
          .eq("id", created.id)
          .maybeSingle();

        const metaRow = meta ? (meta as SupportTicketMetaRow) : null;
        const aiMeta: SupportTicketMetaRow =
          metaRow ?? { id: created.id, status: "new", assigned_admin_id: null };
        setTicketMeta(aiMeta);

        setPanelView("thread");
        setStatus("idle");
        setName("");
        setMessage("");
        setFeedback(null);
        setLeylekZekaBanner(null);
        setChatBanner(
          "Talebin kaydedildi ve destek ekibine iletildi. Müsaitlik durumunda yanıtlar bu akışta görünecek.",
        );

        void fireAdminNotify("new_ticket", created.id, tokenNormalized);

        void invokeLeylekZekaAfterUserMessage(
          created.id,
          tokenNormalized,
          userMsgText,
          aiMeta,
          bootLines,
        );
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
      fireAdminNotify,
      invokeLeylekZekaAfterUserMessage,
    ],
  );

  const handleSendChat = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);
      setChatBanner(null);
      setLeylekZekaBanner(null);

      const body = chatInput.trim();
      if (body.length < CHAT_MESSAGE_MIN_LEN) {
        setFeedback("Mesaj yaz.");
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
          setFeedback("Mesaj gönderilemedi. Bağlantıyı kontrol et.");
          return;
        }

        setChatLines((prev) => (prev.some((r) => r.id === data.id) ? prev : [...prev, data as SupportChatRow]));
        setChatInput("");
        setChatBanner("Mesajın gönderildi ve destek akışına eklendi. Ekibimiz müsait olduğunda buradan yanıtlayacaktır.");
        scrollChatToBottom();

        const nextLines = chatLines.some((r) => r.id === data.id)
          ? chatLines
          : [...chatLines, data as SupportChatRow];

        if (shouldSkipLeylekZekaAi(ticketMeta, nextLines)) {
          void fireAdminNotify("user_message", ticketId, tk);
        }

        void invokeLeylekZekaAfterUserMessage(ticketId, tk, body, ticketMeta, nextLines);
      } finally {
        setChatSending(false);
      }
    },
    [
      chatInput,
      chatLines,
      chatSending,
      fireAdminNotify,
      invokeLeylekZekaAfterUserMessage,
      scrollChatToBottom,
      sessionContactEmail,
      supportClientToken,
      supportUnlocked,
      ticketMeta,
    ],
  );

  const onNewConversationClick = useCallback(async () => {
    setFeedback(null);
    setChatBanner(null);

    const stored = readStoredSupportTicket();

    /** Thread yoksa sadece yeni bileti formdan doldurmak için */
    if (!stored?.ticketId) {
      resetComposerOnly();
      setEntryIntent(null);
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

  const phoneStatusLabel = aiTyping
    ? "Yanıt hazırlanıyor"
    : hasAdminReplyInThread
      ? "Destek ekibi aktif"
      : "Çevrimiçi";

  const showEntryGateway = Boolean(
    supportUnlocked &&
      panelView === "composer" &&
      !ticketMeta?.id &&
      entryIntent === null &&
      !threadBootstrap,
  );

  const composerIntentSubtitle =
    entryIntent === "live"
      ? "Mesajın destek ekibine iletilir; yanıtlar müsaitlik durumuna göre gelir."
      : "Leylek Zeka ön bilgilendirme sağlar; gerektiğinde insan destek devreye girer.";

  const threadHeaderSubtitle =
    hasAdminReplyInThread || hasAssignedAdmin
      ? "Destek ekibi görüşmeye katıldı."
      : "Müsaitlik durumuna göre destek ekibi yanıt verir.";

  const hasThreadMessages = chatLines.length > 0;
  const threadDateChip = hasThreadMessages ? formatChatDateChipTr(chatLines[0]?.created_at) : "";

  return (
    <>
      {open ? (
        <SiteSupportPhoneShell
          dialogId={dialogId}
          titleId={titleId}
          descId={descId}
          onOverlayClose={closePanel}
        >
            {!configured ? (
              <div className="relative p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    id={titleId}
                    className="text-lg font-black leading-snug tracking-tight text-white"
                  >
                    Leylek TAG Destek
                  </p>
                  <SupportResponseCenterBadge />
                </div>
                <p id={descId} className="mt-3 text-[13px] leading-relaxed text-slate-400">
                  Destek yapılandırılmadığında ekibimize güvenli biçimde e‑posta ile ulaşabilirsin.
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
                  Destek
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
                      Destek için oturum açın
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
                  Görüşmelerin doğrulanması ve doğru iletişim için oturum açtıktan sonra yazabilirsin.
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
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG · Destek talebi")}`}
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
                  Hesabınızda görünen bir e‑posta adresi olmadığı için destek bileti oluşturulamıyor.
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
                <SupportPhoneModalHeader
                  titleId={titleId}
                  descId={descId}
                  statusLabel={phoneStatusLabel}
                  subtitle={threadHeaderSubtitle}
                  onClose={closePanel}
                />

                {feedback ? (
                  <div
                    className="shrink-0 border-b border-rose-400/15 bg-rose-500/[0.07] px-4 py-1.5 text-[11px] leading-snug text-rose-200/95 sm:px-5"
                    role="alert"
                  >
                    {feedback}
                  </div>
                ) : null}
                {chatBanner ? (
                  <div
                    className="shrink-0 border-b border-cyan-400/12 bg-cyan-500/[0.06] px-4 py-1.5 text-[11px] leading-snug text-cyan-100/88 sm:px-5"
                    role="status"
                    aria-live="polite"
                  >
                    {chatBanner}
                  </div>
                ) : null}
                {leylekZekaBanner ? (
                  <div
                    className="shrink-0 border-b border-amber-400/12 bg-amber-500/[0.07] px-4 py-1.5 text-[11px] leading-snug text-amber-100/88 sm:px-5"
                    role="status"
                    aria-live="polite"
                  >
                    {leylekZekaBanner}
                  </div>
                ) : null}

                <div
                  ref={chatScrollContainerRef}
                  className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 flex-col gap-3 pb-1">
                    {threadBootstrap ? (
                      <p className="text-[12px] text-slate-500">Senkronize ediliyor…</p>
                    ) : null}

                    {!hasThreadMessages ? <SupportWelcomeStrip /> : null}

                    {!hasThreadMessages &&
                    !resolvedStatus &&
                    !hasAdminReplyInThread &&
                    !hasAssignedAdmin ? (
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Talebin alındı; destek ekibi müsait olduğunda yanıtlar.
                      </p>
                    ) : null}

                    {threadDateChip ? (
                      <div className="flex justify-center py-0.5">
                        <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {threadDateChip}
                        </span>
                      </div>
                    ) : null}

                    {chatLines.map((ln) => {
                      const sender = ln.sender_type?.trim()?.toLowerCase() ?? "";
                      const timeLabel = formatChatTimeTr(ln.created_at);

                      const bubbleBody =
                        "max-w-[min(100%,17.5rem)] break-words rounded-2xl px-3 py-2 text-[14px] leading-relaxed sm:max-w-[min(100%,18rem)] sm:text-[13px]";

                      if (sender === "system") {
                        return (
                          <div key={ln.id} className="flex items-end justify-start gap-2">
                            <SupportBubbleAvatar variant="leylek" />
                            <div
                              className={`${bubbleBody} rounded-bl-md border border-cyan-400/14 bg-slate-900/85 text-slate-50`}
                            >
                              <div className="whitespace-pre-wrap">{ln.body}</div>
                              {timeLabel ? (
                                <time
                                  className="mt-1 block text-[10px] text-slate-500"
                                  dateTime={ln.created_at}
                                >
                                  {timeLabel}
                                </time>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      if (sender === "admin") {
                        return (
                          <div key={ln.id} className="flex items-end justify-start gap-2">
                            <SupportBubbleAvatar variant="admin" />
                            <div
                              className={`${bubbleBody} rounded-bl-md border border-violet-400/16 bg-slate-900/80 text-slate-50`}
                            >
                              <span className="mb-0.5 block text-[10px] font-medium text-violet-300/80">
                                Destek
                              </span>
                              <div className="whitespace-pre-wrap">{ln.body}</div>
                              {timeLabel ? (
                                <time
                                  className="mt-1 block text-[10px] text-slate-500"
                                  dateTime={ln.created_at}
                                >
                                  {timeLabel}
                                </time>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      /** user */
                      return (
                        <div key={ln.id} className="flex justify-end">
                          <div
                            className={`${bubbleBody} rounded-br-md border border-[#0072FF]/25 bg-gradient-to-br from-[#0072FF] to-[#0060DD] text-white shadow-[0_4px_16px_-8px_rgba(0,114,255,0.55)]`}
                          >
                            <div className="whitespace-pre-wrap">{ln.body}</div>
                            {timeLabel ? (
                              <time
                                className="mt-1 block text-right text-[10px] text-blue-100/65"
                                dateTime={ln.created_at}
                              >
                                {timeLabel}
                              </time>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {chatSending ? (
                      <div className="flex justify-end" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-md border border-cyan-400/18 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-50/90">
                          <span
                            aria-hidden
                            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-cyan-200/25 border-t-cyan-100"
                          />
                          Gönderiliyor…
                        </div>
                      </div>
                    ) : null}
                    {aiTyping ? (
                      <div className="flex items-end justify-start gap-2" role="status" aria-live="polite">
                        <SupportBubbleAvatar variant="leylek" />
                        <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-cyan-400/16 bg-slate-900/80 px-3 py-2">
                          <span className="flex gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:280ms]" />
                          </span>
                          <span className="text-[12px] text-slate-300">Leylek Zeka yazıyor…</span>
                        </div>
                      </div>
                    ) : null}
                    {adminTypingPeek ? (
                      <div className="flex justify-start pb-0.5" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/18 bg-violet-500/10 px-3 py-1.5">
                          <span className="flex gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:280ms]" />
                          </span>
                          <span className="text-[11px] font-medium text-violet-100/90">Destek ekibi yazıyor…</span>
                        </div>
                      </div>
                    ) : null}
                    <div ref={chatScrollAnchorRef} aria-hidden className="h-px w-full shrink-0" />
                  </div>
                </div>

                <div className="relative shrink-0 border-t border-white/[0.06] bg-slate-950/80 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-5">
                  <SupportQuickTopicChips
                    compact
                    onSelect={setChatInput}
                    disabled={resolvedStatus || chatSending}
                  />
                  <form onSubmit={handleSendChat} className="mt-2">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={chatInput}
                        aria-label="Sohbet mesajı"
                        rows={1}
                        placeholder={
                          resolvedStatus ? "Çözülü görüşmede yazı gönderilemez." : "Mesajınızı yazın…"
                        }
                        disabled={resolvedStatus || chatSending}
                        onChange={(ev) => setChatInput(ev.target.value)}
                        onCompositionStart={() => {
                          threadImeComposingRef.current = true;
                        }}
                        onCompositionEnd={() => {
                          threadImeComposingRef.current = false;
                        }}
                        onKeyDown={(ev) =>
                          handleChatTextareaEnterSubmit(ev, threadImeComposingRef.current)
                        }
                        className="max-h-[7.5rem] min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-3 py-2.5 text-base leading-relaxed text-white outline-none transition focus:border-cyan-400/35 focus:ring-1 focus:ring-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[2.5rem] sm:text-[14px]"
                      />
                      <button
                        type="submit"
                        disabled={resolvedStatus || chatSending}
                        aria-label={resolvedStatus ? "Kapalı" : chatSending ? "Gönderiliyor" : "Gönder"}
                        className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] text-white shadow-[0_6px_20px_-8px_rgba(0,198,255,0.55)] transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/45"
                      >
                        <SupportChatSendGlyph />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className={`touch-manipulation rounded-lg px-2 py-1 text-[11px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20 ${
                          resolvedStatus
                            ? "text-emerald-300/90 hover:text-emerald-200"
                            : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                        }`}
                        disabled={chatSending || threadBootstrap}
                        onClick={() => void onNewConversationClick()}
                      >
                        Yeni görüşme
                      </button>
                      <span className="sr-only">Enter ile gönder, Shift+Enter yeni satır</span>
                    </div>

                    {!resolvedStatus ? <SupportThreadMinimalFooter /> : null}
                  </form>
                  <button
                    type="button"
                    onClick={() => leaveThreadClearStorage()}
                    className="mt-1 w-full rounded-lg py-1 text-center text-[10px] font-medium text-slate-600 transition hover:bg-white/[0.03] hover:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/15"
                  >
                    Görüşmeyi sıfırla
                  </button>
                </div>
              </div>
            ) : showEntryGateway ? (
              <>
                <SupportPhoneModalHeader
                  titleId={titleId}
                  descId={descId}
                  statusLabel="Çevrimiçi"
                  onClose={closePanel}
                />
                <SupportEntryGateway
                  onSelectLeylek={() => setEntryIntent("leylek")}
                  onSelectLive={() => setEntryIntent("live")}
                />
              </>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <SupportPhoneModalHeader
                  titleId={titleId}
                  descId={descId}
                  statusLabel={phoneStatusLabel}
                  subtitle={composerIntentSubtitle}
                  onClose={closePanel}
                />

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-3 sm:px-5">
                  <div className="flex min-w-0 flex-col gap-2">
                    <SupportWelcomeStrip />
                    {threadBootstrap ? (
                      <p className="text-[12px] text-slate-500">Önceki görüşme kontrol ediliyor…</p>
                    ) : null}
                    <SupportAppScopeNote />
                  </div>
                </div>

                <form
                  className="relative shrink-0 border-t border-white/[0.06] bg-slate-950/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
                  onSubmit={handleComposerSubmit}
                  noValidate
                >
                  <SupportQuickTopicChips
                    compact
                    onSelect={setMessage}
                    disabled={status === "loading" || threadBootstrap}
                  />

                  <label className="relative mt-2 grid gap-1">
                    <span className="sr-only">
                      Mesajınız, en az {MESSAGE_MIN_LEN} karakter
                    </span>
                    <textarea
                      name="message"
                      title="Görüşmeyi başlatmak için mesaj"
                      aria-label={`Mesajını yaz, en az ${MESSAGE_MIN_LEN} karakter`}
                      required
                      minLength={MESSAGE_MIN_LEN}
                      rows={2}
                      value={message}
                      onChange={(ev) => setMessage(ev.target.value)}
                      disabled={status === "loading" || threadBootstrap}
                      placeholder="Mesajınızı yazın…"
                      onCompositionStart={() => {
                        composerImeComposingRef.current = true;
                      }}
                      onCompositionEnd={() => {
                        composerImeComposingRef.current = false;
                      }}
                      onKeyDown={(ev) =>
                        handleChatTextareaEnterSubmit(ev, composerImeComposingRef.current)
                      }
                      className="max-h-[8rem] min-h-[2.75rem] w-full resize-none rounded-2xl border border-white/[0.08] bg-slate-900/70 px-3 py-2.5 text-base leading-relaxed text-white outline-none transition focus:border-cyan-400/35 focus:ring-1 focus:ring-cyan-400/15 disabled:opacity-55 sm:text-[14px]"
                    />
                    <span className="sr-only">
                      En az {MESSAGE_MIN_LEN} karakter · Enter gönder · Shift+Enter yeni satır
                    </span>
                  </label>

                  <p className="mt-1.5 truncate text-[10px] text-slate-600">
                    Kayıt:{" "}
                    <span className="text-slate-500">{sessionContactEmail}</span>
                  </p>

                  <details className="group mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 text-[11px] font-medium text-slate-400 hover:text-slate-300">
                      <span>
                        Ad soyad{" "}
                        <span className="font-normal text-slate-600">(opsiyonel)</span>
                      </span>
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-open:rotate-180"
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
                    <div className="mt-2 grid gap-2 border-t border-white/[0.05] pt-2">
                      <label className="grid gap-1">
                        <span className="sr-only">Ad soyad</span>
                        <input
                          type="text"
                          name="name"
                          autoComplete="name"
                          value={name}
                          onChange={(ev) => setName(ev.target.value)}
                          disabled={status === "loading" || threadBootstrap}
                          placeholder="Ad soyad"
                          className="min-h-[36px] rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-[14px] text-white outline-none transition focus:border-cyan-400/30 disabled:opacity-55 sm:text-[13px]"
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
                    <p className="mt-2 text-[12px] font-medium leading-snug text-rose-300/95" role="alert">
                      {feedback}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-1.5">
                    <button
                      type="submit"
                      disabled={status === "loading" || cooldownActiveForUi || threadBootstrap}
                      className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_32px_-16px_rgba(0,198,255,0.45)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/45"
                    >
                      {status === "loading" ? "Başlatılıyor…" : "Görüşmeyi başlat"}
                    </button>

                    {cooldownActiveForUi ? (
                      <p className="text-center text-[10px] leading-snug text-slate-500">
                        Kısa bekleme uygulanıyor.
                        <span aria-live="polite"> ({cooldownRemainSec}s)</span>
                      </p>
                    ) : null}

                    <SupportThreadMinimalFooter />
                  </div>
                </form>
              </div>
            )}
        </SiteSupportPhoneShell>
      ) : null}

      {!open ? (
        <div className="fixed bottom-[calc(5.35rem+env(safe-area-inset-bottom,0px))] right-4 z-[72] flex w-[calc(100%-2rem)] max-w-[min(26rem,calc(100vw-2rem))] flex-col items-end max-sm:right-0 max-sm:w-full max-sm:max-w-none max-sm:px-3 md:bottom-8 md:right-8 md:w-auto md:max-w-none md:px-0">
          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={open}
            aria-controls={dialogId}
            aria-label={
              supportUnlocked
                ? "Leylek TAG destek — paneli aç"
                : "Destek — oturum açınca yazabilirsin"
            }
            className={`tap-highlight relative ml-auto inline-flex max-w-full min-w-0 touch-manipulation items-center justify-center gap-2 overflow-visible rounded-full px-3.5 py-3 pr-[1.15rem] text-[13px] shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[border-color,box-shadow,transform] sm:gap-2.5 sm:px-5 sm:pr-[1.4rem] md:w-auto md:max-w-none ${
              supportUnlocked
                ? "border border-cyan-400/26 bg-slate-950/94 font-semibold text-white ring-1 ring-cyan-400/12 hover:border-cyan-300/38 hover:shadow-[0_16px_44px_-18px_rgba(34,211,238,0.22)]"
                : "border border-amber-500/26 bg-slate-950/96 font-semibold hover:border-amber-400/38"
            }`}
          >
        {supportUnlocked ? (
          <span
            className="pointer-events-none absolute right-3 top-[0.55rem] flex h-2 w-2 shrink-0 md:right-4"
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/50 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300/90 shadow-[0_0_10px_rgba(34,211,238,0.35)]" />
          </span>
        ) : (
          <span
            className="pointer-events-none absolute right-3 top-[0.55rem] md:right-4"
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
        <LeylekZekaMark size="sm" variant="tile" className="relative z-[1] shrink-0" />
        <span className="relative z-[1] flex min-w-0 flex-1 flex-col items-start gap-0.5 leading-tight text-white/[0.94] sm:flex-row sm:flex-nowrap sm:items-baseline sm:gap-x-2">
          {supportUnlocked ? (
            <>
              <span className="text-[11.5px] font-semibold tracking-tight text-slate-200/95 sm:text-[12px]">Destek</span>
              <span className="hidden font-light text-slate-500 sm:inline" aria-hidden>
                ·
              </span>
              <span className="text-[11.5px] font-bold tracking-tight text-cyan-100/95 sm:text-[12px]">Leylek Zeka</span>
            </>
          ) : (
            <span className="max-w-[11rem] text-[11.5px] font-semibold leading-snug text-amber-100/95 sm:max-w-none sm:text-[12px]">
              Destek · giriş gerekli
            </span>
          )}
        </span>
          </button>
        </div>
      ) : null}
    </>
  );
}
