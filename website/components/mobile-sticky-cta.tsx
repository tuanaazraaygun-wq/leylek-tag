"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileStickyCta() {
  const pathname = usePathname();
  const onDownloadPage = pathname === "/indir";

  const label = onDownloadPage ? "Uygulamayı aç" : "Yolunu bul";
  const href = onDownloadPage ? "/indir#indir-magaza" : "/indir";

  return (
    <div className="safe-bottom fixed bottom-0 left-0 right-0 z-[60] border-t border-white/10 bg-slate-950/92 px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden">
      <Link
        href={href}
        className="tap-highlight flex min-h-[52px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00C6FF] to-[#0072FF] text-center text-sm font-black text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.98]"
      >
        {label}
      </Link>
    </div>
  );
}
