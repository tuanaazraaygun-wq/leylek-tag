import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  /** Küçük güven / ek bilgi satırı (CTA’nın hemen altında). */
  ctaHint?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  primaryHref = "/indir",
  primaryLabel = "Uygulamayı İndir",
  ctaHint,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div className="absolute inset-0 -z-10 bg-radial-glow opacity-80" />
      <Container>
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">{eyebrow}</p>
          <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{description}</p>
          <ButtonLink href={primaryHref} className="mt-8">
            {primaryLabel}
          </ButtonLink>
          {ctaHint ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{ctaHint}</p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
