"use client";

import { Fragment, useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import type { IntercityDashboard, IntercityRouteItem } from "@/lib/intercity-live-data";

type IntercityRealMapProps = {
  dashboard: IntercityDashboard;
};

function getCurvedPositions(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): LatLngExpression[] {
  const midLat = (fromLat + toLat) / 2;
  const midLng = (fromLng + toLng) / 2;
  const latDelta = toLat - fromLat;
  const lngDelta = toLng - fromLng;
  const curveStrength = 0.22;
  const control: LatLngExpression = [
    midLat - lngDelta * curveStrength,
    midLng + latDelta * curveStrength,
  ];

  return [[fromLat, fromLng], control, [toLat, toLng]];
}

function createEndpointIcon(cityName: string, accent: "cyan" | "emerald") {
  const activeClass = accent === "emerald" ? " leylek-marker-active" : "";

  return L.divIcon({
    className: "leylek-district-marker",
    html: `
      <div class="leylek-marker leylek-intercity-endpoint${activeClass}">
        <span class="leylek-marker-pulse"></span>
        <span class="leylek-marker-core"></span>
        <span class="leylek-marker-label">${cityName}</span>
      </div>
    `,
    iconSize: [104, 28],
    iconAnchor: [10, 10],
  });
}

function createRouteMidIcon(label: string) {
  const safe = label.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return L.divIcon({
    className: "leylek-intercity-mid-icon",
    html: `<span class="leylek-intercity-route-pill">${safe}</span>`,
    iconSize: [200, 28],
    iconAnchor: [100, 14],
  });
}

function collectEndpoints(routes: IntercityRouteItem[]) {
  const map = new Map<
    string,
    {
      id: string;
      cityName: string;
      lat: number;
      lng: number;
    }
  >();

  for (const route of routes) {
    const fromKey = route.fromCity;
    const toKey = route.toCity;

    if (!map.has(fromKey)) {
      map.set(fromKey, {
        id: `ep-${fromKey}`,
        cityName: route.fromCity,
        lat: route.fromLat,
        lng: route.fromLng,
      });
    }

    if (!map.has(toKey)) {
      map.set(toKey, {
        id: `ep-${toKey}`,
        cityName: route.toCity,
        lat: route.toLat,
        lng: route.toLng,
      });
    }
  }

  return [...map.values()];
}

export default function IntercityRealMap({ dashboard }: IntercityRealMapProps) {
  const center: LatLngExpression = [39.15, 35.2];
  const zoom = 6;

  const endpoints = useMemo(() => collectEndpoints(dashboard.routes), [dashboard.routes]);

  return (
    <div className="relative h-full min-h-[560px] overflow-hidden rounded-[2rem] sm:min-h-[620px] lg:min-h-[680px]">
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        attributionControl
        scrollWheelZoom={false}
        className="h-full min-h-[560px] w-full bg-slate-950 sm:min-h-[620px] lg:min-h-[680px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {dashboard.routes.map((route) => {
          const positions = getCurvedPositions(route.fromLat, route.fromLng, route.toLat, route.toLng);
          const labelPos = positions[1] as LatLngExpression;
          const routeLabel = `${route.fromCity} → ${route.toCity}`;

          return (
            <Fragment key={route.id}>
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#0ea5e9",
                  opacity: 0.28,
                  weight: 11,
                  className: "leylek-route-glow",
                }}
              />
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#67e8f9",
                  opacity: 0.92,
                  weight: 4,
                  className: "leylek-route-main",
                }}
              />
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#e0fcff",
                  opacity: 0.88,
                  weight: 2,
                  className: "leylek-live-route",
                }}
              />
              <Marker position={labelPos} icon={createRouteMidIcon(routeLabel)} interactive={false} />
            </Fragment>
          );
        })}

        {endpoints.map((point, index) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={createEndpointIcon(point.cityName, index % 3 === 0 ? "emerald" : "cyan")}
            interactive={false}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.1),transparent_36%),linear-gradient(180deg,rgba(2,8,23,0.06),rgba(2,8,23,0.28))]" />
      <div className="pointer-events-none absolute inset-0 subtle-grid opacity-12" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-24 w-full animate-scan-map bg-gradient-to-b from-transparent via-cyan-200/10 to-transparent" />
      </div>

      <div className="pointer-events-none absolute left-3 top-3 max-w-[min(100%,22rem)] rounded-2xl border border-cyan-200/15 bg-slate-950/68 px-3 py-2.5 shadow-soft-card backdrop-blur-xl sm:left-4 sm:top-4 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 sm:text-[11px] sm:tracking-[0.24em]">
            ŞEHİRLER ARASI ROTA AĞI
          </p>
        </div>
        <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-400">Harita görünümü · Demo canlı katman</p>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 max-w-[min(100%,16rem)] rounded-2xl border border-cyan-200/15 bg-slate-950/68 px-3 py-2.5 shadow-soft-card backdrop-blur-xl sm:right-4 sm:top-4 sm:max-w-none sm:px-4 sm:py-3">
        <div className="grid gap-2 text-[10px] sm:text-[11px]">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
            <span className="font-semibold text-slate-400">Aktif ilan</span>
            <span className="font-black text-cyan-100">{dashboard.stats.activeListings}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
            <span className="font-semibold text-slate-400">Bekleyen eşleşme</span>
            <span className="font-black text-emerald-100">{dashboard.stats.pendingMatches}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
            <span className="font-semibold text-slate-400">En yoğun hat</span>
            <span className="max-w-[9rem] truncate text-right font-black text-white">{dashboard.stats.busiestLine}</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[7.5rem] left-3 right-3 grid max-h-[38vh] gap-3 overflow-hidden md:bottom-[7rem] lg:bottom-[7.25rem] lg:left-4 lg:right-4 lg:max-h-none lg:grid-cols-2">
        <div className="map-hud-panel leylek-feed-cycle max-h-[min(42vh,240px)] overflow-y-auto lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Canlı ilan akışı</p>
            <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-black text-emerald-100">canlı</span>
          </div>
          <div className="space-y-1.5">
            {dashboard.activityFeed.slice(0, 5).map((item, index) => (
              <div key={item.id} className="map-hud-row" style={{ animationDelay: `${index * 0.55}s` }}>
                <span className="map-hud-dot" />
                <span className="truncate">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="map-hud-panel max-h-[min(42vh,240px)] overflow-y-auto lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Rota bilgileri</p>
            <span className="text-[10px] font-bold text-slate-400">demo</span>
          </div>
          <div className="space-y-2">
            {dashboard.routeInfoPreviews.map((preview, index) => (
              <div
                key={preview.id}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{ animationDelay: `${index * 0.4}s` }}
              >
                <p className="text-[11px] font-black text-white">{preview.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-slate-400">{preview.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-2xl border border-cyan-200/15 bg-slate-950/64 p-2.5 shadow-soft-card backdrop-blur-xl sm:bottom-4 sm:left-4 sm:right-4 sm:p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">En yoğun hat</p>
            <p className="truncate text-[11px] font-black text-cyan-100">{dashboard.telemetry.busiestLine}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ortalama önerilen masraf</p>
            <p className="text-[11px] font-black text-white">{dashboard.telemetry.averageSuggestedCost}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 md:col-span-1">
            <p className="text-[10px] font-semibold leading-snug text-slate-400">{dashboard.telemetry.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
