import { isTestFlightDiagnosticsEnabled } from './testFlightDebug';

export type TestFlightDiagSnapshot = {
  role: 'driver' | 'passenger' | 'none';
  driverHasOfferPrice: boolean;
  driverHasSelectedTag: boolean;
  driverOfferSending: boolean;
  driverHasSocketSendOffer: boolean;
  driverHasTagInRequests: boolean;
  driverHasUserLocation: boolean;
  passengerHasDestination: boolean;
  passengerHasPriceInfo: boolean;
  passengerHasSelectedPrice: boolean;
  passengerIsLoggedIn: boolean;
  passengerHasUserLocation: boolean;
  passengerOfferSending: boolean;
  hasActiveTag: boolean;
  hasTagPickup: boolean;
  hasTagDriverLocation: boolean;
  hasTagDestination: boolean;
  hasRoutePolyline: boolean;
  hasRouteMetrics: boolean;
  chatSheetOpen: boolean;
  chatHasActiveTag: boolean;
  blockMatchTransition: boolean;
  blockOfferModal: boolean;
  blockPriceModal: boolean;
  blockOfferSending: boolean;
  blockChatSheet: boolean;
  blockBoardingPrompt: boolean;
  blockBoardingScan: boolean;
  blockPaymentWarn: boolean;
  blockQRModal: boolean;
  blockDriverMatchTransition: boolean;
  updatedAt: number;
};

const EMPTY: TestFlightDiagSnapshot = {
  role: 'none',
  driverHasOfferPrice: false,
  driverHasSelectedTag: false,
  driverOfferSending: false,
  driverHasSocketSendOffer: false,
  driverHasTagInRequests: false,
  driverHasUserLocation: false,
  passengerHasDestination: false,
  passengerHasPriceInfo: false,
  passengerHasSelectedPrice: false,
  passengerIsLoggedIn: false,
  passengerHasUserLocation: false,
  passengerOfferSending: false,
  hasActiveTag: false,
  hasTagPickup: false,
  hasTagDriverLocation: false,
  hasTagDestination: false,
  hasRoutePolyline: false,
  hasRouteMetrics: false,
  chatSheetOpen: false,
  chatHasActiveTag: false,
  blockMatchTransition: false,
  blockOfferModal: false,
  blockPriceModal: false,
  blockOfferSending: false,
  blockChatSheet: false,
  blockBoardingPrompt: false,
  blockBoardingScan: false,
  blockPaymentWarn: false,
  blockQRModal: false,
  blockDriverMatchTransition: false,
  updatedAt: 0,
};

let snapshot: TestFlightDiagSnapshot = { ...EMPTY };

export function getTestFlightDiagSnapshot(): TestFlightDiagSnapshot {
  return snapshot;
}

export function setTestFlightDiagSnapshot(patch: Partial<TestFlightDiagSnapshot>): void {
  if (!isTestFlightDiagnosticsEnabled()) return;
  snapshot = {
    ...snapshot,
    ...patch,
    updatedAt: Date.now(),
  };
}

export function resetTestFlightDiagSnapshot(): void {
  snapshot = { ...EMPTY };
}

export function driverOfferSubmitReady(s: TestFlightDiagSnapshot): boolean {
  return (
    s.driverHasOfferPrice &&
    s.driverHasSelectedTag &&
    !s.driverOfferSending &&
    s.driverHasSocketSendOffer &&
    s.driverHasTagInRequests
  );
}

export function passengerOfferSubmitReady(s: TestFlightDiagSnapshot): boolean {
  return (
    s.passengerIsLoggedIn &&
    s.passengerHasDestination &&
    s.passengerHasPriceInfo &&
    s.passengerHasSelectedPrice &&
    s.passengerHasUserLocation &&
    !s.passengerOfferSending
  );
}

export function collectActiveTouchBlockers(s: TestFlightDiagSnapshot): string[] {
  const out: string[] = [];
  if (s.blockMatchTransition) out.push('matchTransition');
  if (s.blockDriverMatchTransition) out.push('driverMatchTransition');
  if (s.blockOfferModal) out.push('offerModal');
  if (s.blockPriceModal) out.push('priceModal');
  if (s.blockOfferSending) out.push('offerSending');
  if (s.blockChatSheet) out.push('chatSheet');
  if (s.blockBoardingPrompt) out.push('boardingPrompt');
  if (s.blockBoardingScan) out.push('boardingScan');
  if (s.blockPaymentWarn) out.push('paymentWarn');
  if (s.blockQRModal) out.push('qrModal');
  return out;
}

function hasValidCoordPair(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    !(Math.abs(la) < 1e-6 && Math.abs(ln) < 1e-6)
  );
}

export function routeFlagsFromTag(
  tag: {
    pickup_lat?: unknown;
    pickup_lng?: unknown;
    dropoff_lat?: unknown;
    dropoff_lng?: unknown;
    driver_location?: { latitude?: unknown; longitude?: unknown } | null;
    driver_lat?: unknown;
    driver_lng?: unknown;
    driver_latitude?: unknown;
    driver_longitude?: unknown;
    route_info?: unknown;
    pickup_distance_km?: unknown;
    pickup_eta_min?: unknown;
  } | null,
): Pick<
  TestFlightDiagSnapshot,
  'hasTagPickup' | 'hasTagDriverLocation' | 'hasTagDestination' | 'hasRoutePolyline' | 'hasRouteMetrics'
> {
  if (!tag) {
    return {
      hasTagPickup: false,
      hasTagDriverLocation: false,
      hasTagDestination: false,
      hasRoutePolyline: false,
      hasRouteMetrics: false,
    };
  }
  const hasTagPickup = hasValidCoordPair(tag.pickup_lat, tag.pickup_lng);
  const hasTagDestination = hasValidCoordPair(tag.dropoff_lat, tag.dropoff_lng);
  const dl = tag.driver_location;
  let hasTagDriverLocation = false;
  if (dl && typeof dl === 'object') {
    hasTagDriverLocation = hasValidCoordPair(dl.latitude, dl.longitude);
  }
  if (!hasTagDriverLocation) {
    hasTagDriverLocation = hasValidCoordPair(
      tag.driver_lat ?? tag.driver_latitude,
      tag.driver_lng ?? tag.driver_longitude,
    );
  }
  let hasRoutePolyline = false;
  if (tag.route_info && typeof tag.route_info === 'object') {
    const ri = tag.route_info as Record<string, unknown>;
    const op = ri.overview_polyline ?? ri.polyline;
    if (typeof op === 'string' && op.length > 2) hasRoutePolyline = true;
    else if (Array.isArray(ri.coordinates) && ri.coordinates.length >= 2) hasRoutePolyline = true;
  }
  const km = Number(tag.pickup_distance_km);
  const min = Number(tag.pickup_eta_min);
  const hasRouteMetrics = Number.isFinite(km) && km > 0 && Number.isFinite(min) && min > 0;
  return { hasTagPickup, hasTagDriverLocation, hasTagDestination, hasRoutePolyline, hasRouteMetrics };
}
