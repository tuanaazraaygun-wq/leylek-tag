"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CityDistrictCommandMap } from "@/components/city-district-command-map";
import { hasApiBaseUrl } from "@/lib/config";
import {
  DEFAULT_CITY,
  TURKEY_CITIES,
  getCityLiveDashboard,
  loadCityLiveDashboard,
  type CityLiveDashboard,
  type TurkeyCity,
} from "@/lib/city-live-data";

const wantLiveData = process.env.NEXT_PUBLIC_USE_REAL_LIVE_DATA === "true";

export function CityLiveMap() {
  const [selectedCity, setSelectedCity] = useState<TurkeyCity>(DEFAULT_CITY);
  const [dashboard, setDashboard] = useState(() => getCityLiveDashboard(DEFAULT_CITY));
  const [dataSource, setDataSource] = useState<"live" | "demo">("demo");
  const [hudFreshCycle, setHudFreshCycle] = useState(0);

  const liveCacheRef = useRef<Partial<Record<TurkeyCity, CityLiveDashboard>>>({});
  const prevHeadByCity = useRef<Partial<Record<TurkeyCity, string>>>({});

  useEffect(() => {
    if (!wantLiveData || !hasApiBaseUrl) {
      void Promise.resolve().then(() => {
        setDashboard(getCityLiveDashboard(selectedCity));
        setDataSource("demo");
      });
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function tick() {
      const retained = liveCacheRef.current[selectedCity] ?? null;
      const { dashboard: next, source } = await loadCityLiveDashboard(selectedCity, {
        retainedLive: retained ?? undefined,
      });
      if (cancelled) return;

      if (source === "live") {
        liveCacheRef.current[selectedCity] = next;
      }

      setDashboard(next);
      setDataSource(source);

      const headId = next.activities[0]?.id ?? "";
      const prevHead = prevHeadByCity.current[selectedCity];
      if (source === "live" && headId && prevHead !== undefined && headId !== prevHead) {
        setHudFreshCycle((k) => k + 1);
      }
      if (source === "live" && headId) {
        prevHeadByCity.current[selectedCity] = headId;
      }
    }

    tick();
    intervalId = setInterval(tick, 8000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [selectedCity]);

  const label = wantLiveData && dataSource === "live" ? "Canlı veri" : "Demo görünüm · Gerçek veriye hazır";
  const mapHudSubtitle =
    dataSource === "live" ? "Harita görünümü · Canlı yoğunluk katmanı" : "Harita görünümü · Demo görünüm";

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
                onChange={(event) => {
                  setHudFreshCycle(0);
                  setSelectedCity(event.target.value as TurkeyCity);
                }}
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
              mapHudSubtitle={mapHudSubtitle}
              dataMode={dataSource}
              districts={dashboard.districts}
              routes={dashboard.routes}
              activities={dashboard.activities}
              activeTrips={dashboard.stats.activeTrips}
              pendingOffers={dashboard.stats.pendingOffers}
              busiestRegion={dashboard.stats.busiestRegion}
              activeLine={dashboard.stats.activeLine}
              hudFreshCycle={hudFreshCycle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
