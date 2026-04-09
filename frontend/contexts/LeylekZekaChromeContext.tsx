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
 * Dashboard içinde yalnız bu akış ipuçlarında FAB gösterilir (teklif / eşleşme / yolculuk / KYC vb.).
 * `passenger_home` ve `driver_idle` bilinçli olarak dışarıda — ana harita/idle’da asistan yok.
 */
const DASHBOARD_LEYLEK_FLOW_HINTS = new Set<LeylekZekaFlowHint>([
  'passenger_matching',
  'passenger_offer_waiting',
  'passenger_trip',
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
};

const LeylekZekaChromeContext = createContext<Ctx | null>(null);

export function LeylekZekaChromeProvider({ children }: { children: React.ReactNode }) {
  const [homeFlowScreen, setHomeFlowScreenState] = useState<LeylekZekaHomeFlowScreen>(null);
  const [flowHint, setFlowHintState] = useState<LeylekZekaFlowHint>(null);
  const setHomeFlowScreen = useCallback((s: LeylekZekaHomeFlowScreen) => {
    setHomeFlowScreenState(s);
  }, []);
  const setFlowHint = useCallback((h: LeylekZekaFlowHint) => {
    setFlowHintState(h);
  }, []);
  const value = useMemo(
    () => ({ homeFlowScreen, setHomeFlowScreen, flowHint, setFlowHint }),
    [homeFlowScreen, setHomeFlowScreen, flowHint, setFlowHint],
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

/**
 * `/` dışı rotalarda gizle.
 * Ana akışta: giriş / OTP / PIN vb. yok — yalnız rol seçim + dashboard içi operasyon akışları.
 */
export function shouldShowLeylekZekaFab(params: {
  pathname: string | null | undefined;
  homeFlowScreen: LeylekZekaHomeFlowScreen;
  flowHint: LeylekZekaFlowHint;
}): boolean {
  const raw = String(params.pathname ?? '/').replace(/\/$/, '') || '/';
  if (raw !== '/' && raw !== '') return false;
  const s = params.homeFlowScreen;
  if (s == null) return false;
  if (s === 'role-select') return true;
  if (s === 'dashboard') {
    const h = params.flowHint;
    return h != null && DASHBOARD_LEYLEK_FLOW_HINTS.has(h);
  }
  return false;
}
