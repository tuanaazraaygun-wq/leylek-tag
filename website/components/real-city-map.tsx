"use client";

import L, { type LatLngExpression, type PathOptions } from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { CityMapLegend } from "@/components/live-dashboard-chrome";
import type { CityActivity, CityDistrict, CityRoute, RouteVisualTier, TurkeyCity } from "@/lib/city-live-data";
import {
  buildMapRoutesAndTiers,
  districtIntensityAccent,
  getCityCoordinates,
} from "@/lib/city-live-data";

export type RealCityMapProps = {
  city: TurkeyCity;
  districts: CityDistrict[];
  routes: CityRoute[];
  activeLine: string;
  activities: CityActivity[];
  dataMode: "live" | "demo";
  /** Second line under “CANLI ŞEHİR İÇİ AĞ” badge */
  mapHudSubtitle: string;
  /** Increments when the newest activity row should flash (live polls). */
  hudFreshCycle: number;
  /** Live API had no regions/activities — soften overlay; map still demo-filled */
  liveSparse?: boolean;
};

function RecenterMap({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom, { animate: true });
  return null;
}

function createDistrictIcon(district: CityDistrict, accent: "high" | "mid" | "low", pulseStrong: boolean) {
  return L.divIcon({
    className: "leylek-district-marker",
    html: `
      <div class="leylek-marker ${pulseStrong ? "leylek-marker-active" : ""} leylek-marker-accent-${accent}">
        <span class="leylek-marker-pulse"></span>
        <span class="leylek-marker-core"></span>
        <span class="leylek-marker-label">${district.name}</span>
      </div>
    `,
    iconSize: [120, 34],
    iconAnchor: [10, 10],
  });
}

function createLightIcon(index: number) {
  return L.divIcon({
    className: "leylek-light-marker",
    html: `<span class="leylek-city-light" style="animation-delay:${(index % 9) * 0.22}s"></span>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

function createHeatIcon(district: CityDistrict) {
  const int = Math.min(100, Math.max(0, district.intensity));
  const size = Math.max(42, Math.min(108, 40 + int * 0.68));
  const opacity = 0.28 + (int / 100) * 0.55;
  const accent = districtIntensityAccent(int);

  return L.divIcon({
    className: "leylek-heat-marker",
    html: `<span class="leylek-heat-zone leylek-heat-zone--${accent}" style="width:${size}px;height:${size}px;opacity:${opacity.toFixed(3)}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createParticleIcon(phase: number) {
  return L.divIcon({
    className: "leylek-route-particle-marker",
    html: `<span class="leylek-route-particle" style="animation-delay:${(phase % 5) * 0.28}s"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function getCurvedPositions(from: CityDistrict, to: CityDistrict): LatLngExpression[] {
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const latDelta = to.lat - from.lat;
  const lngDelta = to.lng - from.lng;
  const curveStrength = 0.18;
  const control: LatLngExpression = [
    midLat - lngDelta * curveStrength,
    midLng + latDelta * curveStrength,
  ];

  return [[from.lat, from.lng], control, [to.lat, to.lng]];
}

function particleAlongCurve(positions: LatLngExpression[]): LatLngExpression[] {
  if (positions.length < 3) return [];
  const p0 = positions[0] as [number, number];
  const p1 = positions[1] as [number, number];
  const p2 = positions[2] as [number, number];
  const ts = [0.18, 0.42, 0.64, 0.82];
  return ts.map((t) => {
    const u = 1 - t;
    const lat = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const lng = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    return [lat, lng] as LatLngExpression;
  });
}

function tierPolylineStyles(tier: RouteVisualTier): { glow: PathOptions; main: PathOptions; rim: PathOptions } {
  switch (tier) {
    case "active":
      return {
        glow: {
          color: "#22d3ee",
          opacity: 0.55,
          weight: 18,
          className: "leylek-route-glow leylek-route-glow--hot",
        },
        main: {
          color: "#cffafe",
          opacity: 0.98,
          weight: 6,
          className: "leylek-route-main leylek-route-flow",
        },
        rim: { color: "#ecfeff", opacity: 0.92, weight: 2, className: "leylek-live-route leylek-live-route--hot" },
      };
    case "linked":
      return {
        glow: { color: "#0ea5e9", opacity: 0.34, weight: 13, className: "leylek-route-glow" },
        main: { color: "#7dd3fc", opacity: 0.82, weight: 4, className: "leylek-route-main" },
        rim: { color: "#e0fcff", opacity: 0.68, weight: 2, className: "leylek-live-route" },
      };
    default:
      return {
        glow: { color: "#0369a1", opacity: 0.12, weight: 9, className: "leylek-route-glow" },
        main: { color: "#67e8f9", opacity: 0.32, weight: 3, className: "leylek-route-main" },
        rim: { color: "#a5f3fc", opacity: 0.28, weight: 1.5, className: "leylek-live-route" },
      };
  }
}

function getLightPoints(city: TurkeyCity, centerLat: number, centerLng: number) {
  const seed = city.split("").reduce((total, char) => total + char.charCodeAt(0), 0);

  return Array.from({ length: 34 }, (_, index) => {
    const angle = ((index * 137 + seed) % 360) * (Math.PI / 180);
    const ring = 0.008 + ((index * 17 + seed) % 42) / 1000;
    const squash = index % 3 === 0 ? 0.55 : 0.85;

    return {
      id: `light-${index}`,
      lat: centerLat + Math.sin(angle) * ring * squash,
      lng: centerLng + Math.cos(angle) * ring,
    };
  });
}

function shortStatus(status: string) {
  if (status.includes("eşleşme")) {
    return "eşleşti";
  }

  if (status.includes("bulundu")) {
    return "bulundu";
  }

  return "başladı";
}

type HudLine = { key: string; text: string; time: string };

function buildHudLines(
  activities: CityActivity[],
  routes: CityRoute[],
  districts: CityDistrict[],
): { left: HudLine[]; right: HudLine[] } {
  const fmt = (a: CityActivity): HudLine => ({
    key: a.id,
    text: a.subtitle.trim() ? `${a.title} · ${a.subtitle}` : a.title,
    time: a.time,
  });

  if (activities.length > 0) {
    const mid = Math.ceil(activities.length / 2);
    const leftActs = activities.slice(0, mid).map(fmt);
    const rightActs = activities.slice(mid).map(fmt);
    return {
      left: leftActs,
      right:
        rightActs.length > 0
          ? rightActs
          : [
              {
                key: "syn-fill",
                text: `${districts[1]?.name ?? districts[0]?.name ?? "Merkez"} çevresinde hareket`,
                time: "şimdi",
              },
            ],
    };
  }

  return {
    left: routes.slice(0, 3).map((r, i) => ({
      key: r.id,
      text: `${r.from} → ${r.to} · ${shortStatus(r.status)}`,
      time: i === 0 ? "şimdi" : `${i} dk`,
    })),
    right: [
      {
        key: "demo-r1",
        text: `${districts[1]?.name ?? districts[0]?.name ?? ""} bölgesi yoğun`,
        time: "şimdi",
      },
      {
        key: "demo-r2",
        text: `${routes[0]?.from ?? districts[0]?.name ?? ""} hattı aktif`,
        time: "1 dk",
      },
      {
        key: "demo-r3",
        text: `${districts[2]?.name ?? districts[0]?.name ?? ""} yönünde talep artıyor`,
        time: "2 dk",
      },
    ],
  };
}

export default function RealCityMap({
  city,
  districts,
  routes,
  activeLine,
  activities,
  dataMode,
  mapHudSubtitle,
  hudFreshCycle,
  liveSparse = false,
}: RealCityMapProps) {
  const cityCenter = getCityCoordinates(city);
  const center: LatLngExpression = [cityCenter.lat, cityCenter.lng];
  const cityLights = getLightPoints(city, cityCenter.lat, cityCenter.lng);

  const { routes: vizRoutes, tiers } = useMemo(
    () => buildMapRoutesAndTiers(routes, activities, districts),
    [routes, activities, districts],
  );

  const topDistrictIds = useMemo(() => {
    const ranked = [...districts].sort((a, b) => b.intensity - a.intensity);
    return new Set(ranked.slice(0, 2).map((d) => d.id));
  }, [districts]);

  const { left: hudLeft, right: hudRight } = useMemo(
    () => buildHudLines(activities, routes, districts),
    [activities, routes, districts],
  );

  function findDistrict(name: string) {
    return districts.find((district) => district.name === name) ?? districts[0];
  }

  const heatBadge = dataMode === "live" ? "canlı" : "özet";

  const outerMapClass =
    `relative h-full min-h-[640px] overflow-hidden rounded-[2rem] ${liveSparse ? "ring-1 ring-cyan-400/10 shadow-[inset_0_0_80px_rgba(34,211,238,0.04)]" : ""}`;

  return (
    <div className={outerMapClass}>
      <MapContainer
        center={center}
        zoom={cityCenter.zoom}
        zoomControl={false}
        attributionControl
        scrollWheelZoom={false}
        className="h-full min-h-[640px] w-full bg-slate-950"
      >
        <RecenterMap center={center} zoom={cityCenter.zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {districts.map((district) => (
          <Marker
            key={`heat-${district.id}`}
            position={[district.lat, district.lng]}
            icon={createHeatIcon(district)}
            interactive={false}
          />
        ))}

        {cityLights.map((point, index) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={createLightIcon(index)}
            interactive={false}
          />
        ))}

        {vizRoutes.map((route) => {
          const from = findDistrict(route.from);
          const to = findDistrict(route.to);
          const positions = getCurvedPositions(from, to);
          const tier = tiers.get(route.id) ?? "idle";
          const ps = tierPolylineStyles(tier);
          const particlePoints = tier === "active" ? particleAlongCurve(positions) : [];

          return (
            <div key={route.id}>
              <Polyline positions={positions} pathOptions={ps.glow} />
              <Polyline positions={positions} pathOptions={ps.main} />
              <Polyline positions={positions} pathOptions={ps.rim} />
              {particlePoints.map((pos, idx) => (
                <Marker key={`${route.id}-p-${idx}`} position={pos} icon={createParticleIcon(idx)} interactive={false} />
              ))}
            </div>
          );
        })}

        {districts.map((district) => {
          const accent = districtIntensityAccent(district.intensity);
          const pulseStrong = topDistrictIds.has(district.id);
          return (
            <Marker
              key={district.id}
              position={[district.lat, district.lng]}
              icon={createDistrictIcon(district, accent, pulseStrong)}
              interactive={false}
            />
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.11),transparent_32%),linear-gradient(180deg,rgba(2,8,23,0.08),rgba(2,8,23,0.32))]" />
      <div className="pointer-events-none absolute inset-0 subtle-grid opacity-14" />
      <div className="pointer-events-none absolute inset-0 leylek-ambient-drift opacity-[0.42]" />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out ${liveSparse ? "bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/45" : "opacity-0"}`}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-28 w-full animate-scan-map-premium bg-gradient-to-b from-transparent via-cyan-200/[0.07] to-transparent" />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-cyan-200/15 bg-slate-950/68 px-4 py-3 shadow-soft-card backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="live-canli-dot" aria-hidden />
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100">CANLI ŞEHİR İÇİ AĞ</p>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-400">{mapHudSubtitle}</p>
      </div>

      <div className="pointer-events-none absolute inset-x-4 top-24 text-center sm:top-20">
        <p className="text-xl font-black tracking-[0.08em] text-cyan-50 drop-shadow-[0_0_16px_rgba(34,211,238,0.45)] sm:text-2xl">
          {city.toLocaleUpperCase("tr-TR")} CANLI BÖLGE HARİTASI
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-[9rem] left-3 z-[402] max-w-[min(11rem,88vw)] md:bottom-auto md:left-auto md:right-4 md:top-[7.75rem]">
        <CityMapLegend />
      </div>

      <div className="pointer-events-none absolute bottom-24 left-4 right-4 grid gap-3 lg:grid-cols-[260px_1fr_260px]">
        <div className="map-hud-panel leylek-feed-cycle">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Anlık eşleşmeler</p>
            <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-black text-emerald-100">canlı</span>
          </div>
          <div className="space-y-1.5">
            {hudLeft.map((row, index) => (
              <div
                key={index === 0 ? `left-${hudFreshCycle}-${row.key}` : row.key}
                className={`map-hud-row ${index === 0 && hudFreshCycle > 0 ? "map-hud-row--fresh" : ""}`}
                style={{ animationDelay: `${index * 0.6}s` }}
              >
                <span className="map-hud-dot" />
                <span className="truncate">{row.text}</span>
                <span className="ml-auto text-[10px] text-cyan-100/70">{row.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="map-hud-panel hidden lg:block">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Bölge yoğunluğu</p>
            <span className="text-[10px] font-bold text-slate-400">{heatBadge}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {districts.slice(0, 4).map((district) => {
              const accent = districtIntensityAccent(district.intensity);
              return (
              <div key={district.id} className={`rounded-xl border bg-white/[0.05] px-2 py-2 map-hud-district-accent-${accent}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-[11px] font-bold map-hud-district-label-${accent}`}>{district.name}</span>
                  <span className="text-[10px] text-cyan-100">{district.level}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/10 transition-[width] duration-700 ease-out">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-200 to-emerald-300 transition-[width] duration-700 ease-out"
                    style={{ width: `${district.intensity}%` }}
                  />
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="map-hud-panel leylek-feed-cycle">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Canlı aktivite</p>
            <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black text-cyan-100">akış</span>
          </div>
          <div className="space-y-1.5">
            {hudRight.map((row, index) => (
              <div key={row.key} className="map-hud-row" style={{ animationDelay: `${index * 0.7}s` }}>
                <span className="map-hud-dot bg-cyan-200" />
                <span className="truncate">{row.text}</span>
                <span className="ml-auto text-[10px] text-cyan-100/70">{row.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-cyan-200/15 bg-slate-950/64 p-3 shadow-soft-card backdrop-blur-xl">
        <div className="grid gap-2 md:grid-cols-3">
          {[`Seçili şehir: ${city}`, `En yoğun bölge: ${districts[1]?.name ?? districts[0]?.name}`, `En aktif hat: ${activeLine}`].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
              <p className="truncate text-[11px] font-semibold text-cyan-100">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
