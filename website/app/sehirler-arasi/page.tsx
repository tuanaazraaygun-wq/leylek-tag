import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { ListingCard } from "@/components/listing-card";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { getIntercityListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Şehirler Arası Yol Paylaşımı",
};

export default function IntercityPage() {
  const listings = getIntercityListings();

  return (
    <>
      <PageHero
        eyebrow="şehirler arası"
        title="Boş koltuk paylaşımıyla aynı yöne gidenleri buluştur."
        description="Kullanıcılar gidecekleri şehirleri, tarih/saat bilgisini, boş koltuk sayısını ve tahmini masraf paylaşımını net şekilde paylaşabilir."
        primaryLabel="Uygulamada Gör"
      />
      <section className="py-12">
        <Container>
          <SectionHeading
            eyebrow="mock ilanlar"
            title="Canlı liste hissi, gerçek API için hazır component yapısı"
            description="Bu kartlar şimdilik mock veriyle çalışır. Sonraki aşamada ride_listings veya ayrı bir endpoint üzerinden beslenecek şekilde ayrılmıştır."
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
