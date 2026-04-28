"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CityDistrictCommandMap } from "@/components/city-district-command-map";
import {
  DEFAULT_CITY,
  TURKEY_CITIES,
  getCityLiveDashboard,
  loadCityLiveDashboard,
  type TurkeyCity,
} from "@/lib/city-live-data";

const wantLiveData = process.env.NEXT_PUBLIC_USE_REAL_LIVE_DATA === "true";

export function CityLiveMap() {
  const [selectedCity, setSelectedCity] = useState<TurkeyCity>(DEFAULT_CITY);
  const [dashboard, setDashboard] = useState(() => getCityLiveDashboard(DEFAULT_CITY));
  const [liveOk, setLiveOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { dashboard: next, source } = await loadCityLiveDashboard(selectedCity);
      if (!cancelled) {
        setDashboard(next);
        setLiveOk(source === "live");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  const label = wantLiveData && liveOk ? "Canlı veri" : "Demo görünüm · Gerçek veriye hazır";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 p-4 shadow-soft-card sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_20%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_78%_70%,rgba(37,99,235,0.14),transparent_26%)]" />
      <div className="relative">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">şehir içi komuta paneli</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Canlı şehir içi hareket haritası</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-full border border-white/10 bg-white/[0.06] p-1">
              <span className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Şehir içi</span>
              <Link href="/sehirler-arasi" className="rounded-full px-4 py-2 text-xs font-bold text-slate-300 transition hover:text-white">
                Şehirler arası
              </Link>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-slate-300">
              Şehir
              <select
                value={selectedCity}
                onChange={(event) => setSelectedCity(event.target.value as TurkeyCity)}
                className="bg-transparent text-white outline-none"
              >
                {TURKEY_CITIES.map((city) => (
                  <option key={city} value={city} className="bg-slate-950 text-white">
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
              {label}
            </span>
          </div>
        </div>

        <div>
          <div>
            <CityDistrictCommandMap
              city={dashboard.city}
              label={label}
              districts={dashboard.districts}
              routes={dashboard.routes}
              activeTrips={dashboard.stats.activeTrips}
              pendingOffers={dashboard.stats.pendingOffers}
              busiestRegion={dashboard.stats.busiestRegion}
              activeLine={dashboard.stats.activeLine}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
