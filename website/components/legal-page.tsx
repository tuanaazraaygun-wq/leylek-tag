import Link from "next/link";
import { Container } from "@/components/container";
import type { LegalSection } from "@/lib/legal-content";
import type { PrivacyLocale } from "@/lib/privacy-policy-locales";

export type LegalPageDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalContactBlock = {
  company: string;
  label: string;
  emails: readonly string[];
  phone: string;
  dataControllerLabel: string;
};

export type LegalLanguageSwitch = {
  activeLocale: PrivacyLocale;
  options: ReadonlyArray<{ locale: PrivacyLocale; label: string; href: string }>;
};

type Props = {
  document: LegalPageDocument;
  contact?: LegalContactBlock;
  updatedLabel?: string;
  backLabel?: string;
  languageSwitch?: LegalLanguageSwitch;
};

export function LegalPage({
  document,
  contact,
  updatedLabel = "Son guncelleme",
  backLabel = "Anasayfaya don",
  languageSwitch,
}: Props) {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/[0.1] bg-white/[0.04] p-6 shadow-[0_32px_80px_-40px_rgba(0,114,255,0.28)] md:p-10 lg:p-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <Link href="/" className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-100">
              ← {backLabel}
            </Link>
            {languageSwitch ? (
              <nav
                className="inline-flex shrink-0 rounded-full border border-white/[0.1] bg-slate-950/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
                aria-label="Language"
              >
                {languageSwitch.options.map((option) => {
                  const isActive = option.locale === languageSwitch.activeLocale;
                  return (
                    <Link
                      key={option.href}
                      href={option.href}
                      className={`rounded-full px-4 py-2 text-xs font-bold tracking-wide transition ${
                        isActive
                          ? "bg-gradient-to-br from-[#00C6FF]/90 to-[#0072FF]/90 text-white shadow-[0_8px_24px_-8px_rgba(0,198,255,0.55)]"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <h1 className="mt-6 text-[1.75rem] font-black leading-[1.08] tracking-tight text-white sm:text-4xl md:text-[2.35rem]">
            {document.title}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {updatedLabel}: <span className="font-medium text-slate-300">{document.updatedAt}</span>
          </p>

          <p className="mt-7 max-w-3xl text-base leading-[1.8] text-slate-300/95 md:text-[1.05rem] md:leading-[1.78]">
            {document.intro}
          </p>

          <div className="mt-10 space-y-10 md:mt-12 md:space-y-11">
            {document.sections.map((section) => (
              <article key={section.heading} className="scroll-mt-28">
                <h2 className="border-b border-cyan-400/10 pb-2.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-[0.9375rem] leading-[1.78] text-slate-200/95 md:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul className="mt-4 list-disc space-y-2.5 pl-6 text-[0.9375rem] leading-[1.72] text-slate-200/95 md:text-base">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>

          {contact ? (
            <div
              className="relative mt-12 overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-slate-950/90 via-[#07111f]/95 to-slate-950/85 p-6 shadow-[0_28px_72px_-36px_rgba(0,114,255,0.42),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-cyan-400/22 md:mt-14 md:p-8"
              aria-label={contact.label}
            >
              <span
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(34,211,238,0.08),transparent_55%)]"
                aria-hidden
              />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
                {contact.dataControllerLabel}
              </p>
              <p className="relative mt-3 text-lg font-bold tracking-tight text-white md:text-xl">{contact.company}</p>
              <p className="relative mt-1.5 text-sm font-medium text-slate-300">{contact.label}</p>
              <ul className="relative mt-6 space-y-3">
                {contact.emails.map((email) => (
                  <li key={email}>
                    <a
                      href={`mailto:${email}`}
                      className="text-sm font-medium text-cyan-100/95 underline-offset-4 transition hover:text-white hover:underline md:text-[0.9375rem]"
                    >
                      {email}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="relative mt-5 text-sm font-medium tabular-nums text-slate-200 md:text-base">{contact.phone}</p>
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
              <p className="text-sm font-semibold text-cyan-100">Karekod Teknoloji ve Yazilim A.S.</p>
              <p className="mt-1 text-sm text-cyan-50">info@karekodteknoloji.com</p>
              <p className="text-sm text-cyan-50">0850 307 80 29</p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
