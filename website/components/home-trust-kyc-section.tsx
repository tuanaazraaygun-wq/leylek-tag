import Link from "next/link";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

const TRUST_PILLARS = [
  {
    title: "Karşılıklı onay",
    description: "Eşleşme, iki tarafın net onayıyla ilerler; tek taraflı süreç yoktur.",
  },
  {
    title: "QR doğrulama",
    description: "Buluşma ve yolculuk adımlarında kontrollü doğrulama katmanı.",
  },
  {
    title: "Sürücü inceleme",
    description: "Sürücü başvuruları ve belgeler operasyonel süreçlerle değerlendirilir.",
  },
  {
    title: "Destek kanalı",
    description: "Şikayet ve güvenlik bildirimleri destek hattı üzerinden iletilebilir.",
  },
] as const;

export function HomeTrustKycSection() {
  return (
    <section
      className="depth-well section-seam scroll-mt-28 py-10 sm:py-12 md:py-14"
      aria-labelledby="home-trust-kyc-heading"
    >
      <Container>
        <SectionHeading
          eyebrow="güven & doğrulama"
          title="Güven katmanları operasyonel süreçlerle desteklenir."
          description="Leylek TAG; QR, karşılıklı onay ve sürücü belge incelemesi gibi adımlarla topluluk temelli yolculuk paylaşımını daha kontrollü hale getirir."
        />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:gap-4">
          {TRUST_PILLARS.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
            >
              <h3 className="text-[13px] font-bold text-white">{item.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{item.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-[11px] leading-relaxed text-slate-500">
          Uygulama içi teklif, eşleşme ve doğrulama adımları mobil uygulamada tamamlanır. Web sitesi bilgilendirme,
          indirme ve destek vitrini sunar.{" "}
          <Link href="/guvenlik" className="font-semibold text-cyan-300/90 underline-offset-2 hover:text-cyan-200 hover:underline">
            Güvenlik sayfası
          </Link>
          {" · "}
          <Link href="/support" className="font-semibold text-cyan-300/90 underline-offset-2 hover:text-cyan-200 hover:underline">
            Destek
          </Link>
        </p>
      </Container>
    </section>
  );
}
