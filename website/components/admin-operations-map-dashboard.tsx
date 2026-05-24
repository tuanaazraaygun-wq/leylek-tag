"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isEmailListedKycAdmin } from "@/lib/kyc-admin-auth";
import {
  DENSITY_LEVEL_LABELS,
  densityLevelColor,
  getHighSupplyGapRegions,
  getOperationsMapDemoEventsByCity,
  getOperationsMapRegionsByCity,
  OPERATIONS_MAP_CITIES,
  OPERATIONS_MAP_CITY_LABELS,
  OPERATIONS_MAP_SECURITY_NOTES,
  type OperationsMapCity,
  type OperationsMapDemoEvent,
  type OperationsMapRegion,
} from "@/lib/operations-map-demo-data";
import {
  ADMIN_SUPPORT_ROUTE_PATH,
  getOperationsMapMagicLinkRedirectTo,
  GROWTH_CENTER_ROUTE_PATH,
  KYC_ADMIN_ROUTE_PATH,
  NOTIFICATION_CENTER_ROUTE_PATH,
  OPS_HUB_ROUTE_PATH,
} from "@/lib/site-origin";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type MapLayer = "passenger" | "driver" | "gap" | "routing";

const MAP_LAYERS: { id: MapLayer; label: string }[] = [
  { id: "passenger", label: "Yolcu yoğunluğu" },
  { id: "driver", label: "Sürücü yoğunluğu" },
  { id: "gap", label: "Arz açığı" },
  { id: "routing", label: "Önerilen yönlendirme" },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function reconcileOperationsMapSession(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  setSession: (s: Session | null) => void,
  setIsAdmin: (v: boolean) => void,
  setBusy: (v: boolean) => void,
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user.email) {
      setSession(null);
      setIsAdmin(false);
      return;
    }
    const ok = await isEmailListedKycAdmin(supabase, session.user.email);
    setSession(session);
    setIsAdmin(ok);
  } catch {
    setSession(null);
    setIsAdmin(false);
  } finally {
    setBusy(false);
  }
}

function MockMapPanel({
  regions,
  layers,
  cityLabel,
  hoveredRegionId,
  onHoverRegion,
}: {
  regions: OperationsMapRegion[];
  layers: Record<MapLayer, boolean>;
  cityLabel: string;
  hoveredRegionId: string | null;
  onHoverRegion: (id: string | null) => void;
}) {
  const hovered = regions.find((r) => r.id === hoveredRegionId) ?? null;

  return (
    <div
      className="relative aspect-[16/10] min-h-[240px] overflow-hidden rounded-2xl border border-indigo-400/25 bg-[radial-gradient(ellipse_at_25%_15%,rgba(56,189,248,0.16),transparent_52%),radial-gradient(ellipse_at_75%_85%,rgba(129,140,248,0.18),transparent_48%),linear-gradient(180deg,#010409_0%,#0b1224_48%,#020617_100%)] shadow-[inset_0_0_100px_rgba(15,23,42,0.85),0_24px_60px_-32px_rgba(79,70,229,0.35)] ring-1 ring-indigo-400/10"
      role="img"
      aria-label={`${cityLabel} anonim yoğunluk demo haritası`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(99,102,241,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.12)_1px,transparent_1px)] [background-size:96px_96px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-500/[0.06] to-transparent" />

      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-cyan-400/25 bg-black/60 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100/90">
          Demo veri · son 15 dk simülasyon
        </span>
        <span className="rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[9px] font-semibold text-slate-400">
          {cityLabel} · anonim bölge
        </span>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-black/50 px-2 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-200/90">Simülasyon</span>
      </div>

      {regions.map((region) => {
        const showPassenger = layers.passenger;
        const showDriver = layers.driver;
        const showGap = layers.gap;
        const showRouting = layers.routing && region.supplyGap !== "dusuk";
        const isHot = region.supplyGap === "yuksek" || region.passengerLevel === "yuksek";
        if (!showPassenger && !showDriver && !showGap && !showRouting) return null;

        return (
          <div
            key={region.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${region.mapX}%`, top: `${region.mapY}%` }}
            onMouseEnter={() => onHoverRegion(region.id)}
            onMouseLeave={() => onHoverRegion(null)}
          >
            <div className="relative flex cursor-default items-center justify-center">
              {isHot ? (
                <span
                  className="absolute h-12 w-12 animate-pulse rounded-full bg-rose-400/10 ring-1 ring-rose-400/25 motion-reduce:animate-none"
                  aria-hidden
                />
              ) : null}
              {showRouting ? (
                <span className="absolute h-10 w-10 animate-pulse rounded-full border border-amber-300/35 bg-amber-400/10 motion-reduce:animate-none" aria-hidden />
              ) : null}
              <div className="relative flex flex-col items-center gap-1">
                {showPassenger ? (
                  <span
                    className={`h-3 w-3 rounded-full ring-2 ring-white/10 ${densityLevelColor(region.passengerLevel, "passenger")}`}
                    title={`Yolcu: ${DENSITY_LEVEL_LABELS[region.passengerLevel]}`}
                  />
                ) : null}
                {showDriver ? (
                  <span
                    className={`h-2.5 w-2.5 rounded-full ring-1 ring-white/10 ${densityLevelColor(region.driverLevel, "driver")}`}
                    title={`Sürücü: ${DENSITY_LEVEL_LABELS[region.driverLevel]}`}
                  />
                ) : null}
                {showGap ? (
                  <span
                    className={`h-2 w-2 rounded-full ${densityLevelColor(region.supplyGap, "gap")}`}
                    title={`Arz açığı: ${DENSITY_LEVEL_LABELS[region.supplyGap]}`}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {hovered ? (
        <div className="absolute bottom-14 left-3 right-3 rounded-xl border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur-sm sm:left-auto sm:right-3 sm:max-w-xs">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200/80">Bölge özeti</p>
          <p className="mt-1 text-xs font-semibold text-white">{hovered.region}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <dt className="text-slate-500">Talep</dt>
              <dd className="font-semibold text-slate-200">{DENSITY_LEVEL_LABELS[hovered.passengerLevel]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sürücü</dt>
              <dd className="font-semibold text-slate-200">{DENSITY_LEVEL_LABELS[hovered.driverLevel]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Arz açığı</dt>
              <dd className="font-semibold text-orange-200">{DENSITY_LEVEL_LABELS[hovered.supplyGap]}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[9px] text-slate-500">
        {layers.passenger ? <span className="rounded-md border border-white/5 bg-black/50 px-1.5 py-0.5">● Yolcu</span> : null}
        {layers.driver ? <span className="rounded-md border border-white/5 bg-black/50 px-1.5 py-0.5">● Sürücü</span> : null}
        {layers.gap ? <span className="rounded-md border border-white/5 bg-black/50 px-1.5 py-0.5">● Arz açığı</span> : null}
        {layers.routing ? <span className="rounded-md border border-white/5 bg-black/50 px-1.5 py-0.5">◎ Yönlendirme</span> : null}
      </div>
    </div>
  );
}

function DemoEventLogPanel({
  events,
  activeIndex,
}: {
  events: OperationsMapDemoEvent[];
  activeIndex: number;
}) {
  return (
    <aside className="flex h-full min-h-[240px] flex-col rounded-2xl border border-white/[0.08] bg-slate-950/90">
      <div className="border-b border-white/[0.06] px-3 py-2.5">
        <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Demo olay akışı</h2>
        <p className="mt-0.5 text-[9px] text-slate-500">Statik simülasyon · websocket yok</p>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {events.map((event, index) => {
          const active = index === activeIndex;
          const toneClass =
            event.tone === "warning"
              ? "border-orange-400/25 bg-orange-500/[0.06]"
              : event.tone === "success"
                ? "border-emerald-400/20 bg-emerald-500/[0.05]"
                : "border-cyan-400/15 bg-cyan-500/[0.04]";
          return (
            <li
              key={event.id}
              className={`rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed transition ${
                active ? `${toneClass} ring-1 ring-white/10` : "border-transparent text-slate-500"
              }`}
            >
              <span className="font-mono text-[9px] text-slate-600">{event.minutesAgo} dk önce</span>
              <p className={active ? "text-slate-200" : "text-slate-400"}>{event.message}</p>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function RecommendationCard({
  region,
  onCopy,
}: {
  region: OperationsMapRegion;
  onCopy: (text: string) => void;
}) {
  return (
    <article className="rounded-xl border border-orange-400/25 bg-gradient-to-br from-orange-500/[0.08] to-slate-950/90 p-4 ring-1 ring-orange-400/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-orange-200/90">Arz açığı yüksek</p>
          <h3 className="mt-1 text-sm font-bold text-white">{region.region}</h3>
        </div>
        <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[9px] font-bold text-orange-100">
          Öncelik
        </span>
      </div>
      <div className="mt-3 space-y-2 text-[11px]">
        <div>
          <p className="font-semibold text-slate-400">Önerilen aksiyon</p>
          <p className="mt-0.5 leading-relaxed text-slate-200">{region.recommendation}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-400">Push taslağı</p>
          <p className="mt-0.5 leading-relaxed text-slate-300">{region.suggestedPushDraft}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(region.suggestedPushDraft)}
        className="mt-3 inline-flex min-h-[36px] items-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-100 hover:border-cyan-400/40"
      >
        Taslağı kopyala
      </button>
    </article>
  );
}

export function AdminOperationsMapDashboard() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = configured ? getSupabaseBrowserClient() : null;

  const [busy, setBusy] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [city, setCity] = useState<OperationsMapCity>("ankara");
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({
    passenger: true,
    driver: true,
    gap: true,
    routing: true,
  });
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const regions = useMemo(() => getOperationsMapRegionsByCity(city), [city]);
  const events = useMemo(() => getOperationsMapDemoEventsByCity(city), [city]);
  const priorityRegions = useMemo(() => getHighSupplyGapRegions(city), [city]);
  const activeEventIndex = events.length > 0 ? liveTick % events.length : 0;

  useEffect(() => {
    if (!client) return undefined;
    void reconcileOperationsMapSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setBusy(true);
      void reconcileOperationsMapSession(client, setSession, setIsAdmin, setBusy).catch(() => setBusy(false));
    });

    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick((t) => t + 1), 4500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!copyFeedback) return undefined;
    const id = window.setTimeout(() => setCopyFeedback(null), 2500);
    return () => window.clearTimeout(id);
  }, [copyFeedback]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }, [client]);

  const sendMagicLink = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!client) return;
      const email = emailInput.trim();
      if (!email) {
        setFormError("E-posta gerekli.");
        return;
      }
      setOtpSending(true);
      setFormError(null);
      try {
        const redirectTo = getOperationsMapMagicLinkRedirectTo();
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) {
          setFormError(error.message);
          return;
        }
        setOtpSent(true);
      } catch {
        setFormError("Bağlantı gönderilemedi.");
      } finally {
        setOtpSending(false);
      }
    },
    [client, emailInput],
  );

  const signInWithOAuth = useCallback(
    async (provider: "google" | "apple") => {
      if (!client) return;
      setFormError(null);
      const redirectTo = getOperationsMapMagicLinkRedirectTo();
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) setFormError(error.message);
    },
    [client],
  );

  const toggleLayer = useCallback((id: MapLayer) => {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCopyDraft = useCallback((text: string) => {
    void copyText(text).then((ok) => {
      setCopyFeedback(ok ? "Taslak panoya kopyalandı." : "Kopyalama başarısız.");
    });
  }, []);

  if (!configured || !client) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-black text-white">Yapılandırma eksik</h1>
        <p className="mt-3 text-sm text-slate-400">Supabase ortam değişkenleri tanımlı değil.</p>
      </section>
    );
  }

  if (busy) {
    return (
      <section className="mx-auto flex min-h-[48vh] max-w-xl items-center justify-center px-4 py-20">
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      </section>
    );
  }

  if (!session?.user.email) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-white/[0.09] bg-slate-950/[0.94] p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-200/75">Operasyon haritası</p>
          <h1 className="mt-3 text-xl font-black text-white">Yetkili giriş</h1>
          <p className="mt-2 text-sm text-slate-400">Destek ve KYC panelleri ile aynı admin hesabı.</p>
          {formError ? (
            <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-100" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void signInWithOAuth("google")}
            className="mt-6 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] py-3 text-sm font-semibold text-white hover:border-indigo-400/30"
          >
            Google ile giriş
          </button>
          <button
            type="button"
            onClick={() => void signInWithOAuth("apple")}
            className="mt-2 w-full rounded-xl border border-white/[0.12] bg-black/50 py-3 text-sm font-semibold text-white"
          >
            Apple ile giriş
          </button>
          <form className="mt-6 grid gap-3" onSubmit={sendMagicLink}>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="yetkili@e-posta.com"
              className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/35"
              disabled={otpSending}
            />
            <button
              type="submit"
              disabled={otpSending}
              className="rounded-xl bg-indigo-500/20 py-2.5 text-sm font-bold text-indigo-100 ring-1 ring-indigo-400/30 disabled:opacity-50"
            >
              {otpSending ? "Gönderiliyor…" : "E-posta bağlantısı gönder"}
            </button>
            {otpSent ? <p className="text-xs text-indigo-200/90">Giriş bağlantısı e-postanıza gönderildi.</p> : null}
          </form>
          <Link href={OPS_HUB_ROUTE_PATH} className="mt-6 block text-center text-xs text-slate-500 hover:text-slate-300">
            Operasyon merkezine dön
          </Link>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-amber-500/28 bg-slate-950 p-8 text-center">
          <h1 className="text-xl font-black text-white">Yetkisiz</h1>
          <p className="mt-3 text-sm text-slate-400">E-postanız admin listesinde değil.</p>
          <button type="button" onClick={() => void signOut()} className="mt-8 w-full rounded-xl border border-white/[0.12] py-3 text-sm font-semibold text-cyan-100">
            Çıkış yap
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[70vh] max-w-[min(72rem,calc(100vw-1.25rem))] px-3 pb-24 pt-8 sm:px-4 md:pt-12">
      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300/78">Admin · Harita</p>
          <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">LeylekTAG Operasyon Harita Merkezi</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400">
            Anonim yoğunluk, boş bölge ve yönlendirme hazırlık ekranı. Faz 0B · Demo simülasyon — canlı konum ve OSRM yok.
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{session.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={OPS_HUB_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-cyan-100/95 hover:border-cyan-400/35">
            Operasyon Merkezi
          </Link>
          <Link href={NOTIFICATION_CENTER_ROUTE_PATH} className="inline-flex min-h-[40px] items-center rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-bold text-slate-300 hover:border-white/20">
            Bildirim Merkezi
          </Link>
          <button type="button" onClick={() => void signOut()} className="inline-flex min-h-[40px] items-center rounded-xl border border-rose-500/35 px-3 py-2 text-xs font-bold text-rose-100/95">
            Çıkış
          </button>
        </div>
      </header>

      <div className="mt-5 space-y-2 rounded-xl border border-indigo-400/25 bg-indigo-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-indigo-100/95" role="status">
        <p>
          <strong className="font-bold">Bu ekran demo/anonim operasyon simülasyonudur.</strong>
        </p>
        <p>Tekil kullanıcı konumu gösterilmez. Push otomatik gönderilmez.</p>
        {copyFeedback ? <p className="text-emerald-300">{copyFeedback}</p> : null}
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {OPERATIONS_MAP_CITIES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCity(id)}
              className={`min-h-[36px] rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                city === id
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-100"
                  : "border-white/[0.1] bg-black/30 text-slate-400 hover:border-white/20"
              }`}
            >
              {OPERATIONS_MAP_CITY_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {MAP_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => toggleLayer(layer.id)}
              aria-pressed={layers[layer.id]}
              className={`min-h-[32px] rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${
                layers[layer.id]
                  ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                  : "border-white/[0.08] bg-black/25 text-slate-500"
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(220px,280px)]">
        <MockMapPanel
          regions={regions}
          layers={layers}
          cityLabel={OPERATIONS_MAP_CITY_LABELS[city]}
          hoveredRegionId={hoveredRegionId}
          onHoverRegion={setHoveredRegionId}
        />
        <DemoEventLogPanel events={events} activeIndex={activeEventIndex} />
      </div>

      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          Öncelikli bölgeler · arz açığı yüksek · {OPERATIONS_MAP_CITY_LABELS[city]}
        </h2>
        {priorityRegions.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {priorityRegions.map((region) => (
              <RecommendationCard key={region.id} region={region} onCopy={handleCopyDraft} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">Bu şehirde yüksek arz açığı demo bölgesi yok.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          Bölgesel yoğunluk listesi · {OPERATIONS_MAP_CITY_LABELS[city]}
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead className="border-b border-white/[0.08] bg-black/40 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Bölge</th>
                <th className="px-3 py-2.5 font-semibold">Talep</th>
                <th className="px-3 py-2.5 font-semibold">Sürücü</th>
                <th className="px-3 py-2.5 font-semibold">Arz açığı</th>
                <th className="px-3 py-2.5 font-semibold">Öneri</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-white/[0.05] last:border-0 ${
                    row.supplyGap === "yuksek" ? "bg-orange-500/[0.04]" : ""
                  }`}
                >
                  <td className="px-3 py-3 align-top font-medium text-slate-200">{row.region}</td>
                  <td className="px-3 py-3 align-top text-slate-400">{DENSITY_LEVEL_LABELS[row.passengerLevel]}</td>
                  <td className="px-3 py-3 align-top text-slate-400">{DENSITY_LEVEL_LABELS[row.driverLevel]}</td>
                  <td className="px-3 py-3 align-top text-slate-400">{DENSITY_LEVEL_LABELS[row.supplyGap]}</td>
                  <td className="px-3 py-3 align-top text-slate-400">{row.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200/90">Güvenlik notları</h2>
        <ul className="mt-3 space-y-2">
          {OPERATIONS_MAP_SECURITY_NOTES.map((note) => (
            <li key={note} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={GROWTH_CENTER_ROUTE_PATH} className="inline-flex min-h-[36px] items-center rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-white/20">
          Growth Center
        </Link>
        <Link href={ADMIN_SUPPORT_ROUTE_PATH} className="inline-flex min-h-[36px] items-center rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-white/20">
          Destek paneli
        </Link>
        <Link href={KYC_ADMIN_ROUTE_PATH} className="inline-flex min-h-[36px] items-center rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-white/20">
          KYC İnceleme
        </Link>
      </div>
    </section>
  );
}
