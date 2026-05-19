import Link from "next/link";
import { Container } from "@/components/container";
import type { LegalSection } from "@/lib/legal-content";

export type LegalPageDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

type Props = {
  document: LegalPageDocument;
};

export function LegalPage({ document }: Props) {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-10">
          <Link href="/" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            ← Anasayfaya don
          </Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">{document.title}</h1>
          <p className="mt-2 text-sm text-slate-300">Son guncelleme: {document.updatedAt}</p>

          <p className="mt-6 leading-relaxed text-slate-200">{document.intro}</p>

          <div className="mt-8 space-y-8">
            {document.sections.map((section) => (
              <article key={section.heading}>
                <h2 className="text-xl font-bold text-white">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 leading-relaxed text-slate-200">
                    {paragraph}
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-200">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
            <p className="text-sm font-semibold text-cyan-100">Karekod Teknoloji ve Yazilim A.S.</p>
            <p className="mt-1 text-sm text-cyan-50">info@karekodteknoloji.com</p>
            <p className="text-sm text-cyan-50">0850 307 80 29</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
