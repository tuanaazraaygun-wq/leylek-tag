import Link from "next/link";
import { Container } from "@/components/container";
import { ButtonLink } from "@/components/button-link";

export function DownloadAppFlowPreview() {
  return (
    <section id="uygulama-akisi" className="scroll-mt-28 py-12 sm:py-16">
      <Container>
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">sunucu destekli akış özetleri</p>
        <h2 className="mt-3 text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
          Yolunda kalan güvenilir süreç
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
          Backend tarafından yönlendirilen teklif yaşam döngüsü: karşılıklı onaya kadar süreç açıkta kalır, QR doğrulama kritik düğümde bağlamı doğrular. Sahte güven iddiası olmadan, üretim uygulamasının ekranlarının tamamına{" "}
          <Link href="/indir#play-vitrin" className="font-semibold text-cyan-200/95 underline-offset-2 hover:underline">
            vitrin carousel
          </Link>{" "}
          veya ana sayfadaki vitrin bloklarından göz atabilirsin.
        </p>
        <p className="mx-auto mt-3 max-w-lg text-center text-xs font-semibold text-cyan-100/85">
          Geri bildirimin bizim için önemli; beta ile birlikte bu akış daha da sağlamlaşır.
        </p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 sm:grid-cols-2 sm:p-7">
          {[
            { t: "Karşılıklı teklif yönetimi", d: "Taraflar aynı ekrandan teklifi netleştirir; onay süresi bağlama bağlıdır." },
            { t: "QR ile yerinde doğrulama", d: "Buluşmadan sonra QR adımı bağlam sürekliliği ve kontrolleri güçlendirir." },
            { t: "Şehir içi / yolcular", d: "Yolcu panellerinden uygunluk sıralamasına göre ilerlenebilir; sunucudan güncel özete erişilir." },
            { t: "Sürücü paneli ve rota özeti", d: "Masraf katmanının hesaplanması ve rota seçimi yapısal kurallara göre bağlanmıştır." },
          ].map((item) => (
            <article key={item.t} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
              <h3 className="text-base font-black text-white">{item.t}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.d}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <ButtonLink href="/indir#play-vitrin" className="min-w-[200px] text-center">
            Tüm mobil ekranları gör
          </ButtonLink>
          <ButtonLink href="/nasil-calisir" variant="secondary" className="min-w-[180px] text-center">
            Nasıl çalışır
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
