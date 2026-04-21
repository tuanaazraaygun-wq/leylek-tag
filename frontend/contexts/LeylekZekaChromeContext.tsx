import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** Dashboard içi alt akış — PassengerDashboard / DriverDashboard senkronlar. */
export type LeylekZekaFlowHint =
  | 'passenger_home'
  | 'passenger_matching'
  | 'passenger_offer_waiting'
  | 'passenger_trip'
  | 'driver_idle'
  | 'driver_offer_list'
  | 'driver_offer_compose'
  | 'driver_trip'
  | 'driver_kyc_pending'
  | null;

/** Ana akıştaki `AppScreen` ile aynı stringler; index.tsx’ten senkronlanır. */
export type LeylekZekaHomeFlowScreen =
  | 'login'
  | 'test-password'
  | 'otp'
  | 'register'
  | 'set-pin'
  | 'enter-pin'
  | 'role-select'
  | 'dashboard'
  | 'forgot-password'
  | 'reset-pin'
  | 'community'
  | 'driver-kyc'
  | null;

/**
 * Dashboard içinde bu akış ipuçlarında FAB gösterilir (ana harita idle dahil).
 */
const DASHBOARD_LEYLEK_FLOW_HINTS = new Set<LeylekZekaFlowHint>([
  'passenger_home',
  'passenger_matching',
  'passenger_offer_waiting',
  'passenger_trip',
  'driver_idle',
  'driver_offer_list',
  'driver_offer_compose',
  'driver_trip',
  'driver_kyc_pending',
]);

type Ctx = {
  homeFlowScreen: LeylekZekaHomeFlowScreen;
  setHomeFlowScreen: (s: LeylekZekaHomeFlowScreen) => void;
  flowHint: LeylekZekaFlowHint;
  setFlowHint: (h: LeylekZekaFlowHint) => void;
  /** Sohbet penceresi — giriş destek, rol ekranı satırı ve FAB ortak kullanır */
  leylekZekaChatOpen: boolean;
  setLeylekZekaChatOpen: (v: boolean) => void;
};

const LeylekZekaChromeContext = createContext<Ctx | null>(null);

export function LeylekZekaChromeProvider({ children }: { children: React.ReactNode }) {
  const [homeFlowScreen, setHomeFlowScreenState] = useState<LeylekZekaHomeFlowScreen>(null);
  const [flowHint, setFlowHintState] = useState<LeylekZekaFlowHint>(null);
  const [leylekZekaChatOpen, setLeylekZekaChatOpen] = useState(false);
  const setHomeFlowScreen = useCallback((s: LeylekZekaHomeFlowScreen) => {
    setHomeFlowScreenState(s);
  }, []);
  const setFlowHint = useCallback((h: LeylekZekaFlowHint) => {
    setFlowHintState(h);
  }, []);
  const value = useMemo(
    () => ({
      homeFlowScreen,
      setHomeFlowScreen,
      flowHint,
      setFlowHint,
      leylekZekaChatOpen,
      setLeylekZekaChatOpen,
    }),
    [homeFlowScreen, setHomeFlowScreen, flowHint, setFlowHint, leylekZekaChatOpen],
  );
  return (
    <LeylekZekaChromeContext.Provider value={value}>{children}</LeylekZekaChromeContext.Provider>
  );
}

export function useLeylekZekaChrome(): Ctx {
  const ctx = useContext(LeylekZekaChromeContext);
  if (!ctx) {
    throw new Error('useLeylekZekaChrome: provider eksik');
  }
  return ctx;
}

/** `app/*.tsx` tam sayfa rotaları — ana `app/index.tsx` shell’i değil */
const STANDALONE_ROUTE_PREFIXES = [
  '/admin',
  '/profile',
  '/history',
  '/terms',
  '/privacy',
  '/kvkk',
  '/driver-verify',
  '/delete-account',
] as const;

/** pathname ile aynı liste — segment ilk parça (örn. `profile`) */
const STANDALONE_TOP_SEGMENT = new Set(
  STANDALONE_ROUTE_PREFIXES.map((prefix) => prefix.replace(/^\//, '')),
);

function normalizePath(pathname: string | null | undefined): string {
  if (pathname == null || pathname === '') return '/';
  const s = String(pathname).split('?')[0].split('#')[0].trim();
  if (s === '') return '/';
  const noTrail = s.replace(/\/$/, '');
  return noTrail === '' ? '/' : noTrail;
}

/**
 * Ana Shell = `app/index.tsx` (büyük App). Ayrı dosya rotalarında FAB yok.
 *
 * Expo Router kök ekranda `pathname` bazen `/` değil; `segments` ise `[]`, `['index']`
 * veya yalnızca `(group)` olabiliyor. Yalnızca `segments.length === 0` veya `pathname === '/'`
 * kontrolü `['index']` durumunda FAB’ı sürekli gizliyordu.
 */
export function isMainIndexShell(pathname: string | null | undefined, segments: readonly string[] | null | undefined): boolean {
  const p = normalizePath(pathname);

  for (const prefix of STANDALONE_ROUTE_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return false;
  }

  const segs = segments ?? [];
  /** `(tabs)` gibi layout grupları sayfa değil */
  const meaningful = segs.filter((s) => !s.startsWith('('));

  if (meaningful.length === 0) {
    return true;
  }

  if (meaningful.length === 1 && meaningful[0] === 'index') {
    return true;
  }

  if (STANDALONE_TOP_SEGMENT.has(meaningful[0])) {
    return false;
  }

  return p === '/' || p === '/index';
}

/**
 * Yüzen FAB görünürlüğü:
 * - Ana shell (`index.tsx`) dışındaki rotalarda: kapalı.
 * - `role-select`: kapalı (sabit satır `app/index.tsx` + sohbet context ile).
 * - `login` / OTP / PIN vb.: kapalı.
 * - `dashboard`: `flowHint` ∈ `DASHBOARD_LEYLEK_FLOW_HINTS` iken açık (harita idle dahil).
 */
export function shouldShowLeylekZekaFab(params: {
  pathname: string | null | undefined;
  /** Expo Router — kök `index` tespiti için (opsiyonel ama widget’ta verilmeli) */
  segments?: readonly string[] | null;
  homeFlowScreen: LeylekZekaHomeFlowScreen;
  flowHint: LeylekZekaFlowHint;
}): boolean {
  if (!isMainIndexShell(params.pathname, params.segments ?? null)) return false;
  const s = params.homeFlowScreen;
  if (s == null) return false;
  /** Rol ekranında yüzen FAB yok — sabit buton `index.tsx` içinde */
  if (s === 'role-select') return false;
  if (s === 'dashboard') {
    const h = params.flowHint;
    return h != null && DASHBOARD_LEYLEK_FLOW_HINTS.has(h);
  }
  return false;
}
