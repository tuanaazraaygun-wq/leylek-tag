"use client";

import { useState } from "react";

import type { KycReviewAction } from "@/lib/kyc-admin-types";

type KycActionDialogProps = {
  open: boolean;
  action: KycReviewAction;
  userName: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payload: { user_message: string; admin_note: string }) => void;
};

const TITLES: Record<KycReviewAction, string> = {
  approve: "Başvuruyu onayla",
  reject: "Başvuruyu reddet",
  request_docs: "Eksik belge iste",
};

const CONFIRM_LABELS: Record<KycReviewAction, string> = {
  approve: "Onayla",
  reject: "Reddet",
  request_docs: "Eksik belge iste",
};

export function KycActionDialog({
  open,
  action,
  userName,
  loading,
  error,
  onClose,
  onConfirm,
}: KycActionDialogProps) {
  const [userMessage, setUserMessage] = useState("");
  const [adminNote, setAdminNote] = useState("");

  if (!open) return null;

  const needsUserMessage = action === "reject" || action === "request_docs";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyc-action-title"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="kyc-action-title" className="text-base font-bold text-white">
          {TITLES[action]}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{userName}</p>

        {action === "approve" ? (
          <p className="mt-3 text-xs text-slate-400">
            Onay sonrası kullanıcı sürücü olarak doğrulanır ve araç tipi onaylı listeye eklenir.
          </p>
        ) : null}

        {needsUserMessage ? (
          <label className="mt-4 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Kullanıcıya mesaj <span className="text-rose-300">*</span>
            </span>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              rows={3}
              disabled={loading}
              placeholder={
                action === "request_docs"
                  ? "Hangi belgeler eksik?"
                  : "Red gerekçesini yazın…"
              }
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35 disabled:opacity-50"
            />
          </label>
        ) : null}

        <label className="mt-3 block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Admin notu {action === "approve" ? "(opsiyonel)" : "(opsiyonel, kullanıcıya gitmez)"}
          </span>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
            disabled={loading}
            placeholder="İç not…"
            className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35 disabled:opacity-50"
          />
        </label>

        {error ? (
          <p className="mt-3 text-xs text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/12 py-2.5 text-xs font-bold text-slate-300 disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={loading || (needsUserMessage && !userMessage.trim())}
            onClick={() =>
              onConfirm({
                user_message: userMessage.trim(),
                admin_note: adminNote.trim(),
              })
            }
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold disabled:opacity-50 ${
              action === "approve"
                ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35"
                : action === "reject"
                  ? "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/35"
                  : "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35"
            }`}
          >
            {loading ? "İşleniyor…" : CONFIRM_LABELS[action]}
          </button>
        </div>
      </div>
    </div>
  );
}
