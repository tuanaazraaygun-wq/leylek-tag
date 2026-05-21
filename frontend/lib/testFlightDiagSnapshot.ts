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
  /** Son Teklif Gönder / ride/create teşhisi (PII yok). */
  rideCreateButtonPressed: boolean;
  rideCreateAttempted: boolean;
  rideCreateHttpStatus: number | null;
  rideCreateHttpOk: 'yes' | 'no' | 'unknown';
  rideCreateHasTag: boolean;
  rideCreateTagIdPrefix: string | null;
  rideCreateEligibleDrivers: number | null;
  rideCreateDispatchMode: string | null;
  rideCreateLastError: string | null;
  rideCreatePassengerUiState: string | null;
  rideCreateUpdatedAt: number;
  /** FCM push kayıt teşhisi — token metni yok. */
  fcmTokenAcquired: 'yes' | 'no' | 'unknown';
  fcmRegisterOk: 'yes' | 'no' | 'unknown';
  fcmPlatform: string;
  fcmEndpoint: string;
  fcmDiagUpdatedAt: number;
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
  rideCreateButtonPressed: false,
  rideCreateAttempted: false,
  rideCreateHttpStatus: null,
  rideCreateHttpOk: 'unknown',
  rideCreateHasTag: false,
  rideCreateTagIdPrefix: null,
  rideCreateEligibleDrivers: null,
  rideCreateDispatchMode: null,
  rideCreateLastError: null,
  rideCreatePassengerUiState: null,
  rideCreateUpdatedAt: 0,
  fcmTokenAcquired: 'unknown',
  fcmRegisterOk: 'unknown',
  fcmPlatform: '—',
  fcmEndpoint: '—',
  fcmDiagUpdatedAt: 0,
  updatedAt: 0,
};

let snapshot: TestFlightDiagSnapshot = { ...EMPTY };
let rideCreateDiagNotify = 0;

export function getRideCreateDiagNotify(): number {
  return rideCreateDiagNotify;
}

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

function tagIdPrefixForDiag(id: unknown): string | null {
  const s = String(id ?? '').trim();
  if (!s) return null;
  if (s.length <= 4) return `${s.slice(0, 1)}…`;
  return `${s.slice(0, 4)}…`;
}

function sanitizeRideCreateError(msg: unknown): string {
  const raw = String(msg ?? '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .trim()
    .slice(0, 80);
  return raw || 'unknown';
}

/** ride/create teşhis snapshot — yalnız TestFlight debug açıkken. */
/** FCM kayıt teşhisi — yalnız TestFlight debug (token içeriği loglanmaz). */
export function setPushFcmDiagSnapshot(patch: {
  fcmTokenAcquired?: 'yes' | 'no' | 'unknown';
  fcmRegisterOk?: 'yes' | 'no' | 'unknown';
  fcmPlatform?: string;
  fcmEndpoint?: string;
}): void {
  if (!isTestFlightDiagnosticsEnabled()) return;
  snapshot = {
    ...snapshot,
    fcmTokenAcquired: patch.fcmTokenAcquired ?? snapshot.fcmTokenAcquired,
    fcmRegisterOk: patch.fcmRegisterOk ?? snapshot.fcmRegisterOk,
    fcmPlatform: patch.fcmPlatform ?? snapshot.fcmPlatform,
    fcmEndpoint: patch.fcmEndpoint ?? snapshot.fcmEndpoint,
    fcmDiagUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function patchRideCreateDiag(
  patch: Partial<
    Pick<
      TestFlightDiagSnapshot,
      | 'rideCreateButtonPressed'
      | 'rideCreateAttempted'
      | 'rideCreateHttpStatus'
      | 'rideCreateHttpOk'
      | 'rideCreateHasTag'
      | 'rideCreateTagIdPrefix'
      | 'rideCreateEligibleDrivers'
      | 'rideCreateDispatchMode'
      | 'rideCreateLastError'
      | 'rideCreatePassengerUiState'
    >
  >,
): void {
  if (!isTestFlightDiagnosticsEnabled()) return;
  rideCreateDiagNotify += 1;
  snapshot = {
    ...snapshot,
    ...patch,
    rideCreateUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function tagIdPrefixFromRideTag(tag: unknown): string | null {
  if (!tag || typeof tag !== 'object') return null;
  const id = (tag as { id?: unknown }).id;
  return tagIdPrefixForDiag(id);
}

export { sanitizeRideCreateError, tagIdPrefixForDiag };

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

