import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function authHeaders(): Promise<Record<string, string>> {
  const tok = await getPersistedAccessToken();
  const h: Record<string, string> = { ...JSON_HEADERS };
  if (tok?.trim()) {
    h.Authorization = `Bearer ${tok.trim()}`;
  }
  return h;
}

/** POST /api/panic/send-sms gövdesi (null/undefined alanlar JSON’a yazılmaz). */
export type PanicSendSmsPayload = {
  role: 'driver' | 'passenger';
  contact_ids: string[];
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy_m?: number | null;
  location_captured_at?: string | null;
  tag_id?: string | null;
};

export type PanicSendSmsSmsRow = {
  contact_id: string;
  success: boolean;
  netgsm_error?: string | null;
  job_id?: string | null;
};

export type PanicSendSmsOkBody = {
  success: boolean;
  panic_event_id?: string;
  sms?: PanicSendSmsSmsRow[];
  partial_failure?: boolean;
};

export type PanicSendSmsResult =
  | { kind: 'ok'; httpStatus: number; body: PanicSendSmsOkBody }
  | { kind: 'http_error'; httpStatus: number; body: unknown }
  | { kind: 'network' };

function buildJsonBody(payload: PanicSendSmsPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {
    role: payload.role,
    contact_ids: payload.contact_ids.map((x) => String(x).trim()).filter(Boolean),
  };
  if (payload.latitude != null && payload.longitude != null) {
    out.latitude = Number(payload.latitude);
    out.longitude = Number(payload.longitude);
  }
  if (payload.location_accuracy_m != null && Number.isFinite(Number(payload.location_accuracy_m))) {
    out.location_accuracy_m = Number(payload.location_accuracy_m);
  }
  if (payload.location_captured_at?.trim()) {
    out.location_captured_at = payload.location_captured_at.trim();
  }
  const tid = payload.tag_id?.trim();
  if (tid) {
    out.tag_id = tid;
  }
  return out;
}

/**
 * Acil durum SMS — POST /api/panic/send-sms
 */
export async function apiPanicSendSms(payload: PanicSendSmsPayload): Promise<PanicSendSmsResult> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/panic/send-sms`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(buildJsonBody(payload)),
    timeoutMs: 45000,
  });
  if (!res) {
    return { kind: 'network' };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    return { kind: 'http_error', httpStatus: res.status, body };
  }
  return { kind: 'ok', httpStatus: res.status, body: (body || {}) as PanicSendSmsOkBody };
}
