"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/site-contact";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

const MESSAGE_MIN_LEN = 10;
const SUBMIT_COOLDOWN_MS = 36_000;
const USER_AGENT_MAX = 512;

type FormStatus = "idle" | "loading" | "success" | "error";

/** Premium vitrin yüzen destek · geri bildirim paneli → Supabase `support_messages`. */
export function SiteSupportPanel() {
  const pathname = usePathname();
  const configured = useMemo(() => isSupabaseConfigured(), []);
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
        setFeedback("Destek bağlantısı yapılandırılmamış. Lütfen daha sonra tekrar dene.");
        return;
      }

      const client = getSupabaseBrowserClient();
      if (!client) {
        setStatus("error");
        setFeedback("Destek bağlantısı yapılandırılmamış. Lütfen daha sonra tekrar dene.");
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
      };

      const { error } = await client.from("support_messages").insert(payload);

      if (error) {
        setStatus("error");
        setFeedback(
          error.code === "42501" || error.message?.toLowerCase().includes("permission")
            ? "Mesaj gönderilemedi. Lütfen daha sonra tekrar dene."
            : error.code === "23514" ||
                error.message?.toLowerCase().includes("violates check constraint")
              ? `Mesaj en az ${MESSAGE_MIN_LEN} karakter olmalı.`
              : "Bir şeyler ters gitti. Lütfen tekrar dene.",
        );
        return;
      }

      cooldownEndsAtRef.current = Date.now() + SUBMIT_COOLDOWN_MS;
      bumpCooldownSession((n) => n + 1);
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    },
    [configured, honey, message, name, email, pathname, validate],
  );

  const resetSuccess = useCallback(() => {
    setStatus("idle");
  }, []);

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
            className="relative z-[73] mb-3 w-full max-w-[26rem] rounded-2xl border border-white/[0.1] bg-slate-950/[0.94] p-6 text-slate-100 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.75)] ring-1 ring-cyan-400/[0.12] backdrop-blur-2xl"
          >
            <div
              className="pointer-events-none absolute inset-px rounded-[0.9375rem] bg-gradient-to-br from-cyan-400/[0.06] via-transparent to-violet-500/[0.04]"
              aria-hidden
            />

            {!configured ? (
              <div className="relative">
                <p
                  id={titleId}
                  className="text-lg font-black leading-snug tracking-tight text-white"
                >
                  Leylek TAG ekibine ulaş
                </p>
                <p id={descId} className="mt-4 text-sm leading-relaxed text-slate-400">
                  Destek bağlantısı yapılandırılmamış. Lütfen daha sonra tekrar dene.
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
              <div className="relative">
                <p id={titleId} className="text-lg font-black leading-snug tracking-tight text-white">
                  Teşekkürler
                </p>
                <p id={descId} className="mt-3 text-sm leading-relaxed text-slate-300">
                  Mesajın alındı; ekibimiz geri bildirimleri düzenli olarak inceler.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={resetSuccess}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/40"
                  >
                    Yeni mesaj
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-xl px-4 py-2 text-center text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <p
                  id={titleId}
                  className="text-lg font-black leading-snug tracking-tight text-white"
                >
                  Leylek TAG ekibine ulaş
                </p>
                <p id={descId} className="mt-2 text-sm leading-relaxed text-slate-400">
                  Sorun mu yaşıyorsun? Geri bildirimin bizim için önemli.
                </p>

                <form className="relative mt-5 grid gap-3.5" onSubmit={handleSubmit} noValidate>
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/75">
                      Ad soyad{" "}
                      <span className="font-semibold lowercase tracking-normal text-slate-500">
                        (opsiyonel)
                      </span>
                    </span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      disabled={status === "loading"}
                      className="rounded-xl border border-white/[0.08] bg-black/35 px-3.5 py-2.5 text-sm text-white outline-none ring-0 transition focus:border-cyan-400/35 focus:bg-black/45 disabled:opacity-55"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/75">
                      E‑posta{" "}
                      <span className="font-semibold lowercase tracking-normal text-slate-500">
                        (opsiyonel)
                      </span>
                    </span>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      disabled={status === "loading"}
                      className="rounded-xl border border-white/[0.08] bg-black/35 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/35 focus:bg-black/45 disabled:opacity-55"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">
                      Mesaj
                    </span>
                    <textarea
                      name="message"
                      required
                      minLength={MESSAGE_MIN_LEN}
                      rows={4}
                      value={message}
                      onChange={(ev) => setMessage(ev.target.value)}
                      disabled={status === "loading"}
                      className="resize-y rounded-xl border border-white/[0.08] bg-black/35 px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none transition focus:border-cyan-400/35 focus:bg-black/45 disabled:opacity-55"
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
                    <p className="text-sm font-medium leading-snug text-rose-300/95" role="alert">
                      {feedback}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={status === "loading" || cooldownActiveForUi}
                    className="mt-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#00C6FF] to-[#0072FF] px-4 py-3 text-sm font-black text-white shadow-[0_16px_40px_-14px_rgba(0,198,255,0.42)] ring-1 ring-cyan-300/20 transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-55"
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
                    className="text-center text-[11px] font-semibold text-slate-500 underline-offset-4 transition hover:text-cyan-200/85 hover:underline"
                  >
                    E‑posta ile de ulaşabilirsin
                  </Link>

                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-xl px-2 py-2 text-center text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
                  >
                    Kapat
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={dialogId}
        className="ml-auto inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-400/35 bg-slate-950/92 px-4 py-3 text-sm font-black text-white shadow-[0_12px_44px_rgba(0,114,255,0.32)] backdrop-blur-md transition hover:border-cyan-300/75 hover:bg-slate-900/94 md:inline-flex md:w-auto md:px-6"
      >
        Destek · geri bildirim
      </button>
    </div>
  );
}
