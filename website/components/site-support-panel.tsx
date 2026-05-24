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
import { requestSupportLeylekZeka, type LeylekZekaErrorCode } from "@/lib/support-leylek-zeka-client";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

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
      className={`inline-flex items-center rounded-full border border-cyan-400/28 bg-cyan-500/[0.1] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-50/95 ${className}`}
    >
      Leylek Zeka
    </span>
  );
}

function SupportResponseCenterBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.11em] text-slate-300/90">
      <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-300/80" aria-hidden />
      Destek merkezi
    </span>
  );
}

function SupportWelcomeCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-cyan-400/20 bg-[linear-gradient(152deg,rgba(34,211,238,0.1)_0%,rgba(15,23,42,0.88)_52%,rgba(8,47,73,0.42)_100%)] shadow-[inset_0_0_0_1px_rgba(103,232,249,0.1)] backdrop-blur-md ${
        compact ? "px-3 py-2.5 sm:rounded-2xl sm:px-3.5 sm:py-3" : "rounded-[1.05rem] px-3.5 py-3 sm:rounded-[1.15rem] sm:px-4 sm:py-3.5"
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-cyan-400/[0.08] blur-2xl" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-2">
        <SupportLeylekBadge />
        <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">bilgilendirme</span>
      </div>
      <p className="relative mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-100/80">
        Karşılama
      </p>
      <p className={`relative mt-1.5 break-words leading-relaxed text-slate-50/95 ${compact ? "text-[12.5px]" : "text-[13px]"}`}>
        {LIVE_SUPPORT_WELCOME}
      </p>
    </div>
  );
}

function SupportAppScopeNote() {
  return (
    <p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
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
        className={`font-bold uppercase tracking-[0.12em] text-slate-500 ${compact ? "text-[9px]" : "text-[10px]"}`}
      >
        Hızlı konular
      </p>
      <div className={`flex flex-wrap ${compact ? "mt-1 gap-1" : "mt-2 gap-1.5"}`}>
        {SUPPORT_QUICK_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(topic.prompt)}
            className={`rounded-lg border border-white/[0.09] bg-slate-950/50 font-semibold text-slate-200 transition hover:border-cyan-400/28 hover:bg-cyan-400/[0.06] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-45 ${
              compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
            }`}
          >
            {topic.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SupportHumanFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">İnsan destek</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        Ekibimiz müsait olduğunda yanıtlar. Anında bağlantı taahhüdü sunulmaz.
      </p>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG · Destek")}`}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-cyan-200/90 underline-offset-2 transition hover:text-cyan-100 hover:underline"
      >
        {SUPPORT_EMAIL}
      </a>
    </div>
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

/** Kuyruk / bekleme metni — yanıtlar zamanı garanti etmez; sürekli çevrimiçi çağrı merkezi iddiası yok. */
const LIVE_SUPPORT_QUEUE_COPY = `Talebin alındı ve destek ekibine iletildi.
Müsait olduklarında yanıtlar bu akışta görünür; süre net olarak garanti edilmez.
İstersen bu pencereyi kapatabilir veya e‑posta ile de ulaşabilirsin.`;

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

  const resolveSiteAccessToken = useCallback(async (): Promise<string> => {
    const fromSession = session?.access_token?.trim();
    if (fromSession) return fromSession;
    const client = getSupabaseBrowserClient();
    if (!client) return "";
    const { data } = await client.auth.getSession();
    return data.session?.access_token?.trim() ?? "";
  }, [session?.access_token]);

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
        void invokeLeylekZekaAfterUserMessage(ticketId, tk, body, ticketMeta, nextLines);
      } finally {
        setChatSending(false);
      }
    },
    [
      chatInput,
      chatLines,
      chatSending,
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
      ? "Görüşme açık — destek ekibinin yanıtları aşağıdaki akışta."
      : hasAssignedAdmin
        ? "Destek ekibi görüşmeye dahil oldu; ilk mesajlar yükleniyor."
        : "Talebin alındı — destek ekibi uygun olduğunda yanıtlar burada görünecek.";

  return (
    <div className="fixed bottom-[calc(5.35rem+env(safe-area-inset-bottom,0px))] right-4 z-[72] flex w-[calc(100%-2rem)] max-w-[min(26rem,calc(100vw-2rem))] flex-col items-end max-sm:right-0 max-sm:w-full max-sm:max-w-none max-sm:px-3 md:bottom-8 md:right-8 md:w-auto md:max-w-none md:px-0">
      {open ? (
        <>
          <button
            type="button"
            aria-label="Panoyu kapat"
            onClick={closePanel}
            className="fixed inset-0 z-[71] bg-black/50 backdrop-blur-[4px]"
          />

          <div
            role="dialog"
            id={dialogId}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="relative z-[73] mb-3 flex max-h-[min(42rem,calc(100vh-5rem))] w-full max-w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.1] bg-slate-950/[0.96] shadow-[0_24px_80px_-28px_rgba(0,114,255,0.45),0_0_48px_-14px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-cyan-400/10 backdrop-blur-2xl max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:mb-0 max-sm:max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-bottom,0px)-4.5rem))] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-[1.35rem] max-sm:border-b-0 md:max-w-[min(24rem,calc(100vw-2rem))]"
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
                <div className="shrink-0 border-b border-white/[0.07] px-4 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4 md:px-6">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <p
                        id={titleId}
                        className="text-[0.95rem] font-black leading-tight tracking-tight text-white sm:text-lg"
                      >
                        Leylek TAG Destek
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
                        <SupportResponseCenterBadge />
                        <SupportLeylekBadge />
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

                <div
                  ref={chatScrollContainerRef}
                  className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-3 md:px-5"
                >
                  <div className="flex min-w-0 flex-col gap-2 pb-2 sm:gap-2.5">
                    {threadBootstrap ? (
                      <p className="text-[12px] text-slate-500">Senkronize ediliyor…</p>
                    ) : null}

                    <SupportWelcomeCard compact />

                    {!resolvedStatus && !hasAdminReplyInThread && !hasAssignedAdmin ? (
                      <div className="max-w-[min(100%,21rem)] self-start rounded-xl rounded-tl-sm border border-cyan-400/22 bg-[linear-gradient(148deg,rgba(34,211,238,0.08)_0%,rgba(15,23,42,0.75)_55%)] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.1)] backdrop-blur-sm sm:rounded-2xl sm:px-3.5 sm:py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/78">
                          İşlem sırasında
                        </p>
                        <p className="mt-2 whitespace-pre-line break-words text-[12.5px] font-medium leading-relaxed text-slate-200/95">
                          {LIVE_SUPPORT_QUEUE_COPY}
                        </p>
                      </div>
                    ) : null}
                    {!resolvedStatus && !hasAdminReplyInThread && hasAssignedAdmin ? (
                      <div className="max-w-[min(100%,21rem)] self-start rounded-xl rounded-tl-sm border border-sky-400/28 bg-sky-500/[0.1] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)] backdrop-blur-sm sm:rounded-2xl sm:px-3.5 sm:py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/90">
                          Destek ekibi
                        </p>
                        <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-slate-50/94">
                          Görüşmeye dahil olundu; karşılama ve yanıtlar hazırlandığında akışta görünür (anında garanti verilmez).
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
                          <div key={ln.id} className="flex justify-start px-0.5">
                            <div
                              className={`${baseWrap} max-w-[min(100%,19rem)] self-start rounded-tl-sm border-cyan-400/32 bg-gradient-to-br from-cyan-600/18 to-slate-950/88 text-slate-50 ring-1 ring-cyan-400/14 sm:rounded-tl-md`}
                            >
                              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100/92">
                                Leylek Zeka
                              </span>
                              <div className="mt-1 whitespace-pre-wrap text-[13px] leading-snug">{ln.body}</div>
                              {timeLabel ? (
                                <time
                                  className="mt-1 block font-mono text-[10px] font-medium tabular-nums text-cyan-100/50"
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
                          <div key={ln.id} className="flex justify-start px-0.5">
                            <div
                              className={`${baseWrap} max-w-[min(100%,19rem)] self-start rounded-tl-sm border-violet-400/30 bg-gradient-to-br from-violet-600/16 to-slate-950/88 text-slate-50 ring-1 ring-violet-400/12 sm:rounded-tl-md`}
                            >
                              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-100/90">
                                Destek
                              </span>
                              <div className="mt-1 whitespace-pre-wrap">{ln.body}</div>
                              {timeLabel ? (
                                <time
                                  className="mt-1 block font-mono text-[10px] font-medium tabular-nums text-violet-100/50"
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
                        <div key={ln.id} className="flex justify-end px-0.5">
                          <div
                            className={`${baseWrap} max-w-[min(100%,19rem)] self-end rounded-tr-sm border-white/[0.12] bg-gradient-to-br from-[#0072FF]/35 to-slate-900/90 text-slate-50 ring-1 ring-cyan-400/10 sm:rounded-tr-md`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100/75">
                              Sen
                            </span>
                            <div className="mt-1 whitespace-pre-wrap">{ln.body}</div>
                            {timeLabel ? (
                              <time
                                className="mt-1 block text-right font-mono text-[10px] font-medium tabular-nums text-cyan-100/45"
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
                      <div className="flex justify-end px-0.5" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tr-sm border border-cyan-400/30 bg-cyan-500/[0.12] px-3 py-2 text-[11px] font-semibold text-cyan-50 ring-1 ring-cyan-400/18">
                          <span
                            aria-hidden
                            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-cyan-200/25 border-t-cyan-100"
                          />
                          Gönderiliyor…
                        </div>
                      </div>
                    ) : null}
                    {aiTyping ? (
                      <div className="flex justify-start px-0.5" role="status" aria-live="polite">
                        <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-tl-sm border border-cyan-400/32 bg-gradient-to-r from-cyan-500/12 to-slate-950/80 px-3 py-2 ring-1 ring-cyan-400/16">
                          <span className="flex gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:280ms]" />
                          </span>
                          <span className="text-[11px] font-semibold text-cyan-50/95">Leylek Zeka yazıyor…</span>
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
                  <div className="shrink-0 px-5 pt-2 text-[12px] font-medium leading-snug text-cyan-100/93" role="status" aria-live="polite">
                    {chatBanner}
                  </div>
                ) : null}
                {leylekZekaBanner ? (
                  <div className="shrink-0 px-5 pt-2 text-[12px] font-medium leading-snug text-amber-100/90" role="status" aria-live="polite">
                    {leylekZekaBanner}
                  </div>
                ) : null}

                <div className="relative shrink-0 border-t border-white/[0.07] bg-black/45 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-2.5 md:px-5">
                  <div className="mt-1.5">
                    <SupportQuickTopicChips
                      compact
                      onSelect={setChatInput}
                      disabled={resolvedStatus || chatSending}
                    />
                  </div>
                  <form onSubmit={handleSendChat} className="mt-2">
                    <textarea
                      value={chatInput}
                      aria-label="Sohbet mesajı"
                      rows={1}
                      placeholder={
                        resolvedStatus ? "Çözülü görüşmede yazı gönderilemez." : "Mesajınızı yazın… (Enter gönder)"
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
                      className="max-h-[7.5rem] min-h-[2.75rem] w-full resize-none rounded-xl rounded-tr-md border border-cyan-400/22 bg-slate-950/75 px-3 py-2 text-[13px] leading-relaxed text-white outline-none transition focus:border-cyan-400/45 focus:ring-2 focus:ring-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={resolvedStatus || chatSending}
                        className="inline-flex min-h-[42px] flex-1 touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-2.5 text-[13px] font-black tracking-tight text-white shadow-[0_10px_32px_-14px_rgba(0,198,255,0.45)] ring-1 ring-cyan-300/20 transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {resolvedStatus ? "Kapalı" : chatSending ? "Gönderiliyor…" : "Gönder"}
                      </button>
                      <button
                        type="button"
                        className={`inline-flex min-h-[42px] shrink-0 touch-manipulation items-center justify-center rounded-xl border px-3 py-2.5 text-[12px] font-bold leading-tight transition ${
                          resolvedStatus
                            ? "border-emerald-400/45 bg-emerald-500/[0.12] text-emerald-50/95 hover:border-emerald-400/62"
                            : "border-white/[0.12] bg-white/[0.06] text-slate-50 hover:border-cyan-400/25 hover:bg-white/[0.08]"
                        }`}
                        disabled={chatSending || threadBootstrap}
                        onClick={() => void onNewConversationClick()}
                      >
                        Yeni
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-500">Enter gönder · Shift+Enter yeni satır</p>

                    {!resolvedStatus ? (
                      <SupportHumanFallback className="mt-2" />
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
                        Leylek TAG Destek
                      </p>
                      <p id={descId} className="mt-2 text-[12px] leading-relaxed text-slate-400 sm:text-[13px]">
                        Leylek Zeka bilgilendirme sağlar; mesajların destek ekibine iletilmesi için bu pencereden yazabilirsin.{" "}
                        <span className="font-medium text-slate-300">{sessionContactEmail}</span> kayda geçer.
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <SupportResponseCenterBadge />
                        <SupportLeylekBadge />
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

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-3 sm:px-5">
                  <div className="flex min-w-0 flex-col gap-2.5">
                    <SupportWelcomeCard compact />
                    <SupportQuickTopicChips
                      compact
                      onSelect={setMessage}
                      disabled={status === "loading" || threadBootstrap}
                    />
                    <SupportAppScopeNote />
                  </div>
                </div>

                <form
                  className="relative shrink-0 border-t border-white/[0.07] bg-black/38 px-4 py-3 sm:px-5"
                  onSubmit={handleComposerSubmit}
                  noValidate
                >
                  <label className="relative grid gap-1.5">
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
                      placeholder="Mesajını yaz… (Enter ile başlat)"
                      onCompositionStart={() => {
                        composerImeComposingRef.current = true;
                      }}
                      onCompositionEnd={() => {
                        composerImeComposingRef.current = false;
                      }}
                      onKeyDown={(ev) =>
                        handleChatTextareaEnterSubmit(ev, composerImeComposingRef.current)
                      }
                      className="max-h-[8rem] min-h-[3.25rem] w-full resize-none rounded-xl rounded-tr-md border border-cyan-400/22 bg-slate-950/75 px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none transition focus:border-cyan-400/45 focus:ring-2 focus:ring-cyan-400/15 disabled:opacity-55"
                    />
                    <span className="text-[10px] font-medium text-slate-500">
                      En az {MESSAGE_MIN_LEN} karakter · Enter gönder · Shift+Enter yeni satır
                    </span>
                  </label>

                  <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Destek kaydı e-postası
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[11px] font-medium text-slate-200">
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
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG · Destek talebi")}`}
                      className="py-1 text-center text-[11px] font-semibold text-slate-500 underline-offset-4 transition hover:text-cyan-200/85 hover:underline"
                    >
                      {SUPPORT_EMAIL}
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
            ? "Leylek TAG destek — paneli aç"
            : "Destek — oturum açınca yazabilirsin"
        }
        className={`tap-highlight relative ml-auto inline-flex max-w-full min-w-0 touch-manipulation items-center justify-center gap-2 overflow-visible rounded-full px-3.5 py-3 pr-[1.15rem] text-[13px] shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[border-color,box-shadow,transform] sm:gap-2.5 sm:px-5 sm:pr-[1.4rem] md:w-auto md:max-w-none ${
          supportUnlocked
            ? "border border-cyan-400/26 bg-slate-950/94 font-semibold text-white ring-1 ring-cyan-400/12 hover:border-cyan-300/38 hover:shadow-[0_16px_44px_-18px_rgba(34,211,238,0.22)]"
            : "border border-amber-500/26 bg-slate-950/96 font-semibold hover:border-amber-400/38"
        } ${open ? "max-sm:opacity-0 max-sm:pointer-events-none" : ""}`}
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
        <SupportHeadsetGlyph className="relative z-[1] h-[1.05rem] w-[1.05rem] shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]" />
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
  );
}
