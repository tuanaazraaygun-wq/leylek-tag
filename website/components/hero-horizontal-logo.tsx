import { BRANDING_PATHS } from "@/lib/branding-assets";
import { BrandingImage } from "@/components/branding-image";

type HeroHorizontalLogoProps = {
  className?: string;
};

/** Hero üstünde yatay wordmark — neon glow ile mevcut tema */
export function HeroHorizontalLogo({ className = "" }: HeroHorizontalLogoProps) {
  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-400/15 via-transparent to-violet-400/15 blur-xl" />
      <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:px-5 sm:py-3.5">
        <BrandingImage
          sources={[BRANDING_PATHS.logoHorizontal, BRANDING_PATHS.logoHorizontalPngFallback]}
          alt="Leylek TAG"
          width={560}
          height={112}
          className="h-10 w-auto max-h-11 object-contain object-left sm:h-12 sm:max-h-[52px]"
          priority
          unoptimized
        />
      </div>
    </div>
  );
}
