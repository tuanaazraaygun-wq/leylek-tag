"use client";

import { FormEvent, useState } from "react";

const interests = ["şehir içi", "teklif akışı", "şehirler arası"];

export function EarlyAccessForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: Connect this form to the early access API when the launch backend is ready.
    setIsSubmitted(true);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-[2rem] p-6 sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">erken erişim formu</p>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">Beta topluluğuna katıl</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Bilgilerini bırak, Leylek Tag beta süreci ve uygulama yayını için seni bilgilendirelim.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Ad soyad
          <input
            name="fullName"
            required
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/50"
            placeholder="Adın ve soyadın"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          E-posta
          <input
            name="email"
            type="email"
            required
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/50"
            placeholder="ornek@eposta.com"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Şehir
          <input
            name="city"
            required
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/50"
            placeholder="Bulunduğun şehir"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          İlgi alanı
          <select
            name="interest"
            required
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-200/50"
            defaultValue=""
          >
            <option value="" disabled>
              Seç
            </option>
            {interests.map((interest) => (
              <option key={interest} value={interest}>
                {interest}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-cyan-200 via-cyan-300 to-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-glow transition hover:-translate-y-0.5 sm:w-auto"
      >
        Beta topluluğuna katıl
      </button>

      {isSubmitted ? (
        <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Teşekkürler, erken erişim talebin yerel olarak alındı. API bağlantısı eklendiğinde bu form canlı çalışacak.
        </p>
      ) : null}
    </form>
  );
}
