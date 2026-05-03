"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveActivityBar, type PulseStats } from "@/components/live-activity-bar";
import { useSiteAction } from "@/components/site-action-context";
import { LIVE_FLOW_PRIMARY, LIVE_FLOW_SECONDARY } from "@/lib/site-copy";

const LS_ROUTE_KEY = "leylek_last_route_search";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function jitter(prev: number, min: number, max: number, step = 2) {
  const delta = Math.floor(Math.random() * (step * 2 + 1)) - step;
  return clamp(prev + delta, min, max);
}

function usePulseStats() {
  const [stats, setStats] = useState<PulseStats>({ searching: 12, routes: 3, users: 128 });

  const tick = useCallback(() => {
    setStats((s) => ({
      searching: jitter(s.searching, 9, 18),
      routes: jitter(s.routes, 1, 6, 1),
      users: jitter(s.users, 118, 142, 3),
    }));
  }, []);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const loop = () => {
      tick();
      id = setTimeout(loop, 3000 + Math.random() * 1000);
    };
    id = setTimeout(loop, 2800 + Math.random() * 800);
    return () => clearTimeout(id);
  }, [tick]);

  return stats;
}

function persistRouteLabel(label: string) {
  try {
    localStorage.setItem(LS_ROUTE_KEY, JSON.stringify({ label }));
  } catch {
    /* ignore */
  }
}

function HeroDestinationInput() {
  const { triggerProgress } = useSiteAction();
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_ROUTE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { label?: string };
      if (p.label && typeof p.label === "string") setRemembered(p.label);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.focus(), 300);
    return () => window.clearTimeout(t);
  }, []);

  const commitSearch = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    persistRouteLabel(t);
    setRemembered(t);
  };

  return (
    <div className="mt-6 sm:mt-8">
      <label htmlFor="hero-destination" className="mb-2 block text-left text-sm font-semibold text-white/85">
        📍 Nereye gitmek istiyorsun?
      </label>
      <input
        id="hero-destination"
        ref={ref}
        type="text"
        name="destination"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Örn. İstanbul → Ankara veya Kadıköy..."
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitSearch(value);
            triggerProgress();
          }
        }}
        onBlur={() => commitSearch(value)}
        className="tap-highlight w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3.5 text-sm text-white placeholder:text-white/40 shadow-inner transition-all duration-300 ease-out focus:border-cyan-400/55 focus:outline-none focus:shadow-[0_0_0_3px_rgba(34,211,238,0.22),0_0_28px_rgba(0,198,255,0.18)]"
      />
      {remembered ? (
        <p className="mt-2 text-xs text-white/55">
          Son araman: <span className="font-semibold text-white/80">{remembered}</span>
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-orange-300/80">
        ⚡ En iyi eşleşmeler genelde 2-3 dakika içinde doluyor
      </p>
    </div>
  );
}

function HeroSocialProof({ users }: { users: number }) {
  const [shown, setShown] = useState(0);
  const animComplete = useRef(false);
  const initialGoal = useRef(users);
  const usersRef = useRef(users);
  usersRef.current = users;

  useEffect(() => {
    const goal = initialGoal.current;
    let start: number | null = null;
    const dur = 1300;
    const ease = (p: number) => 1 - (1 - p) ** 2;
    let raf = 0;

    const frame = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      setShown(Math.round(goal * ease(p)));
      if (p < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        animComplete.current = true;
        setShown(usersRef.current);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!animComplete.current) return;
    setShown(users);
  }, [users]);

  if (users <= 0) {
    return (
      <div className="space-y-1 text-center sm:text-left">
        <p className="text-sm font-semibold text-white/75">{LIVE_FLOW_PRIMARY}</p>
        <p className="text-xs text-white/55">
          <Link href="/indir" className="font-semibold text-cyan-200/90 underline-offset-2 hover:underline">
            {LIVE_FLOW_SECONDARY}
          </Link>
        </p>
      </div>
    );
  }

  if (shown < 1) {
    return <p className="text-center text-sm font-semibold text-white/75 sm:text-left">{LIVE_FLOW_PRIMARY}</p>;
  }

  return (
    <p className="text-center text-sm font-semibold text-white/75 sm:text-left">
      Bugün <span className="tabular-nums text-lg font-black text-cyan-100">{shown}</span> kişi yol buldu
    </p>
  );
}

export function HeroEngagement() {
  const stats = usePulseStats();

  return (
    <div className="space-y-4">
      <HeroDestinationInput />
      <HeroSocialProof users={stats.users} />
      <LiveActivityBar stats={stats} />
    </div>
  );
}
