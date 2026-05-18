"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class SupportAdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SupportAdminErrorBoundary]", error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="mx-auto flex min-h-[62vh] max-w-lg flex-col justify-center px-4 py-20 text-center">
        <div className="rounded-2xl border border-white/[0.1] bg-slate-950/[0.9] px-6 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-rose-200/82">Panel</p>
          <h1 className="mt-3 text-xl font-black tracking-tight text-white md:text-[1.35rem]">
            Ön yüz yüklenirken kesinti oluştu
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Teknik olarak güvenli kurtarma: sayfayı yenileyin. Sorun devam ederse farklı tarayıcı sekmesi veya
            özel pencerede deneyin.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="mt-10 inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-5 text-[13px] font-black text-white shadow-[0_14px_40px_-12px_rgba(34,211,238,0.45)] ring-1 ring-cyan-200/25 transition hover:brightness-105 active:brightness-95 sm:w-auto sm:min-w-[12rem]"
          >
            Sayfayı yenile
          </button>
        </div>
      </section>
    );
  }
}
