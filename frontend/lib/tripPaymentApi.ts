import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

export type TripPaymentApiErrorCode =
  | 'UNAVAILABLE'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NETWORK'
  | 'UNKNOWN';

export type TripPaymentApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TripPaymentApiErrorCode; message: string };

export type TripPaymentDetailsResponse = {
  success?: boolean;
  tag_id?: string;
  account_id?: string;
  iban: string;
  account_holder_name: string | null;
  label?: string | null;
};

export type TransferPaymentClaimMethod = 'cash' | 'iban';

export type TransferPaymentClaimResponse = {
  success?: boolean;
  idempotent?: boolean;
  status?: string;
  method?: TransferPaymentClaimMethod | string;
  tag_id?: string;
  claimed_at?: string;
};

export type TransferPaymentStatusResponse = {
  success?: boolean;
  tag_id?: string;
  status?: string;
  method?: TransferPaymentClaimMethod | string;
  claimed_at?: string;
  confirmed_at?: string;
  disputed_at?: string;
};

export type TransferPaymentRespondResponse = {
  success?: boolean;
  approved?: boolean;
  status?: string;
  tag_id?: string;
  show_rating?: boolean;
  completed_at?: string;
  report_id?: string | null;
};

export type TransferPaymentRespondParams = {
  approved: boolean;
  disputeNote?: string;
};

type ErrorBody = { detail?: string; message?: string };

async function authHeaders(): Promise<Record<string, string>> {
  const tok = await getPersistedAccessToken();
  const h: Record<string, string> = { ...JSON_HEADERS };
  if (tok?.trim()) {
    h.Authorization = `Bearer ${tok.trim()}`;
  }
  return h;
}

function userQuery(userId: string): string {
  return encodeURIComponent(String(userId || '').trim());
}

async function readErrorBody(res: Response): Promise<ErrorBody> {
  try {
    return (await res.json()) as ErrorBody;
  } catch {
    return {};
  }
}

function mapHttpError(status: number, detail: string): TripPaymentApiResult<never> {
  const raw = detail.trim();
  const lower = raw.toLowerCase();

  if (status === 404) {
    if (lower.includes('iban payments not available')) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Bu özellik şu an aktif değil' };
    }
    if (lower.includes('transfer confirmation not available')) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Bu özellik şu an aktif değil' };
    }
    if (
      lower.includes('payment details not available') ||
      lower.includes('bank account snapshot') ||
      lower.includes('no bank account snapshot')
    ) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Sürücü IBAN bilgisi bulunamadı' };
    }
    return { ok: false, code: 'NOT_FOUND', message: raw || 'Ödeme bilgisi bulunamadı' };
  }

  if (status === 409) {
    return { ok: false, code: 'CONFLICT', message: raw || 'İşlem şu an tamamlanamıyor' };
  }

  if (status === 403) {
    if (lower.includes('boarding')) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Biniş doğrulandıktan sonra görüntüleyebilirsiniz',
      };
    }
    if (lower.includes('trip status') || lower.includes('does not allow')) {
      return { ok: false, code: 'FORBIDDEN', message: 'Bu aşamada ödeme bilgisi görüntülenemez' };
    }
    return { ok: false, code: 'FORBIDDEN', message: 'Bu bilgilere erişim yetkiniz yok' };
  }

  if (status === 401) {
    return { ok: false, code: 'FORBIDDEN', message: 'Giriş yapmanız gerekiyor' };
  }

  return { ok: false, code: 'UNKNOWN', message: raw || 'İşlem tamamlanamadı' };
}

export async function fetchTripPaymentDetails(
  tagId: string,
  userId: string,
): Promise<TripPaymentApiResult<TripPaymentDetailsResponse>> {
  const tid = String(tagId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid) {
    return { ok: false, code: 'NOT_FOUND', message: 'Yolculuk bilgisi bulunamadı' };
  }
  if (!uid) {
    return { ok: false, code: 'FORBIDDEN', message: 'Giriş yapmanız gerekiyor' };
  }

  const headers = await authHeaders();
  const qTag = encodeURIComponent(tid);
  const url = `${API_BASE_URL}/trip/${qTag}/payment-details?user_id=${userQuery(uid)}`;

  const res = await fetchWithTimeout(url, { method: 'GET', headers, timeoutMs: 15000 });
  if (!res) {
    return { ok: false, code: 'NETWORK', message: 'Bağlantı hatası' };
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    const detail =
      typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : '';
    return mapHttpError(res.status, detail);
  }

  try {
    const json = (await res.json()) as TripPaymentDetailsResponse;
    if (!json || typeof json.iban !== 'string' || !json.iban.trim()) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Sürücü IBAN bilgisi bulunamadı' };
    }
    return {
      ok: true,
      data: {
        ...json,
        iban: json.iban.trim(),
        account_holder_name: json.account_holder_name ?? null,
      },
    };
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Yanıt okunamadı' };
  }
}

export async function claimTransferPayment(
  tagId: string,
  userId: string,
  options?: { method?: TransferPaymentClaimMethod },
): Promise<TripPaymentApiResult<TransferPaymentClaimResponse>> {
  const tid = String(tagId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid) {
    return { ok: false, code: 'NOT_FOUND', message: 'Yolculuk bilgisi bulunamadı' };
  }
  if (!uid) {
    return { ok: false, code: 'FORBIDDEN', message: 'Giriş yapmanız gerekiyor' };
  }

  const method = options?.method ?? 'iban';
  const headers = await authHeaders();
  const qTag = encodeURIComponent(tid);
  const url = `${API_BASE_URL}/trip/${qTag}/transfer-payment/claim?user_id=${userQuery(uid)}`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ method }),
    timeoutMs: 15000,
  });
  if (!res) {
    return { ok: false, code: 'NETWORK', message: 'Bağlantı hatası' };
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    const detail =
      typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : '';
    return mapHttpError(res.status, detail);
  }

  try {
    const json = (await res.json()) as TransferPaymentClaimResponse;
    if (json?.success === false) {
      return { ok: false, code: 'UNKNOWN', message: 'Ödeme bildirimi gönderilemedi' };
    }
    return { ok: true, data: json ?? {} };
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Yanıt okunamadı' };
  }
}

export async function fetchTransferPaymentStatus(
  tagId: string,
  userId: string,
): Promise<TripPaymentApiResult<TransferPaymentStatusResponse>> {
  const tid = String(tagId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid) {
    return { ok: false, code: 'NOT_FOUND', message: 'Yolculuk bilgisi bulunamadı' };
  }
  if (!uid) {
    return { ok: false, code: 'FORBIDDEN', message: 'Giriş yapmanız gerekiyor' };
  }

  const headers = await authHeaders();
  const qTag = encodeURIComponent(tid);
  const url = `${API_BASE_URL}/trip/${qTag}/transfer-payment/status?user_id=${userQuery(uid)}`;

  const res = await fetchWithTimeout(url, { method: 'GET', headers, timeoutMs: 15000 });
  if (!res) {
    return { ok: false, code: 'NETWORK', message: 'Bağlantı hatası' };
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    const detail =
      typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : '';
    return mapHttpError(res.status, detail);
  }

  try {
    const json = (await res.json()) as TransferPaymentStatusResponse;
    if (json?.success === false) {
      return { ok: false, code: 'UNKNOWN', message: 'Durum alınamadı' };
    }
    return { ok: true, data: json ?? {} };
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Yanıt okunamadı' };
  }
}

export async function respondTransferPayment(
  tagId: string,
  userId: string,
  params: TransferPaymentRespondParams,
): Promise<TripPaymentApiResult<TransferPaymentRespondResponse>> {
  const tid = String(tagId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid) {
    return { ok: false, code: 'NOT_FOUND', message: 'Yolculuk bilgisi bulunamadı' };
  }
  if (!uid) {
    return { ok: false, code: 'FORBIDDEN', message: 'Giriş yapmanız gerekiyor' };
  }

  const headers = await authHeaders();
  const qTag = encodeURIComponent(tid);
  const url = `${API_BASE_URL}/trip/${qTag}/transfer-payment/respond?user_id=${userQuery(uid)}`;
  const body: { approved: boolean; dispute_note?: string } = { approved: !!params.approved };
  const note = String(params.disputeNote || '').trim();
  if (!params.approved && note) {
    body.dispute_note = note.slice(0, 500);
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  if (!res) {
    return { ok: false, code: 'NETWORK', message: 'Bağlantı hatası' };
  }

  if (!res.ok) {
    const errBody = await readErrorBody(res);
    const detail =
      typeof errBody.detail === 'string'
        ? errBody.detail
        : typeof errBody.message === 'string'
          ? errBody.message
          : '';
    return mapHttpError(res.status, detail);
  }

  try {
    const json = (await res.json()) as TransferPaymentRespondResponse;
    if (json?.success === false) {
      return { ok: false, code: 'UNKNOWN', message: 'Yanıt gönderilemedi' };
    }
    return { ok: true, data: json ?? {} };
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Yanıt okunamadı' };
  }
}
