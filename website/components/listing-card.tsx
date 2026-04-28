import { ButtonLink } from "@/components/button-link";
import type { IntercityListing } from "@/lib/mock-data";

type ListingCardProps = {
  listing: IntercityListing;
};

export function ListingCard({ listing }: ListingCardProps) {
  return (
    <article className="glass-panel group relative overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40">
      <div className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-cyan-300/12 blur-3xl transition group-hover:bg-cyan-300/20" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
            Şehirler arası yol paylaşımı
          </p>
          <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
            {listing.from} {"→"} {listing.to}
          </h3>
        </div>
        <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-sm font-bold text-cyan-100">
          {listing.rating.toFixed(1)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">{listing.note}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/[0.06] p-4">
          <p className="text-slate-400">Tarih / saat</p>
          <p className="mt-1 font-semibold text-white">{listing.dateTime}</p>
        </div>
        <div className="rounded-2xl bg-white/[0.06] p-4">
          <p className="text-slate-400">Boş koltuk</p>
          <p className="mt-1 font-semibold text-white">{listing.seats} koltuk</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-cyan-200/10 bg-cyan-300/10 p-4">
          <p className="text-cyan-100/80">Önerilen masraf paylaşımı</p>
          <p className="mt-1 font-semibold text-white">{listing.contribution}</p>
        </div>
      </div>

      <ButtonLink href="/indir" variant="secondary" className="mt-6 w-full">
        Uygulamada Gör
      </ButtonLink>
    </article>
  );
}
