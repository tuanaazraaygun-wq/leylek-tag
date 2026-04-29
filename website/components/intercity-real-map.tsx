"use client";

import { Fragment, useMemo } from "react";
import L, { type LatLngExpression, type PathOptions } from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import type {
  IntercityDashboard,
  IntercityRouteItem,
  IntercityRouteStatus,
} from "@/lib/intercity-live-data";
import { IntercityMapLegend } from "@/components/live-dashboard-chrome";

type IntercityRealMapProps = {
  dashboard: IntercityDashboard;
  dataMode?: "live" | "demo";
  /** Bump when newest HUD activity line changes (live polls). */
  activityHudFreshCycle?: number;
  liveSparse?: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function IntercityStatNumber({ value }: { value: string }) {
  const numeric = value.replace(/[^\d]/g, "");
  const n = numeric ? parseInt(numeric, 10) : NaN;
  const display = Number.isFinite(n) && numeric.length > 0 ? n : value;
  return <span className="tabular-nums transition-[opacity,color] duration-500 ease-out">{display}</span>;
}

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

function intercityPolylineStyles(status: IntercityRouteStatus): {
  glow: PathOptions;
  main: PathOptions;
  rim: PathOptions;
} {
  switch (status) {
    case "eşleşiyor":
      return {
        glow: {
          color: "#22d3ee",
          opacity: 0.46,
          weight: 16,
          className: "leylek-route-glow leylek-intercity-line leylek-intercity-line--pulse-glow",
        },
        main: {
          color: "#a5f3fc",
          opacity: 0.96,
          weight: 5,
          className: "leylek-route-main leylek-intercity-line leylek-intercity-line--pulse-main",
        },
        rim: {
          color: "#ecfeff",
          opacity: 0.9,
          weight: 2,
          className: "leylek-live-route leylek-intercity-line leylek-intercity-line--pulse-rim",
        },
      };
    case "yakında":
      return {
        glow: {
          color: "#075985",
          opacity: 0.14,
          weight: 9,
          className: "leylek-route-glow leylek-intercity-line leylek-intercity-line--soft-glow",
        },
        main: {
          color: "#67e8f9",
          opacity: 0.38,
          weight: 3,
          className: "leylek-route-main leylek-intercity-line leylek-intercity-line--soft-main",
        },
        rim: {
          color: "#bae6fd",
          opacity: 0.35,
          weight: 1.5,
          className: "leylek-live-route leylek-intercity-line leylek-intercity-line--soft-rim",
        },
      };
    default:
      return {
        glow: {
          color: "#0ea5e9",
          opacity: 0.42,
          weight: 14,
          className: "leylek-route-glow leylek-intercity-line leylek-intercity-line--steady-glow",
        },
        main: {
          color: "#7dd3fc",
          opacity: 0.92,
          weight: 5,
          className: "leylek-route-main leylek-intercity-line leylek-intercity-line--steady-main",
        },
        rim: {
          color: "#e0fcff",
          opacity: 0.82,
          weight: 2,
          className: "leylek-live-route leylek-intercity-line leylek-intercity-line--steady-rim",
        },
      };
  }
}

function createEndpointIcon(cityName: string, accent: "cyan" | "emerald") {
  const activeClass = accent === "emerald" ? " leylek-marker-active" : "";

  return L.divIcon({
    className: "leylek-district-marker",
    html: `
      <div class="leylek-marker leylek-intercity-endpoint${activeClass}">
        <span class="leylek-marker-pulse"></span>
        <span class="leylek-marker-core"></span>
        <span class="leylek-marker-label">${escapeHtml(cityName)}</span>
      </div>
    `,
    iconSize: [104, 28],
    iconAnchor: [10, 10],
  });
}

function createRouteMidLabel(route: IntercityRouteItem) {
  const title = `${route.fromCity} → ${route.toCity}`;
  const meta = `${route.seats} boş koltuk · öneri ${route.suggestedCost}`;

  return L.divIcon({
    className: "leylek-intercity-mid-icon",
    html: `<div class="leylek-intercity-mid-stack"><span class="leylek-intercity-mid-title">${escapeHtml(title)}</span><span class="leylek-intercity-mid-meta">${escapeHtml(meta)}</span></div>`,
    iconSize: [240, 40],
    iconAnchor: [120, 20],
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

export default function IntercityRealMap({
  dashboard,
  dataMode = "demo",
  activityHudFreshCycle = 0,
  liveSparse = false,
}: IntercityRealMapProps) {
  const center: LatLngExpression = [39.15, 35.2];
  const zoom = 6;

  const endpoints = useMemo(() => collectEndpoints(dashboard.routes), [dashboard.routes]);

  const mapHudLine =
    dataMode === "live"
      ? "Harita görünümü · Canlı özet katmanı"
      : "Harita görünümü · Demo görünüm";

  const routePanelBadge = dataMode === "live" ? "canlı" : "demo";

  const outerClass = `relative h-full min-h-[560px] overflow-hidden rounded-[2rem] sm:min-h-[620px] lg:min-h-[680px] ${liveSparse ? "ring-1 ring-cyan-400/10 shadow-[inset_0_0_80px_rgba(34,211,238,0.04)]" : ""}`;

  return (
    <div className={outerClass}>
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
          const ps = intercityPolylineStyles(route.status);

          return (
            <Fragment key={route.id}>
              <Polyline positions={positions} pathOptions={ps.glow} />
              <Polyline positions={positions} pathOptions={ps.main} />
              <Polyline positions={positions} pathOptions={ps.rim} />
              <Marker position={labelPos} icon={createRouteMidLabel(route)} interactive={false} />
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
      <div className="pointer-events-none absolute inset-0 leylek-ambient-drift opacity-[0.38]" />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out ${liveSparse ? "bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/45" : "opacity-0"}`}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-28 w-full animate-scan-map-premium bg-gradient-to-b from-transparent via-cyan-200/[0.07] to-transparent" />
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-[400] max-w-[min(100%,22rem)] rounded-2xl border border-cyan-200/15 bg-slate-950/68 px-3 py-2.5 shadow-soft-card backdrop-blur-xl sm:left-4 sm:top-4 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <span className="live-canli-dot shrink-0" aria-hidden />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 sm:text-[11px] sm:tracking-[0.24em]">
            ŞEHİRLER ARASI ROTA AĞI
          </p>
        </div>
        <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-400">{mapHudLine}</p>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-[400] max-w-[min(100%,17rem)] rounded-2xl border border-cyan-200/15 bg-slate-950/72 px-3 py-2.5 shadow-soft-card backdrop-blur-xl sm:right-4 sm:top-4 sm:max-w-[18.5rem] sm:px-4 sm:py-3">
        <div className="grid gap-2 text-[10px] sm:text-[11px]">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
            <span className="font-semibold text-slate-400">Aktif ilan</span>
            <span className="font-black text-cyan-100">
              <IntercityStatNumber value={dashboard.stats.activeListings} />
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
            <span className="font-semibold text-slate-400">Bekleyen eşleşme</span>
            <span className="font-black text-emerald-100">
              <IntercityStatNumber value={dashboard.stats.pendingMatches} />
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
            <span className="font-semibold text-slate-400">En yoğun hat</span>
            <span className="max-w-[9rem] truncate text-right font-black text-white">{dashboard.stats.busiestLine}</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-[11.25rem] z-[401] max-w-[min(11rem,88vw)] md:top-auto md:bottom-[14rem] lg:right-4">
        <IntercityMapLegend />
      </div>

      <div className="pointer-events-none absolute bottom-[7.25rem] left-3 right-3 z-[400] grid max-h-[min(36vh,220px)] gap-2 overflow-hidden sm:bottom-[7.5rem] md:bottom-[7rem] lg:bottom-[7.25rem] lg:left-4 lg:right-4 lg:max-h-none lg:grid-cols-2 lg:gap-3">
        <div className="map-hud-panel leylek-feed-cycle max-h-[min(36vh,220px)] overflow-y-auto overscroll-contain lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Canlı ilan akışı</p>
            <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-black text-emerald-100">canlı</span>
          </div>
          <div className="space-y-1.5">
            {dashboard.activityFeed.slice(0, 5).map((item, index) => (
              <div
                key={index === 0 ? `feed-${activityHudFreshCycle}-${item.id}` : item.id}
                className={`map-hud-row ${index === 0 && activityHudFreshCycle > 0 ? "map-hud-row--fresh-intercity" : ""}`}
                style={{ animationDelay: `${index * 0.45}s` }}
              >
                <span className="map-hud-dot" />
                <span className="line-clamp-2">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="map-hud-panel max-h-[min(36vh,220px)] overflow-y-auto overscroll-contain lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Rota bilgileri</p>
            <span className="text-[10px] font-bold text-slate-400">{routePanelBadge}</span>
          </div>
          <div className="space-y-2">
            {dashboard.routeInfoPreviews.map((preview, index) => (
              <div
                key={preview.id}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{ animationDelay: `${index * 0.35}s` }}
              >
                <p className="text-[11px] font-black leading-tight text-white">{preview.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-slate-400">{preview.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400] rounded-2xl border border-cyan-200/15 bg-slate-950/64 p-2.5 shadow-soft-card backdrop-blur-xl sm:bottom-4 sm:left-4 sm:right-4 sm:p-3">
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
