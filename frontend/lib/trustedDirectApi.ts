import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
export const TDM_GET_TIMEOUT_MS = 8000;
export const TDM_MUTATION_TIMEOUT_MS = 12000;
export const TDM_POLL_INTERVAL_MS = 2500;
export const TDM_MATCHING_TIMEOUT_MS = 60_000;
export const TDM_DEFAULT_TTL_MS = 180_000;
export const TDM_GENERIC_USER_ERROR = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';

export type TrustedDirectVehiclePreference = 'car' | 'motorcycle';

export type TrustedDirectRouteContext = {
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_label: string;
  distance_km?: number | null;
  vehicle_preference?: TrustedDirectVehiclePreference | null;
};

export type TrustedDirectRequestStatus =
  | 'pending_responder'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type TrustedDirectRequestRow = {
  id: string;
  status: TrustedDirectRequestStatus | string;
  requester_id?: string;
  responder_id?: string;
  relationship_connection_id?: string;
  expires_at?: string | null;
  matched_tag_id?: string | null;
  matched_at?: string | null;
  pickup_label?: string | null;
  dropoff_label?: string | null;
  offered_contribution_tl?: number | null;
  vehicle_preference?: TrustedDirectVehiclePreference | null;
};

export type TrustedDirectApiErrorCode =
  | 'UNAUTH'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'SERVER'
  | 'PARSE';

export type TrustedDirectApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: TrustedDirectApiErrorCode;
      message: string;
      detail?: string;
    };

type ErrorBody = {
  detail?: string | { code?: string; message?: string };
  message?: string;
};

export type TrustedDirectActiveResponse = {
  success: true;
  request: TrustedDirectRequestRow | null;
};

export type TrustedDirectCreateResponse = {
  success: true;
  request: TrustedDirectRequestRow;
  invite?: Record<string, unknown> | null;
};

export type TrustedDirectCancelResponse = {
  success: true;
  request: TrustedDirectRequestRow | null;
};

export type CreateTrustedDirectRequestPayload = {
  responder_id: string;
  relationship_connection_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_label: string;
  offered_contribution_tl: number;
  vehicle_preference: TrustedDirectVehiclePreference;
  idempotency_key?: string;
};

export type TrustedDirectActiveTag = {
  id: string;
  status: string;
};

let routeContextStore: TrustedDirectRouteContext | null = null;
let bootstrapHandler: (() => void) | null = null;

export function setTrustedDirectRouteContext(ctx: TrustedDirectRouteContext | null): void {
  routeContextStore = ctx;
}

export function getTrustedDirectRouteContext(): TrustedDirectRouteContext | null {
  return routeContextStore;
}

export function clearTrustedDirectRouteContext(): void {
  routeContextStore = null;
}

export function registerTrustedDirectBootstrapHandler(handler: () => void): () => void {
  bootstrapHandler = handler;
  return () => {
    if (bootstrapHandler === handler) {
      bootstrapHandler = null;
    }
  };
}

export function notifyTrustedDirectBootstrap(): void {
  bootstrapHandler?.();
}

function ok<T>(data: T): TrustedDirectApiResult<T> {
  return { ok: true, data };
}

function fail(
  code: TrustedDirectApiErrorCode,
  message: string,
  detail?: string,
): TrustedDirectApiResult<never> {
  return { ok: false, code, message, ...(detail ? { detail } : {}) };
}

function normalizeRequestRow(raw: Record<string, unknown> | null | undefined): TrustedDirectRequestRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  return {
    id,
    status: String(raw.status || ''),
    requester_id: raw.requester_id != null ? String(raw.requester_id) : undefined,
    responder_id: raw.responder_id != null ? String(raw.responder_id) : undefined,
    relationship_connection_id:
      raw.relationship_connection_id != null ? String(raw.relationship_connection_id) : undefined,
    expires_at: raw.expires_at != null ? String(raw.expires_at) : null,
    matched_tag_id: raw.matched_tag_id != null ? String(raw.matched_tag_id) : null,
    matched_at: raw.matched_at != null ? String(raw.matched_at) : null,
    pickup_label: raw.pickup_label != null ? String(raw.pickup_label) : null,
    dropoff_label: raw.dropoff_label != null ? String(raw.dropoff_label) : null,
    offered_contribution_tl:
      raw.offered_contribution_tl != null ? Number(raw.offered_contribution_tl) : null,
    vehicle_preference:
      raw.vehicle_preference === 'motorcycle' ? 'motorcycle' : raw.vehicle_preference === 'car' ? 'car' : null,
  };
}

async function authHeaders(): Promise<TrustedDirectApiResult<Record<string, string>>> {
  const tok = await getPersistedAccessToken();
  if (!tok?.trim()) {
    return fail('UNAUTH', 'Oturum bulunamadı');
  }
  return ok({
    ...JSON_HEADERS,
    Authorization: `Bearer ${tok.trim()}`,
  });
}

type ParsedErrorBody = {
  code: string;
  message: string;
  raw: string;
};

function logTdmHttpError(status: number, path: string, parsed: ParsedErrorBody): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[trustedDirectApi] HTTP error', {
      status,
      path,
      code: parsed.code || null,
      raw: parsed.raw || null,
    });
  }
}

async function readErrorBody(response: Response): Promise<ParsedErrorBody> {
  try {
    const body = (await response.json()) as ErrorBody;
    if (body.detail != null && typeof body.detail === 'object') {
      const d = body.detail;
      const code = typeof d.code === 'string' ? d.code.trim().toLowerCase() : '';
      const message = typeof d.message === 'string' ? d.message.trim() : '';
      return {
        code,
        message,
        raw: message || code || JSON.stringify(d),
      };
    }
    if (typeof body.detail === 'string') {
      const raw = body.detail.trim();
      return { code: '', message: raw, raw };
    }
    if (typeof body.message === 'string') {
      const raw = body.message.trim();
      return { code: '', message: raw, raw };
    }
  } catch {
    // ignore
  }
  return { code: '', message: '', raw: '' };
}

function userMessageFromParsedError(
  status: number,
  parsed: ParsedErrorBody,
  path: string,
): { code: TrustedDirectApiErrorCode; message: string } {
  const code = parsed.code;
  const rawLower = `${code} ${parsed.message} ${parsed.raw}`.trim().toLowerCase();

  if (status === 401) {
    return { code: 'UNAUTH', message: 'Oturum bulunamadı' };
  }
  if (status === 403) {
    if (code === 'blocked_pair' || rawLower.includes('blocked')) {
      return { code: 'FORBIDDEN', message: 'Bu sürücüyle istek gönderemezsiniz' };
    }
    return { code: 'FORBIDDEN', message: 'Bu işlem için uygun değilsiniz' };
  }
  if (status === 404) {
    if (isTdmFeatureDisabled(status, rawLower, path)) {
      return { code: 'UNAVAILABLE', message: 'Doğrudan eşleşme şu an kullanılamıyor' };
    }
    return { code: 'NOT_FOUND', message: 'Kayıt bulunamadı' };
  }
  if (status === 409) {
    if (
      code === 'active_match_intent_exists' ||
      rawLower.includes('active_match') ||
      rawLower.includes('zaten')
    ) {
      return { code: 'CONFLICT', message: 'Zaten bekleyen bir eşleşme isteğiniz var' };
    }
    if (code === 'expired' || rawLower.includes('expired') || rawLower.includes('süre')) {
      return { code: 'CONFLICT', message: 'İstek süresi doldu' };
    }
    return { code: 'CONFLICT', message: 'İstek şu an gönderilemiyor' };
  }
  if (status === 422) {
    return { code: 'VALIDATION', message: 'Bilgiler eksik veya geçersiz' };
  }
  if (status >= 500) {
    return { code: 'SERVER', message: 'Doğrudan eşleşme şu an kullanılamıyor' };
  }
  return { code: 'SERVER', message: TDM_GENERIC_USER_ERROR };
}

function isTdmFeatureDisabled(status: number, detail: string, path: string): boolean {
  if (status !== 404 || !path.includes('/trusted-direct/')) return false;
  const lower = detail.trim().toLowerCase();
  return (
    lower.includes('feature_disabled') ||
    lower.includes('not available') ||
    lower === 'not found' ||
    lower === ''
  );
}

function mapHttpError(
  status: number,
  parsed: ParsedErrorBody,
  path: string,
): TrustedDirectApiResult<never> {
  logTdmHttpError(status, path, parsed);
  const mapped = userMessageFromParsedError(status, parsed, path);
  return fail(mapped.code, mapped.message, parsed.raw || undefined);
}

export function mapTdmUserFacingError(
  result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>,
): string {
  if (result.code === 'NETWORK') {
    return 'Bağlantı hatası. Lütfen tekrar deneyin.';
  }
  if (result.code === 'UNAUTH') {
    return 'Oturum bulunamadı';
  }
  if (result.code === 'FORBIDDEN') {
    return result.message || 'Bu işlem için uygun değilsiniz';
  }
  if (result.code === 'CONFLICT') {
    return result.message || 'İstek şu an gönderilemiyor';
  }
  if (result.code === 'VALIDATION') {
    return result.message || 'Bilgiler eksik veya geçersiz';
  }
  if (result.code === 'UNAVAILABLE') {
    return 'Doğrudan eşleşme şu an kullanılamıyor';
  }
  if (result.code === 'NOT_FOUND') {
    return 'Kayıt bulunamadı';
  }
  if (result.code === 'SERVER' || result.code === 'PARSE') {
    return result.message || TDM_GENERIC_USER_ERROR;
  }
  return TDM_GENERIC_USER_ERROR;
}

async function tdmGet<T>(path: string, timeoutMs = TDM_GET_TIMEOUT_MS): Promise<TrustedDirectApiResult<T>> {
  const headersResult = await authHeaders();
  if (headersResult.ok === false) return headersResult;

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: headersResult.data,
    timeoutMs,
  });
  if (!res) return fail('NETWORK', 'Bağlantı hatası');
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    return mapHttpError(res.status, parsed, path);
  }
  try {
    return ok((await res.json()) as T);
  } catch {
    return fail('PARSE', TDM_GENERIC_USER_ERROR);
  }
}

async function tdmPost<T>(
  path: string,
  body?: unknown,
  timeoutMs = TDM_MUTATION_TIMEOUT_MS,
): Promise<TrustedDirectApiResult<T>> {
  const headersResult = await authHeaders();
  if (headersResult.ok === false) return headersResult;

  const init: RequestInit & { timeoutMs?: number } = {
    method: 'POST',
    headers: headersResult.data,
    timeoutMs,
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, init);
  if (!res) return fail('NETWORK', 'Bağlantı hatası');
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    return mapHttpError(res.status, parsed, path);
  }
  try {
    return ok((await res.json()) as T);
  } catch {
    return fail('PARSE', TDM_GENERIC_USER_ERROR);
  }
}

/** Probe TDM availability via active-request (404 feature_disabled → unavailable). */
export async function probeTrustedDirectAvailable(): Promise<boolean> {
  const res = await tdmGet<TrustedDirectActiveResponse>('/trusted-direct/request/active');
  if (res.ok) return true;
  return res.code !== 'UNAVAILABLE';
}

export async function getActiveTrustedDirectRequest(): Promise<
  TrustedDirectApiResult<TrustedDirectRequestRow | null>
> {
  const res = await tdmGet<TrustedDirectActiveResponse>('/trusted-direct/request/active');
  if (res.ok === false) return res;
  return ok(normalizeRequestRow(res.data.request as Record<string, unknown>));
}

export async function createTrustedDirectRequest(
  payload: CreateTrustedDirectRequestPayload,
): Promise<TrustedDirectApiResult<TrustedDirectRequestRow>> {
  const res = await tdmPost<TrustedDirectCreateResponse>('/trusted-direct/request', payload);
  if (res.ok === false) return res;
  const row = normalizeRequestRow(res.data.request as Record<string, unknown>);
  if (!row) return fail('PARSE', 'İstek yanıtı geçersiz');
  return ok(row);
}

export async function cancelTrustedDirectRequest(
  requestId: string,
): Promise<TrustedDirectApiResult<TrustedDirectRequestRow | null>> {
  const id = encodeURIComponent(String(requestId || '').trim());
  if (!id) return fail('NOT_FOUND', 'İstek bulunamadı');
  const res = await tdmPost<TrustedDirectCancelResponse>(`/trusted-direct/request/${id}/cancel`);
  if (res.ok === false) return res;
  return ok(normalizeRequestRow(res.data.request as Record<string, unknown>));
}

export async function resolvePersistedPassengerUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    const id = String(parsed?.id || '').trim();
    return id || null;
  } catch {
    return null;
  }
}

export async function fetchPassengerActiveTagForBootstrap(
  userId: string,
): Promise<TrustedDirectApiResult<TrustedDirectActiveTag | null>> {
  const uid = encodeURIComponent(String(userId || '').trim());
  if (!uid) return fail('UNAUTH', 'Kullanıcı kimliği yok');

  const res = await fetchWithTimeout(`${API_BASE_URL}/passenger/active-tag?user_id=${uid}`, {
    method: 'GET',
    headers: JSON_HEADERS,
    timeoutMs: TDM_GET_TIMEOUT_MS,
  });
  if (!res) return fail('NETWORK', 'Bağlantı hatası');
  if (!res.ok) return fail('SERVER', TDM_GENERIC_USER_ERROR);
  try {
    const data = (await res.json()) as { success?: boolean; tag?: Record<string, unknown> | null };
    if (!data.success || !data.tag) return ok(null);
    const tagId = String(data.tag.id || '').trim();
    const status = String(data.tag.status || '').trim().toLowerCase();
    if (!tagId) return ok(null);
    if (status !== 'matched' && status !== 'in_progress') return ok(null);
    return ok({ id: tagId, status });
  } catch {
    return fail('PARSE', TDM_GENERIC_USER_ERROR);
  }
}

export function isDriverVehicleCompatibleWithPreference(
  driverKind: TrustedDirectVehiclePreference | null | undefined,
  preference: TrustedDirectVehiclePreference,
): boolean {
  const dk = driverKind ?? 'car';
  if (preference === 'motorcycle') return dk === 'motorcycle';
  return dk !== 'motorcycle';
}

export async function fetchSuggestedContributionTl(
  route: TrustedDirectRouteContext,
): Promise<{ suggested: number; max: number } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/price/calculate`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        pickup_lat: route.pickup_lat,
        pickup_lng: route.pickup_lng,
        dropoff_lat: route.dropoff_lat,
        dropoff_lng: route.dropoff_lng,
        passenger_vehicle_kind: route.vehicle_preference ?? 'car',
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success?: boolean; suggested_price?: number };
    if (!data.success || data.suggested_price == null) return null;
    const suggested = Math.round(Number(data.suggested_price));
    if (!Number.isFinite(suggested) || suggested <= 0) return null;
    return { suggested, max: suggested * 2 };
  } catch {
    return null;
  }
}
