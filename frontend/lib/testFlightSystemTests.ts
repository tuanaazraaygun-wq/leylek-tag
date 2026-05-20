/**
 * Read-only iOS TestFlight sistem testleri (veri değiştirmez).
 */
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';
import { getSupabase } from './supabase';
import {
  collectActiveTouchBlockers,
  driverOfferSubmitReady,
  getTestFlightDiagSnapshot,
  passengerOfferSubmitReady,
} from './testFlightDiagSnapshot';
import {
  getLastRegisteredSocketSid,
} from '../contexts/SocketContext';

export type SystemTestStatus = 'pass' | 'fail' | 'skip' | 'pending';

export type SystemTestResult = {
  id: string;
  label: string;
  status: SystemTestStatus;
  detail: string;
};

function accuracyBucket(acc: number | null | undefined): string {
  if (typeof acc !== 'number' || !Number.isFinite(acc)) return 'unknown';
  if (acc > 100) return 'poor_gt100m';
  if (acc > 30) return 'fair_30_100m';
  return 'ok_le30m';
}

function result(
  id: string,
  label: string,
  status: SystemTestStatus,
  detail: string,
): SystemTestResult {
  return { id, label, status, detail };
}

export async function testBackendReachability(): Promise<SystemTestResult> {
  const id = 'api_reachability';
  const label = 'Backend API (GET read-only)';
  try {
    const t0 = Date.now();
    const res = await fetch(`${API_BASE_URL}/auth/cities`, { method: 'GET' });
    const ms = Date.now() - t0;
    if (res.ok) {
      return result(id, label, 'pass', `httpOk latencyMs=${ms}`);
    }
    return result(id, label, 'fail', `httpStatus=${res.status} latencyMs=${ms}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'network_error';
    return result(id, label, 'fail', msg);
  }
}

export async function testAuthToken(): Promise<SystemTestResult> {
  const id = 'auth_token';
  const label = 'Auth token persisted';
  try {
    const token = await getPersistedAccessToken();
    const has = !!(token && String(token).trim().length > 8);
    return result(id, label, has ? 'pass' : 'fail', has ? 'hasToken=yes' : 'hasToken=no');
  } catch {
    return result(id, label, 'fail', 'read_error');
  }
}

export function testSocketConnected(isConnected: boolean): SystemTestResult {
  return result(
    'socket_connected',
    'Socket connected',
    isConnected ? 'pass' : 'fail',
    isConnected ? 'connected=yes' : 'connected=no',
  );
}

export function testSocketRegistered(isRegistered: boolean): SystemTestResult {
  const sid = getLastRegisteredSocketSid();
  const hasSid = !!sid;
  const ok = isRegistered && hasSid;
  return result(
    'socket_register',
    'Socket register ack',
    ok ? 'pass' : 'fail',
    `registered=${isRegistered ? 'yes' : 'no'} hasSid=${hasSid ? 'yes' : 'no'}`,
  );
}

export function testSupabaseEnv(): SystemTestResult {
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  const ok = url.length > 8 && key.length > 8;
  return result(
    'supabase_env',
    'Supabase env configured',
    ok ? 'pass' : 'fail',
    `hasUrl=${url.length > 8 ? 'yes' : 'no'} hasAnonKey=${key.length > 8 ? 'yes' : 'no'}`,
  );
}

export async function testSupabaseRealtimeSubscribe(): Promise<SystemTestResult> {
  const id = 'supabase_realtime';
  const label = 'Supabase realtime subscribe';
  const client = getSupabase();
  if (!client) {
    return result(id, label, 'fail', 'client=null');
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (status: SystemTestStatus, detail: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void client.removeChannel(channel).catch(() => {});
      resolve(result(id, label, status, detail));
    };
    const channel = client.channel(`diag-${Date.now()}`, {
      config: { broadcast: { self: false } },
    });
    const timer = setTimeout(() => done('fail', 'subscribe_timeout_5s'), 5000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        done('pass', 'status=SUBSCRIBED');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        done('fail', `status=${status}`);
      }
    });
  });
}

export async function testLocationPermission(): Promise<SystemTestResult> {
  const id = 'location_permission';
  const label = 'Location permission';
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    const ok = perm.status === 'granted';
    return result(
      id,
      label,
      ok ? 'pass' : 'fail',
      `status=${perm.status}`,
    );
  } catch {
    return result(id, label, 'fail', 'read_error');
  }
}

export async function testLastKnownPosition(): Promise<SystemTestResult> {
  const id = 'location_last_known';
  const label = 'getLastKnownPositionAsync';
  try {
    const last = await Location.getLastKnownPositionAsync();
    const has = !!last?.coords;
    const bucket = has ? accuracyBucket(last?.coords?.accuracy) : 'none';
    return result(
      id,
      label,
      has ? 'pass' : 'fail',
      `hasFix=${has ? 'yes' : 'no'} accuracy=${bucket}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 60) : 'error';
    return result(id, label, 'fail', msg);
  }
}

export async function testCurrentPosition(): Promise<SystemTestResult> {
  const id = 'location_current';
  const label = 'getCurrentPositionAsync (Balanced)';
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return result(id, label, 'fail', 'permission_not_granted');
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const bucket = accuracyBucket(pos.coords.accuracy);
    return result(id, label, 'pass', `ok accuracy=${bucket}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 60) : 'error';
    return result(id, label, 'fail', msg);
  }
}

export function testOfferStateMatrix(): SystemTestResult {
  const id = 'offer_state_matrix';
  const label = 'Offer submit conditions (read-only)';
  const s = getTestFlightDiagSnapshot();
  const ageSec = s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 1000) : -1;
  if (s.role === 'none' || ageSec > 120) {
    return result(
      id,
      label,
      'skip',
      'snapshot_stale_or_missing — open driver/passenger dashboard',
    );
  }
  if (s.role === 'driver') {
    const parts = [
      `offerPrice=${s.driverHasOfferPrice ? 'ok' : 'MISSING'}`,
      `selectedTag=${s.driverHasSelectedTag ? 'ok' : 'MISSING'}`,
      `notSending=${!s.driverOfferSending ? 'ok' : 'BLOCKED'}`,
      `socketSendOffer=${s.driverHasSocketSendOffer ? 'ok' : 'MISSING'}`,
      `tagInList=${s.driverHasTagInRequests ? 'ok' : 'MISSING'}`,
      `userLocation=${s.driverHasUserLocation ? 'ok' : 'MISSING'}`,
    ];
    const ready = driverOfferSubmitReady(s);
    return result(id, label, ready ? 'pass' : 'fail', parts.join(' '));
  }
  const parts = [
    `loggedIn=${s.passengerIsLoggedIn ? 'ok' : 'MISSING'}`,
    `destination=${s.passengerHasDestination ? 'ok' : 'MISSING'}`,
    `priceInfo=${s.passengerHasPriceInfo ? 'ok' : 'MISSING'}`,
    `selectedPrice=${s.passengerHasSelectedPrice ? 'ok' : 'MISSING'}`,
    `userLocation=${s.passengerHasUserLocation ? 'ok' : 'MISSING'}`,
    `notSending=${!s.passengerOfferSending ? 'ok' : 'BLOCKED'}`,
  ];
  const ready = passengerOfferSubmitReady(s);
  return result(id, label, ready ? 'pass' : 'fail', parts.join(' '));
}

export function testRouteStateMatrix(): SystemTestResult {
  const id = 'route_state_matrix';
  const label = 'Route state (read-only snapshot)';
  const s = getTestFlightDiagSnapshot();
  if (!s.hasActiveTag) {
    return result(id, label, 'skip', 'no_active_tag — match screen required');
  }
  const parts = [
    `userLocation=${s.driverHasUserLocation || s.passengerHasUserLocation ? 'ok' : 'MISSING'}`,
    `pickup=${s.hasTagPickup ? 'ok' : 'MISSING'}`,
    `destination=${s.hasTagDestination ? 'ok' : 'MISSING'}`,
    `driverLocOnTag=${s.hasTagDriverLocation ? 'ok' : 'MISSING'}`,
    `polyline=${s.hasRoutePolyline ? 'ok' : 'MISSING'}`,
    `kmMin=${s.hasRouteMetrics ? 'ok' : 'MISSING'}`,
  ];
  const ok =
    s.hasTagPickup &&
    s.hasTagDestination &&
    (s.hasRoutePolyline || s.hasRouteMetrics);
  return result(id, label, ok ? 'pass' : 'fail', parts.join(' '));
}

export function testChatStateMatrix(isConnected: boolean): SystemTestResult {
  const id = 'chat_state_matrix';
  const label = 'Chat state (read-only snapshot)';
  const s = getTestFlightDiagSnapshot();
  const ageSec = s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 1000) : -1;
  if (ageSec > 120) {
    return result(id, label, 'skip', 'snapshot_stale — open driver/passenger dashboard');
  }
  const hasClient = !!getSupabase();
  const parts = [
    `supabaseClient=${hasClient ? 'ok' : 'MISSING'}`,
    `chatOpen=${s.chatSheetOpen ? 'yes' : 'no'}`,
    `activeTag=${s.chatHasActiveTag ? 'ok' : 'MISSING'}`,
    `socketFallback=${isConnected ? 'available' : 'MISSING'}`,
  ];
  const onTripChat = s.chatHasActiveTag && s.hasActiveTag;
  if (!onTripChat && !s.chatSheetOpen) {
    return result(id, label, 'skip', `${parts.join(' ')} — chat screen not active`);
  }
  const ok = hasClient && s.chatHasActiveTag;
  return result(id, label, ok ? 'pass' : 'fail', parts.join(' '));
}

export function testTouchBlockState(): SystemTestResult {
  const id = 'touch_block_state';
  const label = 'Back/touch blockers (overlay/modal/loading)';
  const s = getTestFlightDiagSnapshot();
  const ageSec = s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 1000) : -1;
  if (ageSec > 120) {
    return result(id, label, 'skip', 'snapshot_stale — open driver/passenger dashboard');
  }
  const blockers = collectActiveTouchBlockers(s);
  if (blockers.length === 0) {
    return result(id, label, 'pass', 'blockers=none');
  }
  return result(id, label, 'fail', `active=${blockers.join(',')}`);
}

export async function testPushPermission(): Promise<SystemTestResult> {
  const id = 'push_permission';
  const label = 'Push notification permission';
  try {
    const perm = await Notifications.getPermissionsAsync();
    const status = perm.status ?? 'unknown';
    const ok = status === 'granted';
    return result(id, label, ok ? 'pass' : 'fail', `status=${status}`);
  } catch {
    return result(id, label, 'fail', 'read_error');
  }
}

export async function runAllSystemTests(input: {
  isConnected: boolean;
  isRegistered: boolean;
}): Promise<SystemTestResult[]> {
  const sync = [
    testSocketConnected(input.isConnected),
    testSocketRegistered(input.isRegistered),
    testSupabaseEnv(),
    testOfferStateMatrix(),
    testRouteStateMatrix(),
    testChatStateMatrix(input.isConnected),
    testTouchBlockState(),
  ];
  const asyncTests = await Promise.all([
    testBackendReachability(),
    testAuthToken(),
    testSupabaseRealtimeSubscribe(),
    testLocationPermission(),
    testLastKnownPosition(),
    testCurrentPosition(),
    testPushPermission(),
  ]);
  return [
    asyncTests[0],
    asyncTests[1],
    sync[0],
    sync[1],
    sync[2],
    asyncTests[2],
    asyncTests[3],
    asyncTests[4],
    asyncTests[5],
    sync[3],
    sync[4],
    sync[5],
    sync[6],
    asyncTests[6],
  ];
}
