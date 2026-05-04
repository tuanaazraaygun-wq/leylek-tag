import { Container } from "@/components/container";

const WEB = ["Rotaları keşfet", "Teklif akışını öğren", "Canlı rota görünümünü incele"] as const;
const APP = [
  "Teklif oluştur",
  "Eşleşmeleri yönet",
  "QR ile yolculuğu başlat",
  "Güvenli teklif görüşmesi yap",
] as const;

export function DownloadWebAppCompare() {
  return (
    <section id="web-vs-app" className="scroll-mt-28 py-12 sm:py-16">
      <Container>
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">web ve uygulama</p>
        <h2 className="mt-3 text-center text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
          Keşif webde; gerçek eşleşme uygulamada
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-400 sm:text-base">
          Sitede akışı anla; teklif verme, onay ve QR ile yolculuk için Leylek Tag uygulamasına geç.
        </p>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Web</p>
            <p className="mt-2 text-lg font-black text-white">Keşif ve şeffaflık</p>
            <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-300">
              {WEB.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-cyan-400/90" aria-hidden>
                    ◆
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-[2rem] border-2 border-cyan-400/35 bg-gradient-to-br from-cyan-500/[0.12] via-[#0c1829] to-violet-600/[0.12] p-6 shadow-[0_0_60px_rgba(34,211,238,0.12)] sm:p-8">
            <span className="absolute right-5 top-5 rounded-full bg-cyan-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-100">
              asıl deneyim
            </span>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/90">Uygulama</p>
            <p className="mt-2 text-lg font-black text-white">Gerçek eşleşme ve kontrol</p>
            <ul className="mt-6 space-y-3 text-sm font-bold text-white/95">
              {APP.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-emerald-300" aria-hidden>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
