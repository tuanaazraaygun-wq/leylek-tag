import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const DEFAULT_TIMEOUT_MS = 15000;

type ErrorBody = { detail?: string; message?: string };

export type TrustedVehicleKind = 'car' | 'motorcycle';

export type TrustedCounterparty = {
  user_id: string;
  display_name: string | null;
  profile_photo: string | null;
  rating: number | null;
  total_trips: number | null;
  vehicle_kind: TrustedVehicleKind | null;
};

export type TrustedSummaryResponse = {
  success: boolean;
  active_count: number;
  incoming_pending_count: number;
  outgoing_pending_count: number;
  online_trusted_count: number;
};

export type TrustedConnectionRadarState =
  | 'TRUST_READY'
  | 'TRUST_ON_TRIP'
  | 'TRUST_OFFLINE'
  | 'TRUST_STALE'
  | 'TRUST_UNKNOWN'
  | string;

export type TrustedConnectionDistanceBand =
  | 'VERY_CLOSE'
  | 'NEARBY'
  | 'IN_CITY'
  | 'FAR'
  | 'UNKNOWN'
  | string
  | null;

export type TrustedConnectionRadar = {
  schema_version?: number;
  radar_state?: TrustedConnectionRadarState;
  radar_label?: string | null;
  radar_subtitle?: string | null;
  availability_rank?: number | null;
  distance_band?: TrustedConnectionDistanceBand;
  available_in_band?: string | null;
  is_quick_match_ready?: boolean;
  trust_offer_eligible?: boolean;
  offer_block_reason?: string | null;
};

export type TrustedConnectionTieInsightCode =
  | 'TIE_READY_NEARBY'
  | 'TIE_RECENT_TRUSTED'
  | 'TIE_FREQUENT_TRAVEL'
  | 'TIE_HIGH_RATED'
  | 'TIE_ON_TRIP'
  | 'TIE_OFFLINE'
  | 'TIE_INSUFFICIENT_DATA'
  | string;

export type TrustedConnectionTieConfidence = 'high' | 'medium' | 'low' | string;

export type TrustedConnectionTie = {
  schema_version?: number;
  tie_rank?: number | null;
  confidence?: TrustedConnectionTieConfidence;
  primary_insight_code?: TrustedConnectionTieInsightCode;
  insights?: string[];
  pair_completed_trips?: number;
  days_since_last_trip?: number | null;
  suggested_action?: null;
  action_block_reason?: string | null;
};

export type TrustedConnectionItem = {
  connection_id: string;
  role: 'driver' | 'passenger';
  status: 'active';
  since: string | null;
  last_trip_at: string | null;
  counterparty: TrustedCounterparty;
  radar?: TrustedConnectionRadar;
  tie?: TrustedConnectionTie;
};

export type TrustedConnectionsResponse = {
  success: boolean;
  connections: TrustedConnectionItem[];
};

export type TrustedPendingItem = {
  invite_id: string;
  status: 'pending';
  invited_at: string | null;
  expires_at: string | null;
  source_tag_id: string | null;
  from?: TrustedCounterparty;
  to?: TrustedCounterparty;
};

export type TrustedPendingResponse = {
  success: boolean;
  incoming: TrustedPendingItem[];
  outgoing: TrustedPendingItem[];
};

async function authHeaders(): Promise<Record<string, string>> {
  const tok = await getPersistedAccessToken();
  if (!tok?.trim()) {
    throw new Error('Giriş yapmanız gerekiyor');
  }
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${tok.trim()}`,
  };
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ErrorBody;
    if (typeof body.detail === 'string') {
      return body.detail;
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // ignore parse errors
  }
  return '';
}

function throwForHttpStatus(status: number, detail: string): never {
  const msg = detail.trim();
  if (status === 401) {
    throw new Error(msg || 'Oturum geçersiz');
  }
  if (status === 403) {
    throw new Error(msg || 'Hesap erişimi kısıtlı');
  }
  if (status === 404) {
    throw new Error(msg || 'Güven ağı şu an kullanılamıyor');
  }
  if (status >= 500) {
    throw new Error(msg || 'Güven ağı bilgisi alınamadı');
  }
  throw new Error(msg || 'İstek tamamlanamadı');
}

async function trustedNetworkGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}${path}`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  if (!res) {
    throw new Error('Bağlantı hatası');
  }
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throwForHttpStatus(res.status, detail);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Yanıt okunamadı');
  }
}

/** GET /trusted/summary — JWT actor; user_id query yok. */
export async function getTrustedSummary(): Promise<TrustedSummaryResponse> {
  return trustedNetworkGet<TrustedSummaryResponse>('/trusted/summary');
}

/** GET /trusted/connections — aktif trusted bağlantılar (read-only). */
export async function getTrustedConnections(): Promise<TrustedConnectionsResponse> {
  return trustedNetworkGet<TrustedConnectionsResponse>('/trusted/connections');
}

/** GET /trusted/pending — gelen/giden pending davetler (read-only). */
export async function getTrustedPending(): Promise<TrustedPendingResponse> {
  return trustedNetworkGet<TrustedPendingResponse>('/trusted/pending');
}

export type TrustedPairStatus =
  | 'none'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'active'
  | 'declined'
  | 'blocked';

export type TrustedStatusResponse = {
  success: true;
  status: TrustedPairStatus;
  connection_id: string | null;
  invite_id: string | null;
  source_tag_id: string | null;
  invited_at: string | null;
  expires_at: string | null;
  updated_at: string | null;
};

export type TrustedInviteCreateResponse = {
  success: true;
  invite_id: string;
  status: 'pending';
  counterparty_user_id: string;
  source_tag_id: string;
  invited_at: string;
  expires_at: string;
};

type TrustedInviteErrorBody = {
  success?: false;
  code?: string;
  detail?: string;
  message?: string;
};

export class TrustedNetworkApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, detail: string, httpStatus: number) {
    super(detail || 'İstek tamamlanamadı');
    this.name = 'TrustedNetworkApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function readTrustedInviteError(res: Response): Promise<{ code: string; detail: string }> {
  try {
    const body = (await res.json()) as TrustedInviteErrorBody;
    const code = typeof body.code === 'string' ? body.code : 'unknown';
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : typeof body.message === 'string'
          ? body.message
          : '';
    return { code, detail };
  } catch {
    return { code: 'unknown', detail: '' };
  }
}

/** GET /trusted/status — actor/counterparty pair UI durumu (TRUST-BE-A0). */
export async function getTrustedStatus(counterpartyUserId: string): Promise<TrustedStatusResponse> {
  const id = encodeURIComponent(String(counterpartyUserId || '').trim());
  return trustedNetworkGet<TrustedStatusResponse>(`/trusted/status?counterparty_user_id=${id}`);
}

/** POST /trusted/invites — güven ağı daveti oluştur (TRUST-BE-A1). */
export async function createTrustedInvite(body: {
  counterparty_user_id: string;
  source_tag_id: string;
}): Promise<TrustedInviteCreateResponse> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}/trusted/invites`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  if (!res) {
    throw new Error('Bağlantı hatası');
  }
  if (res.ok) {
    try {
      return (await res.json()) as TrustedInviteCreateResponse;
    } catch {
      throw new Error('Yanıt okunamadı');
    }
  }
  const { code, detail } = await readTrustedInviteError(res);
  throw new TrustedNetworkApiError(code, detail || 'Davet gönderilemedi', res.status);
}

export type TrustedInviteMutationResponse = {
  success: true;
  invite_id: string;
  status: 'active' | 'declined';
  counterparty_user_id?: string;
  connection_id?: string;
  source_tag_id?: string | null;
  invited_at?: string | null;
  responded_at?: string | null;
  updated_at?: string | null;
};

export type TrustedRevokeMutationResponse = {
  success: true;
  connection_id: string;
  status: 'revoked';
  counterparty_user_id?: string;
  revoked_at?: string | null;
  revoked_by?: string | null;
  updated_at?: string | null;
};

async function trustedNetworkPost<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const url = `${API_BASE_URL}${path}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  if (!res) {
    throw new Error('Bağlantı hatası');
  }
  if (res.ok) {
    try {
      return (await res.json()) as T;
    } catch {
      throw new Error('Yanıt okunamadı');
    }
  }
  const { code, detail } = await readTrustedInviteError(res);
  throw new TrustedNetworkApiError(code, detail || 'İstek tamamlanamadı', res.status);
}

/** POST /trusted/invites/{invite_id}/accept — gelen daveti kabul et. */
export async function acceptTrustedInvite(inviteId: string): Promise<TrustedInviteMutationResponse> {
  const id = encodeURIComponent(String(inviteId || '').trim());
  return trustedNetworkPost<TrustedInviteMutationResponse>(`/trusted/invites/${id}/accept`);
}

/** POST /trusted/invites/{invite_id}/decline — gelen daveti reddet. */
export async function declineTrustedInvite(inviteId: string): Promise<TrustedInviteMutationResponse> {
  const id = encodeURIComponent(String(inviteId || '').trim());
  return trustedNetworkPost<TrustedInviteMutationResponse>(`/trusted/invites/${id}/decline`);
}

/** POST /trusted/connections/{connection_id}/revoke — aktif bağlantıyı kaldır. */
export async function revokeTrustedConnection(
  connectionId: string,
): Promise<TrustedRevokeMutationResponse> {
  const id = encodeURIComponent(String(connectionId || '').trim());
  return trustedNetworkPost<TrustedRevokeMutationResponse>(`/trusted/connections/${id}/revoke`);
}
