import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Küçük güven / ek bilgi satırı (CTA’nın hemen altında). */
  ctaHint?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  primaryHref = "/indir",
  primaryLabel = "Uygulamayı İndir",
  secondaryHref,
  secondaryLabel,
  ctaHint,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16 md:py-[4.5rem]">
      <div className="absolute inset-0 -z-10 bg-radial-glow opacity-80" />
      <Container>
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/80">{eyebrow}</p>
          <h1 className="mt-4 text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-white sm:text-[2.125rem] md:text-[2.375rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-base">{description}</p>
          <div className="mt-7 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={primaryHref} className="w-full sm:w-auto sm:min-w-[200px]">
              {primaryLabel}
            </ButtonLink>
            {secondaryHref && secondaryLabel ? (
              <ButtonLink href={secondaryHref} variant="secondary" className="w-full sm:w-auto sm:min-w-[200px]">
                {secondaryLabel}
              </ButtonLink>
            ) : null}
          </div>
          {ctaHint ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{ctaHint}</p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
