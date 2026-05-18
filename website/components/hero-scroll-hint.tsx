"use client";

import Link from "next/link";

export function HeroScrollHint() {
  return (
    <Link
      href="#nasil-calisir-flow"
      className="group mt-10 flex flex-col items-center gap-2.5 outline-none sm:mt-11 sm:items-start md:mt-12"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-slate-500 transition group-hover:text-cyan-200/88">
        Akış özeti
      </span>
      <span className="relative flex h-11 w-9 items-start justify-center rounded-full border border-white/[0.07] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[2px] transition group-hover:border-cyan-400/22 group-hover:bg-white/[0.05]">
        <span className="hero-scroll-dot mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300/88 motion-reduce:animate-none" />
      </span>
    </Link>
  );
}
