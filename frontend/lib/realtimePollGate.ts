/**
 * RC-SCALE-B2 — Gate / slow dashboard polls when Socket.IO is connected + registered.
 * Falls back to full poll rates when realtime is unhealthy or force-refresh is requested.
 */
import { perfLog } from '../utils/perfDiagLog';

/** No socket activity within this window → treat as stale even if flags say connected. */
export const REALTIME_STALE_MS = 45_000;

export const DRIVER_POLL_BASE_MS = 2500;
export const DRIVER_POLL_HEALTHY_MS = 10_000;

export const PASSENGER_POLL_HEALTHY_TRIP_MS = 8000;
export const PASSENGER_POLL_HEALTHY_IDLE_MS = 12_000;

export const QM_TDM_IDLE_REFRESH_BASE_MS = 3500;
export const QM_TDM_IDLE_REFRESH_HEALTHY_MS = 12_000;

let lastSocketActivityAt = 0;

export function touchRealtimeSocketActivity(source?: string): void {
  lastSocketActivityAt = Date.now();
  if (__DEV__ && source) {
    perfLog('REALTIME_ACTIVITY', { source, t: lastSocketActivityAt });
  }
}

export function clearRealtimeSocketActivity(): void {
  lastSocketActivityAt = 0;
}

export type RealtimeHealthSnapshot = {
  isConnected: boolean;
  isRegistered: boolean;
};

export function isRealtimeHealthy(snapshot: RealtimeHealthSnapshot): boolean {
  if (!snapshot.isConnected || !snapshot.isRegistered) {
    return false;
  }
  if (lastSocketActivityAt === 0) {
    return true;
  }
  return Date.now() - lastSocketActivityAt < REALTIME_STALE_MS;
}

export type PollGateKind =
  | 'passenger_active_tag'
  | 'driver_load_data'
  | 'driver_dispatch_pending'
  | 'driver_requests'
  | 'qm_idle_refresh'
  | 'tdm_idle_refresh';

export function logPollGateSkip(
  kind: PollGateKind,
  detail?: Record<string, string | number | boolean | null>,
): void {
  perfLog('POLL_GATE_SKIP', { kind, ...detail });
}

export function logPollGateFallback(
  kind: PollGateKind,
  reason: string,
  detail?: Record<string, string | number | boolean | null>,
): void {
  perfLog('POLL_GATE_FALLBACK', { kind, reason, ...detail });
}

export function logPollGateForceRefresh(
  kind: PollGateKind,
  reason: string,
  detail?: Record<string, string | number | boolean | null>,
): void {
  perfLog('POLL_GATE_FORCE_REFRESH', { kind, reason, ...detail });
}

export function isPassengerActiveTripStatus(statusRaw: string): boolean {
  const st = statusRaw.trim().toLowerCase();
  return st === 'matched' || st === 'in_progress';
}

/** Passenger active-tag interval: slower fallback when socket healthy. */
export function resolvePassengerActiveTagPollMs(
  baseMs: number,
  snapshot: RealtimeHealthSnapshot,
  opts?: { inActiveTrip?: boolean },
): number {
  if (!isRealtimeHealthy(snapshot)) {
    logPollGateFallback('passenger_active_tag', 'socket_unhealthy');
    return baseMs;
  }
  return opts?.inActiveTrip ? PASSENGER_POLL_HEALTHY_TRIP_MS : PASSENGER_POLL_HEALTHY_IDLE_MS;
}

/** Driver dashboard loadData interval. */
export function resolveDriverLoadDataPollMs(snapshot: RealtimeHealthSnapshot): number {
  if (!isRealtimeHealthy(snapshot)) {
    logPollGateFallback('driver_load_data', 'socket_unhealthy');
    return DRIVER_POLL_BASE_MS;
  }
  return DRIVER_POLL_HEALTHY_MS;
}

/** Quick Match / Trusted Direct idle invite refresh interval. */
export function resolveQmTdmIdleRefreshMs(snapshot: RealtimeHealthSnapshot): number {
  if (!isRealtimeHealthy(snapshot)) {
    logPollGateFallback('qm_idle_refresh', 'socket_unhealthy');
    return QM_TDM_IDLE_REFRESH_BASE_MS;
  }
  return QM_TDM_IDLE_REFRESH_HEALTHY_MS;
}

/**
 * When socket is healthy, skip idle driver offer polls (dispatch-pending + requests).
 * Active-tag poll still runs on the outer loadData tick (at slower interval).
 */
export function shouldSkipIdleDriverOfferPolls(
  snapshot: RealtimeHealthSnapshot,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh) {
    return false;
  }
  if (!isRealtimeHealthy(snapshot)) {
    return false;
  }
  return true;
}
