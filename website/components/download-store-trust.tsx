import { Container } from "@/components/container";

const TRUST_PILLARS = [
  {
    title: "Güvenli eşleşme",
    description: "Karşılıklı onay ve net teklif süreciyle kontrollü eşleşme.",
  },
  {
    title: "QR doğrulama",
    description: "Yolculuk adımlarında QR ile doğrulanmış süreç katmanı.",
  },
  {
    title: "Yolcu ve sürücü profilleri",
    description: "Rol bazlı profiller ve süreç görünürlüğü uygulama içinde.",
  },
  {
    title: "Uygulama içi destek",
    description: "Güvenlik ve operasyon bildirimleri için destek kanalı.",
  },
] as const;

export function DownloadStoreTrust() {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.02] py-10 sm:py-14">
      <Container>
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">güven</p>
        <h2 className="mt-3 text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
          Güven odaklı yolculuk paylaşımı
        </h2>
        <ul className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_PILLARS.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-white/[0.09] bg-slate-950/50 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <h3 className="text-[15px] font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{item.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
