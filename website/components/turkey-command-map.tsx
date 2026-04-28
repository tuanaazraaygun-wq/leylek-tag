import type { MapCity } from "@/lib/city-live-data";

type RouteSegment = {
  id: string;
  from: MapCity;
  to: MapCity;
};

type HeatDot = {
  id: string;
  x: number;
  y: number;
  label: string;
  intensity: number;
};

type TurkeyCommandMapProps = {
  title: string;
  label: string;
  cities: MapCity[];
  routes: RouteSegment[];
  selectedCity?: MapCity;
  activeRoutes: string;
  activeCities: string;
  lastUpdate: string;
  bottomItems: string[];
  heatDots?: HeatDot[];
  mode: "city" | "intercity";
};

const turkeyOutline =
  "M4.8 39.3 L7.8 34.1 L12.6 30.2 L18.4 27.8 L24.5 27.1 L31.6 28.2 L38.4 23.7 L46.2 25.3 L53.3 22.8 L60.8 24.7 L67.4 23.2 L74.2 25.6 L81.2 29.8 L89.4 34.2 L96.2 40.7 L94.4 45.1 L89.1 49.2 L82.4 51.1 L76.2 55.4 L67.1 57.4 L58.7 63.5 L49.1 60.7 L39.3 67.2 L29.1 63.8 L20.9 59.8 L13.2 59.6 L6.8 53.9 L2.9 46.4 Z";

const provinceLines = [
  "M10 41 C18 38 24 39 32 37 C40 35 46 37 55 34 C64 31 72 34 83 38 C88 40 92 40 96 39",
  "M14 33 C22 36 28 35 36 31 C43 28 51 29 59 28 C67 27 73 29 81 33",
  "M17 52 C25 49 31 51 39 48 C48 45 56 48 66 45 C75 43 82 45 90 47",
  "M25 28 C24 37 26 45 24 58 M38 24 C39 34 37 44 40 66 M53 24 C51 35 54 45 50 61",
  "M66 24 C64 35 68 45 66 57 M78 27 C75 37 80 44 77 54",
  "M9 48 L19 43 L31 44 L42 39 L54 42 L65 39 L77 43 L91 43",
  "M20 58 C30 55 37 58 48 55 C58 52 65 54 75 51",
];

const terrainLines = [
  "M7 35 C18 31 31 32 44 30 C59 27 73 29 92 39",
  "M6 43 C18 39 29 41 42 38 C54 35 70 37 94 44",
  "M10 50 C23 47 34 50 47 47 C61 44 73 47 88 50",
  "M17 57 C30 54 41 57 53 55 C64 53 70 55 79 53",
  "M29 30 C35 35 37 41 38 48 C39 55 43 60 49 64",
  "M56 25 C59 32 60 39 63 46 C66 52 67 55 67 58",
  "M73 27 C76 34 80 39 86 44 C88 46 89 48 88 50",
];

function routePath(fromX: number, fromY: number, toX: number, toY: number, lift = 18) {
  const controlX = (fromX + toX) / 2;
  const controlY = Math.min(fromY, toY) - lift;
  return `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
}

function labelWidth(name: string) {
  return Math.max(9, name.length * 2.25 + 5);
}

export function TurkeyCommandMap({
  title,
  label,
  cities,
  routes,
  selectedCity,
  activeRoutes,
  activeCities,
  lastUpdate,
  bottomItems,
  heatDots = [],
  mode,
}: TurkeyCommandMapProps) {
  const busiestRoute = routes[0] ? `${routes[0].from.name} → ${routes[0].to.name}` : "hazırlanıyor";

  return (
    <section className="relative min-h-[640px] overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[#030b18] shadow-[0_0_120px_rgba(34,211,238,0.16)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_46%_48%,rgba(34,211,238,0.2),transparent_24%),radial-gradient(circle_at_70%_58%,rgba(37,99,235,0.2),transparent_30%),linear-gradient(135deg,rgba(5,18,36,0.8),rgba(1,8,20,0.98))]" />
      <div className="subtle-grid absolute inset-0 opacity-45" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:100%_6px] opacity-20" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-300/12 to-transparent" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-24 w-full animate-scan-map bg-gradient-to-b from-transparent via-cyan-200/13 to-transparent" />
      </div>

      <div className="absolute left-4 top-4 z-10 rounded-2xl border border-cyan-200/15 bg-slate-950/78 px-4 py-3 shadow-soft-card backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100">CANLI ROTA AĞI</p>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>
      </div>

      <div className="absolute right-4 top-4 z-10 hidden grid-cols-3 gap-2 rounded-2xl border border-cyan-200/15 bg-slate-950/78 p-2 shadow-soft-card backdrop-blur-xl sm:grid">
        {[
          ["aktif rota", activeRoutes],
          ["aktif şehir", activeCities],
          ["son güncelleme", lastUpdate],
        ].map(([statLabel, value]) => (
          <div key={statLabel} className="rounded-xl bg-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-slate-500">{statLabel}</p>
            <p className="mt-1 whitespace-nowrap text-xs font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 100 86" className="absolute inset-0 h-full w-full" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`route-gradient-${mode}`} x1="0" x2="100" y1="0" y2="86" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A5F3FC" />
            <stop offset="0.45" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
          <filter id={`map-glow-${mode}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.35" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={`turkey-clip-${mode}`}>
            <path d={turkeyOutline} />
          </clipPath>
        </defs>

        <path
          d={turkeyOutline}
          fill="rgba(13, 148, 136, 0.05)"
          stroke="rgba(34, 211, 238, 0.2)"
          strokeWidth="2.8"
          transform="translate(0 2.6)"
        />
        <path
          d={turkeyOutline}
          fill="rgba(7,27,48,0.9)"
          stroke="rgba(125,249,255,0.48)"
          strokeWidth="0.58"
          filter={`url(#map-glow-${mode})`}
        />
        <g clipPath={`url(#turkey-clip-${mode})`}>
          <path d={turkeyOutline} fill="rgba(34,211,238,0.035)" transform="scale(0.965 0.93) translate(1.8 3.2)" />
          {terrainLines.map((line) => (
            <path key={line} d={line} fill="none" stroke="rgba(14,165,233,0.12)" strokeWidth="0.28" />
          ))}
          {provinceLines.map((line) => (
            <path key={line} d={line} fill="none" stroke="rgba(226,246,255,0.11)" strokeWidth="0.24" />
          ))}
          {Array.from({ length: 13 }, (_, index) => (
            <path
              key={`micro-${index}`}
              d={`M${8 + index * 6} ${31 + (index % 4) * 5} C${16 + index * 4} ${28 + (index % 5) * 4} ${27 + index * 3} ${36 + (index % 3) * 5} ${42 + index * 2.5} ${34 + (index % 4) * 4}`}
              fill="none"
              stroke="rgba(103,232,249,0.055)"
              strokeWidth="0.18"
            />
          ))}
        </g>

        {routes.map((route, index) => {
          const path = routePath(route.from.x, route.from.y, route.to.x, route.to.y, mode === "intercity" ? 24 : 14);
          return (
            <g key={route.id}>
              <path d={path} fill="none" stroke="rgba(14,165,233,0.12)" strokeLinecap="round" strokeWidth="3.1" />
              <path d={path} fill="none" stroke="rgba(226,246,255,0.08)" strokeLinecap="round" strokeWidth="1.35" />
              <path
                d={path}
                fill="none"
                stroke={`url(#route-gradient-${mode})`}
                strokeLinecap="round"
                strokeWidth={mode === "intercity" ? "0.72" : "0.58"}
                strokeDasharray="3 5"
              >
                <animate attributeName="stroke-dashoffset" from="40" to="0" dur={`${2.8 + index * 0.25}s`} repeatCount="indefinite" />
              </path>
              <circle r={mode === "intercity" ? "0.48" : "0.38"} fill="#E0FCFF">
                <animateMotion path={path} dur={`${3.3 + index * 0.35}s`} repeatCount="indefinite" />
              </circle>
              <circle r={mode === "intercity" ? "0.22" : "0.18"} fill="#67E8F9">
                <animateMotion path={path} dur={`${2.7 + index * 0.28}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {heatDots.map((dot) => (
          <g key={dot.id}>
            <circle cx={dot.x} cy={dot.y} r={2 + dot.intensity / 38} fill="rgba(16,185,129,0.11)">
              <animate attributeName="r" values="2;5;2" dur="2.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={dot.x} cy={dot.y} r="0.72" fill="#34D399" />
          </g>
        ))}

        {cities.map((city) => {
          const isSelected = selectedCity?.name === city.name;
          const width = labelWidth(city.name);
          return (
            <g key={city.name}>
              <circle cx={city.x} cy={city.y} r={isSelected ? "3.8" : "1.9"} fill={isSelected ? "rgba(34,211,238,0.18)" : "rgba(96,165,250,0.09)"}>
                <animate attributeName="r" values={isSelected ? "3.2;6.2;3.2" : "1.5;2.8;1.5"} dur={isSelected ? "2.4s" : "3.4s"} repeatCount="indefinite" />
              </circle>
              <circle cx={city.x} cy={city.y} r={isSelected ? "0.92" : "0.55"} fill={isSelected ? "#A5F3FC" : "#60A5FA"} />
              <rect
                x={city.x + 1.5}
                y={city.y - 5.3}
                width={width}
                height="4.2"
                rx="1.8"
                fill="rgba(2,8,23,0.78)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.2"
              />
              <text x={city.x + 3.2} y={city.y - 2.35} fill="rgba(226,246,255,0.9)" fontSize="2.35" fontWeight="700">
                {city.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-5 left-5 right-5 z-10 rounded-3xl border border-cyan-200/15 bg-slate-950/78 p-4 shadow-soft-card backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/80">rota telemetry</p>
          <p className="text-xs font-semibold text-slate-400">En yoğun hat: {busiestRoute}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {bottomItems.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
              <p className="text-xs font-semibold text-cyan-100">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
