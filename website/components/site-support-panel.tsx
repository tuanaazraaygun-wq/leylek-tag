"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSiteAuth } from "@/components/site-auth-provider";
import { SUPPORT_EMAIL } from "@/lib/site-contact";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

const MESSAGE_MIN_LEN = 10;
const SUBMIT_COOLDOWN_MS = 36_000;
const USER_AGENT_MAX = 512;

const LEYLEK_ZEKA_GREET =
  "Merhaba, ben Leylek Zeka. Sorununu veya önerini yaz; mesajını güvenli şekilde ekibe ileteyim.";

// AI responses must be generated server-side only. Never expose AI keys in client.

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

type FormStatus = "idle" | "loading" | "success" | "error";

/** Yüzen vitrin desteği → Supabase `support_messages` (canlı destek giriş noktası). */
export function SiteSupportPanel() {
  const pathname = usePathname();
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const { authReady, session, profile } = useSiteAuth();
  const honeyId = useId();
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  /** Gönder sonrası bekleme bitiş zamanı (ms epoch); 0 = soğuma yok */
  const cooldownEndsAtRef = useRef(0);
  const [cooldownSession, bumpCooldownSession] = useState(0);
  const [cooldownRemainSec, setCooldownRemainSec] = useState(0);

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

  const closePanel = useCallback(() => setOpen(false), []);

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

  const validate = useCallback(() => {
    const m = message.trim();
    if (m.length < MESSAGE_MIN_LEN) {
      setFeedback(`Mesaj en az ${MESSAGE_MIN_LEN} karakter olmalı.`);
      return false;
    }
    setFeedback(null);
    return true;
  }, [message]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFeedback(null);

      if (honey.trim() !== "") {
        setStatus("success");
        return;
      }

      if (cooldownEndsAtRef.current > Date.now()) {
        setFeedback("Lütfen bir süre bekleyip tekrar dene.");
        setStatus("error");
        return;
      }

      if (!validate()) {
        setStatus("error");
        return;
      }

      if (!configured) {
        setStatus("error");
        setFeedback("Destek sistemi henüz yapılandırılmamış.");
        return;
      }

      const client = getSupabaseBrowserClient();
      if (!client) {
        setStatus("error");
        setFeedback("Destek sistemi henüz yapılandırılmamış.");
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
      };

      try {
        const { error } = await client.from("support_messages").insert(payload);

        if (error) {
          setStatus("error");
          setFeedback(mapSupportMessageInsertFeedback(error));
          return;
        }

        cooldownEndsAtRef.current = Date.now() + SUBMIT_COOLDOWN_MS;
        bumpCooldownSession((n) => n + 1);
        setStatus("success");
        setName("");
        setEmail("");
        setMessage("");
      } catch {
        setStatus("error");
        setFeedback("Bir şeyler ters gitti. Lütfen tekrar dene.");
      }
    },
    [configured, honey, message, name, email, pathname, validate],
  );

  const resetSuccess = useCallback(() => {
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
            className="relative z-[73] mb-3 flex max-h-[min(38rem,calc(100vh-6rem))] w-full max-w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.1] bg-slate-950/[0.93] shadow-[0_28px_88px_-32px_rgba(0,114,255,0.45)] ring-1 ring-cyan-400/[0.08] backdrop-blur-2xl"
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
                    Leylek TAG destek
                  </p>
                  <SupportLiveBadge />
                </div>
                <p id={descId} className="mt-3 text-[13px] leading-relaxed text-slate-400">
                  Canlı ileti için Supabase bağlantısı gerekli. Şimdilik ekibimize güvenli biçimde e‑posta ile
                  ulaşabilirsin.
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
            ) : status === "success" ? (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        id={titleId}
                        className="text-[0.95rem] font-black leading-tight tracking-tight text-white sm:text-lg"
                      >
                        Leylek TAG destek
                      </p>
                      <p id={descId} className="mt-1 text-[13px] leading-relaxed text-slate-400">
                        Mesajın ekibe iletilir.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SupportLiveBadge />
                        <span className="inline-flex items-center rounded-full border border-cyan-400/28 bg-cyan-400/[0.1] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-100">
                          Leylek Zeka
                        </span>
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
                    <div className="max-w-[min(100%,19rem)] self-start rounded-2xl rounded-tl-md border border-white/[0.09] bg-black/42 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.07)] backdrop-blur-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/75">
                        Leylek Zeka
                      </p>
                      <p className="mt-2 break-words text-[13px] leading-relaxed text-slate-100/96">
                        {LEYLEK_ZEKA_GREET}
                      </p>
                    </div>
                    <div className="max-w-[min(100%,19rem)] self-start rounded-2xl rounded-tl-md border border-cyan-400/22 bg-[linear-gradient(135deg,rgba(34,211,238,0.08)_0%,rgba(15,23,42,0.65)_52%)] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12)] backdrop-blur-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/82">
                        Leylek Zeka
                      </p>
                      <p className="mt-2 break-words text-[13px] leading-relaxed text-slate-50/96">
                        Mesajın alındı. Leylek TAG ekibi geri bildirimleri düzenli olarak inceler.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 border-t border-white/[0.07] px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={resetSuccess}
                      className="min-h-[44px] rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/40"
                    >
                      Yeni mesaj
                    </button>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="min-h-[40px] rounded-xl px-4 py-2 text-center text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        id={titleId}
                        className="text-[0.95rem] font-black leading-tight tracking-tight text-white sm:text-lg"
                      >
                        Leylek TAG destek
                      </p>
                      <p id={descId} className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                        Mesajın ekibe iletilir.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SupportLiveBadge />
                        <span className="inline-flex items-center rounded-full border border-cyan-400/28 bg-cyan-400/[0.1] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-100">
                          Leylek Zeka
                        </span>
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
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="max-w-[min(100%,19rem)] self-start rounded-2xl rounded-tl-md border border-white/[0.08] bg-black/42 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.06)] backdrop-blur-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/75">
                        Leylek Zeka
                      </p>
                      <p className="mt-2 break-words text-[13px] leading-relaxed text-slate-100/96">
                        {LEYLEK_ZEKA_GREET}
                      </p>
                      <p className="mt-3 break-words text-[11.5px] leading-relaxed text-slate-500">
                        İsim ve e‑posta yeniden iletişim için yardımcı olabilir — zorunlu değiller.
                      </p>
                    </div>
                  </div>
                </div>

                <form
                  className="relative shrink-0 border-t border-white/[0.07] bg-black/35 px-4 py-4 sm:px-5"
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/72">
                        Ad soyad{" "}
                        <span className="font-semibold lowercase tracking-normal text-slate-500">
                          opsiyonel
                        </span>
                      </span>
                      <input
                        type="text"
                        name="name"
                        autoComplete="name"
                        value={name}
                        onChange={(ev) => setName(ev.target.value)}
                        disabled={status === "loading"}
                        className="min-h-[42px] rounded-xl border border-white/[0.08] bg-black/55 px-3 py-2 text-[13px] text-white outline-none transition focus:border-cyan-400/35 disabled:opacity-55"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/72">
                        E‑posta{" "}
                        <span className="font-semibold lowercase tracking-normal text-slate-500">
                          opsiyonel
                        </span>
                      </span>
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        disabled={status === "loading"}
                        className="min-h-[42px] rounded-xl border border-white/[0.08] bg-black/55 px-3 py-2 text-[13px] text-white outline-none transition focus:border-cyan-400/35 disabled:opacity-55"
                      />
                    </label>
                  </div>

                  <label className="relative mt-3 grid gap-1.5">
                    <span className="sr-only">Mesaj</span>
                    <span
                      aria-hidden
                      className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/75"
                    >
                      Mesajın{" "}
                      <span className="font-semibold lowercase tracking-normal text-slate-500">
                        ({MESSAGE_MIN_LEN}+ karakter)
                      </span>
                    </span>
                    <textarea
                      name="message"
                      title="Mesaj"
                      aria-label={`Mesaj, en az ${MESSAGE_MIN_LEN} karakter`}
                      required
                      minLength={MESSAGE_MIN_LEN}
                      rows={3}
                      value={message}
                      onChange={(ev) => setMessage(ev.target.value)}
                      disabled={status === "loading"}
                      placeholder="Özetle yaz…"
                      className="min-h-[92px] resize-none rounded-[1rem] rounded-tr-md border border-cyan-400/18 bg-gradient-to-br from-white/[0.07] to-black/40 px-3.5 py-3 text-[13px] leading-relaxed text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] outline-none transition focus:border-cyan-400/40 disabled:opacity-55"
                    />
                  </label>

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
                    <p className="mt-2 text-[13px] font-medium leading-snug text-rose-300/95" role="alert">
                      {feedback}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={status === "loading" || cooldownActiveForUi}
                      className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_14px_36px_-18px_rgba(0,198,255,0.45)] ring-1 ring-cyan-300/18 transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {status === "loading" ? "Gönderiliyor…" : "Gönder"}
                    </button>

                    {cooldownActiveForUi ? (
                      <p className="text-center text-[11px] leading-snug text-slate-500">
                        Gönderiler arasında kısa bir bekleme uygulanır.
                        <span aria-live="polite"> ({cooldownRemainSec}s)</span>
                      </p>
                    ) : null}

                    <Link
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Leylek TAG destek · geri bildirim")}`}
                      className="py-1 text-center text-[11px] font-semibold text-slate-500 underline-offset-4 transition hover:text-cyan-200/85 hover:underline"
                    >
                      E‑posta ile de ulaşabilirsin
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
        className="tap-highlight relative ml-auto inline-flex max-w-full min-w-0 touch-manipulation items-center justify-center gap-1 overflow-visible rounded-full border border-cyan-400/32 bg-slate-950/92 px-3 py-3 pr-[1.375rem] text-[13px] font-black shadow-[0_14px_48px_rgba(0,114,255,0.28)] backdrop-blur-md transition-[border-color,box-shadow] hover:border-cyan-300/55 hover:shadow-[0_16px_52px_rgba(0,198,255,0.22)] sm:gap-2 sm:px-5 sm:pr-6 md:w-auto md:max-w-none"
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
