import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { DOWNLOAD_PAGE_URL } from "@/lib/store-links";
import { getCommunityCityHrefForChannel } from "@/lib/community-city-content";

const PAGE_TITLE = "Leylek Topluluk | Leylek TAG";
const PAGE_DESCRIPTION =
  "Şehir ve ilçe bazlı yol paylaşımı niyet kanalları. Leylek Topluluk; DM, telefon ve link paylaşımı olmadan kontrollü şekilde açılacak topluluk odaklı yolculuk paylaşımı vitrinidir; taksi veya ticari taşımacılık değildir.";

export const metadata: Metadata = {
  title: "Leylek Topluluk",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/topluluk",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/topluluk",
  },
};

const COMMUNITY_PILLARS = [
  {
    eyebrow: "kanal modeli",
    title: "Şehir ve ilçe kanalları",
    description:
      "Ankara, İstanbul, İzmir gibi şehirlerde; Çankaya, Mamak, Kızılay gibi ilçe ve güzergâh odaklı kanallar pilot planı kapsamında kontrollü biçimde açılacaktır.",
  },
  {
    eyebrow: "rol etiketi",
    title: "Yolcu ve sürücü etiketi",
    description:
      "Paylaşımlarda yolcu veya sürücü niyeti netleştirilir; masraf paylaşımı ve rota görüşmesi topluluk kuralları çerçevesinde ilerler.",
  },
  {
    eyebrow: "güven ağı",
    title: "Güven Ağı daveti",
    description:
      "Güven Ağına davet yalnızca mobil uygulamada, karşılıklı onayla tamamlanır. Web sitesi bu süreci bilgilendirme amaçlı anlatır.",
  },
  {
    eyebrow: "teklif köprüsü",
    title: "Teklif taslağı uygulamada",
    description:
      "Yolculuk veya teklif taslağı mobil uygulamada oluşturulur; karşılıklı onay ve doğrulama adımları uygulama içinde yürütülür.",
  },
] as const;

const CHANNEL_GUARDRAILS = [
  "Özel mesaj (DM) yok",
  "Telefon, WhatsApp veya harici iletişim bilgisi paylaşımı yok",
  "Link, Instagram kullanıcı adı ve harici sosyal yönlendirme yok",
  "Fotoğraf ve video paylaşımı yok",
  "Metin odaklı, moderasyonlu kanal akışı",
  "Raporla ve engelle — uygulama içinde",
] as const;

/** Pilot planı kanallar — canlı feed yok; bilgilendirme kartları. */
const PLANNED_CHANNELS = [
  { city: "Ankara", name: "Ankara", scope: "şehir", status: "Pilot öncelik" },
  { city: "Ankara", name: "Çankaya", scope: "ilçe", status: "Planlanıyor" },
  { city: "Ankara", name: "Mamak", scope: "ilçe", status: "Planlanıyor" },
  { city: "Ankara", name: "Kızılay", scope: "güzergâh", status: "Planlanıyor" },
  { city: "İstanbul", name: "İstanbul", scope: "şehir", status: "Planlanıyor" },
  { city: "İzmir", name: "İzmir", scope: "şehir", status: "Planlanıyor" },
] as const;

export default function ToplulukPage() {
  return (
    <>
      <PageHero
        eyebrow="leylek topluluk"
        title="Şehir bazlı yol paylaşımı niyet kanalları"
        description="Leylek Topluluk, aynı yöne giden yolcu ve sürücülerin metin odaklı, kontrollü kanallarda rota niyetini paylaşabileceği topluluk katmanıdır. Pilot kapsamda kademeli olarak açılacaktır."
        primaryHref={DOWNLOAD_PAGE_URL}
        primaryLabel="Uygulamayı indir"
        secondaryHref="/muhabbet"
        secondaryLabel="Leylek Teklifi nasıl çalışır?"
        ctaHint="Kanallar ve mesajlaşma mobil uygulamada yürütülür. Web sayfası bilgilendirme vitrinidir."
      />

      <section className="border-b border-white/[0.06] py-8 sm:py-10">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">yasal not</p>
            <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <p>
                Leylek Topluluk, topluluk odaklı yolculuk ve masraf paylaşımı için tasarlanmıştır;{" "}
                <span className="font-semibold text-slate-200">taksi veya ticari taşımacılık hizmeti sunmaz</span>.
              </p>
              <p>
                Platform <span className="font-semibold text-slate-200">uygulama içinde ödeme tahsilatı yapmaz</span>
                ; masraf paylaşımı tarafların karşılıklı anlaşmasıyla topluluk kuralları içinde ilerler.
              </p>
              <p className="text-slate-400">
                Canlı kanal akışı henüz web sitesinde yoktur; özellik pilot aşamada uygulama üzerinden kontrollü
                şekilde devreye alınacaktır.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-12">
        <Container>
          <SectionHeading
            eyebrow="nedir?"
            title="Leylek Topluluk nedir?"
            description="Yayın kanalı mantığına benzer, ancak LeylekTAG güven çerçevesine özel: DM yok, medya yok, dış iletişim yok — yalnızca kontrollü metin paylaşımı ve uygulama içi süreçler."
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {COMMUNITY_PILLARS.map((item) => (
              <li key={item.title}>
                <FeatureCard eyebrow={item.eyebrow} title={item.title} description={item.description} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.02] py-10 sm:py-12">
        <Container>
          <SectionHeading
            eyebrow="kurallar"
            title="Güvenli kanal ilkeleri"
            description="Topluluk deneyimi; kişisel veri kaçışını, spam riskini ve ride-hail algısını azaltacak şekilde sınırlandırılır."
          />
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNEL_GUARDRAILS.map((rule) => (
              <li
                key={rule}
                className="flex gap-2.5 rounded-xl border border-white/[0.07] bg-slate-950/40 px-4 py-3 text-[13px] leading-relaxed text-slate-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90" aria-hidden />
                {rule}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-10 sm:py-12">
        <Container>
          <SectionHeading
            eyebrow="pilot planı"
            title="Planlanan kanallar"
            description="Aşağıdaki kanallar bilgilendirme amaçlıdır. Kullanılabilirlik bölgeye göre değişebilir; açılış sırası pilot topluluk geri bildirimine göre netleşir."
          />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLANNED_CHANNELS.map((channel) => {
              const href = getCommunityCityHrefForChannel(channel.name, channel.scope);
              const card = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{channel.city}</p>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100/90">
                      {channel.status}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-white">{channel.name}</h2>
                  <p className="mt-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    {channel.scope}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                    {href
                      ? "Kanal planı ve kurallar için detay sayfasına göz at."
                      : "Kanal akışı uygulamada açıldığında buradan duyurulacaktır."}
                  </p>
                </>
              );

              return (
                <li key={`${channel.city}-${channel.name}`}>
                  {href ? (
                    <Link
                      href={href}
                      className="glass-panel block rounded-2xl border border-white/[0.08] p-5 transition hover:border-cyan-400/28 hover:bg-cyan-400/[0.03]"
                    >
                      {card}
                    </Link>
                  ) : (
                    <div className="glass-panel rounded-2xl border border-white/[0.08] p-5">{card}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-[12px] leading-relaxed text-slate-500">
            Şehir landing sayfaları:{" "}
            <Link href="/sehir/ankara" className="font-semibold text-cyan-200/90 underline-offset-2 hover:underline">
              Ankara
            </Link>
            {" · "}
            <Link href="/sehir/istanbul" className="font-semibold text-cyan-200/90 underline-offset-2 hover:underline">
              İstanbul
            </Link>
            {" · "}
            <Link href="/sehir/izmir" className="font-semibold text-cyan-200/90 underline-offset-2 hover:underline">
              İzmir
            </Link>
          </p>
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-cyan-400/[0.14] p-8 ring-1 ring-cyan-400/[0.08] sm:p-10">
            <span
              className="pointer-events-none absolute inset-px rounded-[calc(2rem-1px)] bg-[linear-gradient(135deg,rgba(34,211,238,0.08)_0%,transparent_50%)] opacity-95"
              aria-hidden
            />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/82">sonraki adım</p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Uygulamayı indir; teklif akışını keşfet
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Leylek Topluluk kanalları mobil uygulamada devreye girecek. Bugün teklif, eşleşme ve güven adımlarını
                uygulama içinde inceleyebilirsin.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href={DOWNLOAD_PAGE_URL}>Uygulamayı indir</ButtonLink>
                <ButtonLink href="/muhabbet" variant="secondary">
                  Leylek Teklifi nasıl çalışır?
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
