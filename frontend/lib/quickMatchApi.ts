import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

export const QUICK_MATCH_GET_TIMEOUT_MS = 8000;
export const QUICK_MATCH_MUTATION_TIMEOUT_MS = 12000;

type ErrorBody = {
  detail?: string | {
    code?: string;
    message?: string;
    suggested_contribution_tl?: number;
    max_contribution_tl?: number;
  };
  message?: string;
};

export type QuickMatchValidationCode =
  | 'invalid_contribution'
  | 'contribution_too_low'
  | 'contribution_too_high';

export type QuickMatchApiErrorCode =
  | 'UNAUTH'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'SERVER'
  | 'PARSE';

export type QuickMatchApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: QuickMatchApiErrorCode;
      message: string;
      detail?: string;
      validationCode?: QuickMatchValidationCode;
      suggestedContributionTl?: number;
      maxContributionTl?: number;
    };

export type QuickMatchRequestStatus =
  | 'sequencing'
  | 'matched'
  | 'exhausted'
  | 'expired'
  | 'cancelled';

export type QuickMatchInviteStatus =
  | 'pending_driver'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type QuickMatchDistanceBand = '0_5' | '5_10' | '10_20';

export type QuickMatchVehiclePreference = 'car' | 'motorcycle';

export type QuickMatchCurrentInviteSummary = {
  sequence_no: number | null;
  status: QuickMatchInviteStatus;
  expires_at: string | null;
};

export type QuickMatchRequestPublic = {
  request_id: string;
  status: QuickMatchRequestStatus;
  attempt_count: number;
  expires_at: string | null;
  matched_tag_id: string | null;
  matched_at: string | null;
  cancelled_at: string | null;
  exhausted_at: string | null;
  expired_at: string | null;
  distance_km: number;
  distance_band: QuickMatchDistanceBand;
  suggested_contribution_tl: number;
  offered_contribution_tl: number;
  vehicle_preference: QuickMatchVehiclePreference | null;
  pickup_label: string;
  dropoff_label: string;
  current_invite: QuickMatchCurrentInviteSummary | null;
};

export type QuickMatchInvitePublic = {
  invite_id: string;
  request_id: string;
  sequence_no: number;
  status: QuickMatchInviteStatus;
  distance_band: QuickMatchDistanceBand;
  offered_contribution_tl: number;
  pickup_label: string;
  expires_at: string | null;
  invite_expires_in_sec: number;
};

export type QuickMatchTagSummary = {
  tag_id: string;
  status: string;
  match_channel: 'quick' | string;
};

export type QuickMatchCreateInviteSummary = {
  sequence_no: number | null;
  status: QuickMatchInviteStatus;
  expires_at: string | null;
};

export type CreateQuickMatchRequestPayload = {
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_label: string;
  offered_contribution_tl: number;
  vehicle_preference?: QuickMatchVehiclePreference | null;
};

export type QuickMatchActionResponse = {
  success: true;
  request: QuickMatchRequestPublic;
  invite: QuickMatchCreateInviteSummary | null;
};

export type QuickMatchAcceptResponse = {
  success: true;
  request: QuickMatchRequestPublic;
  invite: QuickMatchCreateInviteSummary | null;
  tag: QuickMatchTagSummary;
};

export type QuickMatchActiveResponse = {
  success: true;
  request: QuickMatchRequestPublic | null;
};

export type QuickMatchCurrentInviteResponse = {
  success: true;
  invite: QuickMatchInvitePublic | null;
};

function ok<T>(data: T): QuickMatchApiResult<T> {
  return { ok: true, data };
}

function fail(
  code: QuickMatchApiErrorCode,
  message: string,
  detail?: string,
  extras?: {
    validationCode?: QuickMatchValidationCode;
    suggestedContributionTl?: number;
    maxContributionTl?: number;
  },
): QuickMatchApiResult<never> {
  return {
    ok: false,
    code,
    message,
    ...(detail ? { detail } : {}),
    ...(extras?.validationCode ? { validationCode: extras.validationCode } : {}),
    ...(extras?.suggestedContributionTl != null
      ? { suggestedContributionTl: extras.suggestedContributionTl }
      : {}),
    ...(extras?.maxContributionTl != null ? { maxContributionTl: extras.maxContributionTl } : {}),
  };
}

function propagateError<T>(err: Extract<QuickMatchApiResult<unknown>, { ok: false }>): QuickMatchApiResult<T> {
  return {
    ok: false,
    code: err.code,
    message: err.message,
    detail: err.detail,
    validationCode: err.validationCode,
    suggestedContributionTl: err.suggestedContributionTl,
    maxContributionTl: err.maxContributionTl,
  };
}

async function quickMatchAuthHeaders(): Promise<QuickMatchApiResult<Record<string, string>>> {
  const tok = await getPersistedAccessToken();
  if (!tok?.trim()) {
    return fail('UNAUTH', 'Oturum bulunamadı');
  }
  return ok({
    ...JSON_HEADERS,
    Authorization: `Bearer ${tok.trim()}`,
  });
}

type ParsedQuickMatchError = {
  message: string;
  validationCode?: QuickMatchValidationCode;
  suggestedContributionTl?: number;
  maxContributionTl?: number;
};

function isValidationCode(value: string): value is QuickMatchValidationCode {
  return (
    value === 'invalid_contribution' ||
    value === 'contribution_too_low' ||
    value === 'contribution_too_high'
  );
}

async function readQuickMatchErrorDetail(response: Response): Promise<ParsedQuickMatchError> {
  try {
    const body = (await response.json()) as ErrorBody;
    if (body.detail != null && typeof body.detail === 'object') {
      const d = body.detail;
      const code = typeof d.code === 'string' && isValidationCode(d.code) ? d.code : undefined;
      const message =
        (typeof d.message === 'string' && d.message.trim()) ||
        (typeof body.message === 'string' && body.message.trim()) ||
        '';
      return {
        message,
        validationCode: code,
        suggestedContributionTl:
          typeof d.suggested_contribution_tl === 'number'
            ? d.suggested_contribution_tl
            : undefined,
        maxContributionTl:
          typeof d.max_contribution_tl === 'number' ? d.max_contribution_tl : undefined,
      };
    }
    if (typeof body.detail === 'string') {
      return { message: body.detail };
    }
    if (typeof body.message === 'string') {
      return { message: body.message };
    }
  } catch {
    // ignore parse errors
  }
  return { message: '' };
}

function isQuickMatchRouteUnavailable(status: number, detail: string, path: string): boolean {
  if (status !== 404) {
    return false;
  }
  const raw = detail.trim();
  const lower = raw.toLowerCase();
  if (!path.includes('/quick-match/')) {
    return false;
  }
  return lower === 'not found' || lower === '' || lower === 'not found.';
}

function mapQuickMatchHttpError(
  status: number,
  parsed: ParsedQuickMatchError,
  path: string,
): QuickMatchApiResult<never> {
  const raw = parsed.message.trim();
  const validationExtras =
    parsed.validationCode != null
      ? {
          validationCode: parsed.validationCode,
          suggestedContributionTl: parsed.suggestedContributionTl,
          maxContributionTl: parsed.maxContributionTl,
        }
      : undefined;

  if (status === 401) {
    return fail('UNAUTH', raw || 'Oturum bulunamadı', raw || undefined, validationExtras);
  }
  if (status === 403) {
    return fail('FORBIDDEN', raw || 'Bu işlem için uygun değilsiniz', raw || undefined, validationExtras);
  }
  if (status === 404) {
    if (isQuickMatchRouteUnavailable(status, raw, path)) {
      return fail('UNAVAILABLE', 'Hızlı eşleşme şu an kullanılamıyor');
    }
    return fail('NOT_FOUND', raw || 'Hızlı eşleşme isteği bulunamadı', raw || undefined, validationExtras);
  }
  if (status === 409) {
    return fail(
      'CONFLICT',
      raw || 'Aktif bir eşleşmeniz var veya istek artık geçerli değil',
      raw || undefined,
      validationExtras,
    );
  }
  if (status === 422) {
    return fail(
      'VALIDATION',
      raw || 'Bilgiler eksik veya katkı payı uygun değil',
      raw || undefined,
      validationExtras,
    );
  }
  if (status >= 500) {
    return fail('SERVER', raw || 'Hızlı eşleşme şu an kullanılamıyor', raw || undefined, validationExtras);
  }
  return fail('SERVER', raw || 'Hızlı eşleşme şu an kullanılamıyor', raw || undefined, validationExtras);
}

async function quickMatchGet<T>(
  path: string,
  timeoutMs: number = QUICK_MATCH_GET_TIMEOUT_MS,
): Promise<QuickMatchApiResult<T>> {
  const headersResult = await quickMatchAuthHeaders();
  if (headersResult.ok === false) {
    return propagateError(headersResult);
  }

  const url = `${API_BASE_URL}${path}`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: headersResult.data,
    timeoutMs,
  });

  if (!res) {
    return fail('NETWORK', 'Bağlantı hatası');
  }

  if (!res.ok) {
    const detail = await readQuickMatchErrorDetail(res);
    return mapQuickMatchHttpError(res.status, detail, path);
  }

  try {
    return ok((await res.json()) as T);
  } catch {
    return fail('PARSE', 'Sunucu yanıtı okunamadı');
  }
}

async function quickMatchPost<T>(
  path: string,
  body?: unknown,
  timeoutMs: number = QUICK_MATCH_MUTATION_TIMEOUT_MS,
): Promise<QuickMatchApiResult<T>> {
  const headersResult = await quickMatchAuthHeaders();
  if (headersResult.ok === false) {
    return propagateError(headersResult);
  }

  const url = `${API_BASE_URL}${path}`;
  const init: RequestInit & { timeoutMs?: number } = {
    method: 'POST',
    headers: headersResult.data,
    timeoutMs,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetchWithTimeout(url, init);

  if (!res) {
    return fail('NETWORK', 'Bağlantı hatası');
  }

  if (!res.ok) {
    const detail = await readQuickMatchErrorDetail(res);
    return mapQuickMatchHttpError(res.status, detail, path);
  }

  try {
    return ok((await res.json()) as T);
  } catch {
    return fail('PARSE', 'Sunucu yanıtı okunamadı');
  }
}

/** POST /quick-match/request */
export async function createQuickMatchRequest(
  payload: CreateQuickMatchRequestPayload,
): Promise<QuickMatchApiResult<QuickMatchActionResponse>> {
  return quickMatchPost<QuickMatchActionResponse>('/quick-match/request', payload);
}

/** GET /quick-match/request/active — 200 + request:null → ok, data:null */
export async function getActiveQuickMatchRequest(): Promise<
  QuickMatchApiResult<QuickMatchRequestPublic | null>
> {
  const res = await quickMatchGet<QuickMatchActiveResponse>('/quick-match/request/active');
  if (res.ok === false) {
    return propagateError(res);
  }
  return ok(res.data.request ?? null);
}

/** GET /quick-match/request/{requestId} */
export async function getQuickMatchRequestStatus(
  requestId: string,
): Promise<QuickMatchApiResult<QuickMatchRequestPublic>> {
  const id = encodeURIComponent(String(requestId || '').trim());
  if (!id) {
    return fail('NOT_FOUND', 'Hızlı eşleşme isteği bulunamadı');
  }

  const res = await quickMatchGet<{ success: true; request: QuickMatchRequestPublic }>(
    `/quick-match/request/${id}`,
  );
  if (res.ok === false) {
    return propagateError(res);
  }
  return ok(res.data.request);
}

/** GET /quick-match/invites/current — 200 + invite:null → ok, data:null */
export async function getCurrentQuickMatchInvite(): Promise<
  QuickMatchApiResult<QuickMatchInvitePublic | null>
> {
  const res = await quickMatchGet<QuickMatchCurrentInviteResponse>('/quick-match/invites/current');
  if (res.ok === false) {
    return propagateError(res);
  }
  return ok(res.data.invite ?? null);
}

/** POST /quick-match/invites/{inviteId}/accept */
export async function acceptQuickMatchInvite(
  inviteId: string,
): Promise<QuickMatchApiResult<QuickMatchAcceptResponse>> {
  const id = encodeURIComponent(String(inviteId || '').trim());
  if (!id) {
    return fail('NOT_FOUND', 'Hızlı eşleşme isteği bulunamadı');
  }
  return quickMatchPost<QuickMatchAcceptResponse>(`/quick-match/invites/${id}/accept`);
}

/** POST /quick-match/invites/{inviteId}/decline */
export async function declineQuickMatchInvite(
  inviteId: string,
): Promise<QuickMatchApiResult<QuickMatchActionResponse>> {
  const id = encodeURIComponent(String(inviteId || '').trim());
  if (!id) {
    return fail('NOT_FOUND', 'Hızlı eşleşme isteği bulunamadı');
  }
  return quickMatchPost<QuickMatchActionResponse>(`/quick-match/invites/${id}/decline`);
}

/** POST /quick-match/request/{requestId}/cancel */
export async function cancelQuickMatchRequest(
  requestId: string,
): Promise<QuickMatchApiResult<QuickMatchActionResponse>> {
  const id = encodeURIComponent(String(requestId || '').trim());
  if (!id) {
    return fail('NOT_FOUND', 'Hızlı eşleşme isteği bulunamadı');
  }
  return quickMatchPost<QuickMatchActionResponse>(`/quick-match/request/${id}/cancel`);
}
