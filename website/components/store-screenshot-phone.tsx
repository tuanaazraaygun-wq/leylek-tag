"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

export type StoreScreenshotFit = "contain" | "cover";
export type StoreScreenshotPresentation = "device" | "app-store";

type StoreScreenshotPhoneProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  widthClass?: string;
  fit?: StoreScreenshotFit;
  /** Daha düz çerçeve; carousel vitrinleri için daha az parlama */
  ambient?: "default" | "quiet";
  /** App Store iPad export — cihaz mockup’u olmadan düz premium kart */
  presentation?: StoreScreenshotPresentation;
};

function StoreScreenshotPhoneInner({
  src,
  fallbackSrc,
  alt,
  className = "",
  widthClass = "max-w-[280px]",
  fit = "contain",
  ambient = "default",
  presentation = "device",
}: StoreScreenshotPhoneProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [visible, setVisible] = useState(true);

  const imgFit = fit === "contain" ? "object-contain object-center" : "object-cover object-top";

  const onError = useCallback(() => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setVisible(false);
  }, [currentSrc, fallbackSrc]);

  const missingFallback = (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/45">Leylek TAG</span>
      <p className="max-w-[14rem] text-xs font-medium leading-relaxed text-slate-500">
        Görsel yüklenemedi — dosyanın doğru klasörde olduğunu kontrol et.
      </p>
    </div>
  );

  if (presentation === "app-store") {
    return (
      <div
        className={`relative mx-auto overflow-hidden rounded-2xl border border-white/[0.1] bg-[#070d14] shadow-[0_24px_80px_rgba(0,0,0,0.42)] ring-1 ring-white/[0.06] ${widthClass} ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,transparent_42%)]" aria-hidden />
        <div className="relative aspect-[2048/2732] w-full bg-gradient-to-b from-[#070d18] via-[#0a1628] to-[#050a14]">
          {visible ? (
            <Image
              key={currentSrc}
              src={currentSrc}
              alt={alt}
              width={2048}
              height={2732}
              className={`h-full w-full ${imgFit}`}
              sizes="(max-width: 768px) 94vw, 360px"
              onError={onError}
              unoptimized
            />
          ) : (
            missingFallback
          )}
        </div>
      </div>
    );
  }

  const shell =
    ambient === "quiet"
      ? `relative mx-auto rounded-[2rem] border border-white/[0.09] bg-slate-950/95 p-2 shadow-[0_14px_48px_rgba(0,0,0,0.42)] ${className}`
      : `relative mx-auto rounded-[2.35rem] border border-white/[0.12] bg-gradient-to-b from-slate-900/95 to-slate-950 p-[10px] shadow-[0_28px_90px_rgba(0,114,255,0.14)] ring-1 ring-cyan-400/[0.12] ${className}`;

  return (
    <div className={`${shell} ${widthClass}`}>
      {ambient !== "quiet" ? (
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(34,211,238,0.08),transparent)]" />
      ) : (
        <div className="pointer-events-none absolute inset-0 rounded-[1.72rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_48%)]" />
      )}
      <div
        className={`relative overflow-hidden rounded-[1.85rem] bg-black shadow-inner ${
          ambient === "quiet" ? "ring-1 ring-white/[0.055]" : "ring-1 ring-white/[0.06]"
        }`}
      >
        <div className="aspect-[1080/2340] w-full bg-gradient-to-b from-[#070d18] via-[#0a1628] to-[#050a14]">
          {visible ? (
            <Image
              key={currentSrc}
              src={currentSrc}
              alt={alt}
              width={1080}
              height={2340}
              className={`h-full w-full ${imgFit}`}
              sizes="(max-width: 768px) 85vw, 320px"
              onError={onError}
              unoptimized
            />
          ) : (
            missingFallback
          )}
        </div>
      </div>
      <div className={`mx-auto mt-1.5 rounded-full bg-white/[0.1] ${ambient === "quiet" ? "h-0.5 w-10" : "h-1 w-14"} `} aria-hidden />
    </div>
  );
}

export function StoreScreenshotPhone(props: StoreScreenshotPhoneProps) {
  return <StoreScreenshotPhoneInner key={props.src} {...props} />;
}
