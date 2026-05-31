import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

export type TripPaymentApiErrorCode =
  | 'UNAVAILABLE'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
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
    if (
      lower.includes('payment details not available') ||
      lower.includes('bank account snapshot') ||
      lower.includes('no bank account snapshot')
    ) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Sürücü IBAN bilgisi bulunamadı' };
    }
    return { ok: false, code: 'NOT_FOUND', message: raw || 'Ödeme bilgisi bulunamadı' };
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
