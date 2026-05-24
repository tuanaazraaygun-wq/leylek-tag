"use client";

import { useState } from "react";
import { BRANDING_PATHS } from "@/lib/branding-assets";

const LOGO_SVG = "/logo-leylek.svg";
const LOGO_PNG_FALLBACK = BRANDING_PATHS.logoMark;

type LeylekZekaMarkProps = {
  size?: "sm" | "md" | "lg";
  variant?: "tile" | "plain";
  className?: string;
};

const TILE_CLASS: Record<NonNullable<LeylekZekaMarkProps["size"]>, string> = {
  sm: "h-7 w-7 rounded-[10px]",
  md: "h-9 w-9 rounded-[12px]",
  lg: "h-11 w-11 rounded-[14px]",
};

const MARK_CLASS: Record<NonNullable<LeylekZekaMarkProps["size"]>, string> = {
  sm: "h-[18px] w-[18px]",
  md: "h-[22px] w-[22px]",
  lg: "h-[28px] w-[28px]",
};

export function LeylekZekaMark({
  size = "md",
  variant = "tile",
  className = "",
}: LeylekZekaMarkProps) {
  const [src, setSrc] = useState(LOGO_SVG);

  const mark = (
    // eslint-disable-next-line @next/next/no-img-element -- dekoratif mark; küçük SVG/PNG fallback
    <img
      src={src}
      alt=""
      aria-hidden
      className={`${MARK_CLASS[size]} shrink-0 object-contain`}
      onError={() => {
        if (src !== LOGO_PNG_FALLBACK) setSrc(LOGO_PNG_FALLBACK);
      }}
    />
  );

  if (variant === "plain") {
    return <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>{mark}</span>;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border border-cyan-400/28 bg-[rgba(15,30,52,0.88)] shadow-[0_0_12px_-6px_rgba(34,211,238,0.28)] ${TILE_CLASS[size]} ${className}`}
      aria-hidden
    >
      {mark}
    </span>
  );
}
