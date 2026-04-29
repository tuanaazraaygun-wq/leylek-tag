import dynamic from "next/dynamic";
import type { CityActivity, CityDistrict, CityRoute, TurkeyCity } from "@/lib/city-live-data";

type CityDistrictCommandMapProps = {
  city: TurkeyCity;
  mapHudSubtitle: string;
  dataMode: "live" | "demo";
  districts: CityDistrict[];
  routes: CityRoute[];
  activities: CityActivity[];
  activeTrips: number;
  pendingOffers: number;
  busiestRegion: string;
  activeLine: string;
  hudFreshCycle: number;
};

const RealCityMap = dynamic(() => import("@/components/real-city-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[640px] items-center justify-center rounded-[2rem] bg-slate-950 text-sm font-semibold text-cyan-100">
      Harita yükleniyor...
    </div>
  ),
});

export function CityDistrictCommandMap({
  city,
  mapHudSubtitle,
  dataMode,
  districts,
  routes,
  activities,
  activeTrips,
  pendingOffers,
  busiestRegion,
  activeLine,
  hudFreshCycle,
}: CityDistrictCommandMapProps) {
  return (
    <section className="relative min-h-[640px] overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[#030b18] shadow-[0_0_120px_rgba(34,211,238,0.16)]">
      <RealCityMap
        city={city}
        districts={districts}
        routes={routes}
        activeLine={activeLine}
        activities={activities}
        dataMode={dataMode}
        mapHudSubtitle={mapHudSubtitle}
        hudFreshCycle={hudFreshCycle}
      />
      <div className="pointer-events-none absolute right-4 top-4 z-[500] hidden grid-cols-3 gap-2 rounded-2xl border border-cyan-200/15 bg-slate-950/78 p-2 shadow-soft-card backdrop-blur-xl sm:grid">
        {[
          ["aktif yolculuk", activeTrips],
          ["bekleyen teklif", pendingOffers],
          ["yoğun bölge", busiestRegion],
        ].map(([statLabel, value]) => (
          <div key={statLabel} className="rounded-xl bg-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-slate-500">{statLabel}</p>
            <p className="mt-1 whitespace-nowrap text-xs font-black text-white tabular-nums transition-colors duration-500">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
