import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

export type DriverBankApiErrorCode =
  | 'UNAVAILABLE'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'NETWORK'
  | 'UNKNOWN';

export type DriverBankApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DriverBankApiErrorCode; message: string };

export type DriverBankAccountListItem = {
  id: string;
  driver_id?: string;
  account_holder_name: string | null;
  label: string | null;
  is_default: boolean;
  iban_masked: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DriverBankAccountDetail = DriverBankAccountListItem & {
  iban: string;
};

export type DriverBankAccountCreatePayload = {
  iban: string;
  account_holder_name: string;
  label?: string | null;
  is_default?: boolean;
};

export type DriverBankAccountUpdatePayload = {
  iban?: string;
  account_holder_name?: string;
  label?: string | null;
  is_default?: boolean;
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

function mapHttpError(status: number, detail: string): DriverBankApiResult<never> {
  const msg = detail.trim() || 'İşlem tamamlanamadı';
  if (status === 404) {
    if (
      msg.toLowerCase().includes('iban payments not available') ||
      msg.toLowerCase().includes('payment details not available')
    ) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Bu özellik şu an aktif değil' };
    }
    return { ok: false, code: 'NOT_FOUND', message: msg };
  }
  if (status === 422) {
    return { ok: false, code: 'VALIDATION', message: msg };
  }
  if (status === 403) {
    return { ok: false, code: 'FORBIDDEN', message: 'Yetkisiz işlem' };
  }
  return { ok: false, code: 'UNKNOWN', message: msg };
}

async function driverBankRequest<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number },
  userId: string,
): Promise<DriverBankApiResult<T>> {
  const uid = String(userId || '').trim();
  if (!uid) {
    return { ok: false, code: 'FORBIDDEN', message: 'Giriş yapmanız gerekiyor' };
  }

  const headers = await authHeaders();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API_BASE_URL}${path}${sep}user_id=${userQuery(uid)}`;

  const res = await fetchWithTimeout(url, { ...init, headers, timeoutMs: init.timeoutMs ?? 15000 });
  if (!res) {
    return { ok: false, code: 'NETWORK', message: 'Bağlantı hatası' };
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    const detail = typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : '';
    return mapHttpError(res.status, detail);
  }

  try {
    const json = (await res.json()) as T;
    return { ok: true, data: json };
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Yanıt okunamadı' };
  }
}

export async function listDriverBankAccounts(
  userId: string,
): Promise<DriverBankApiResult<{ success?: boolean; accounts: DriverBankAccountListItem[] }>> {
  return driverBankRequest('/driver/bank-accounts', { method: 'GET' }, userId);
}

export async function getDriverBankAccount(
  userId: string,
  accountId: string,
): Promise<DriverBankApiResult<{ success?: boolean; account: DriverBankAccountDetail }>> {
  const id = encodeURIComponent(String(accountId || '').trim());
  return driverBankRequest(`/driver/bank-accounts/${id}`, { method: 'GET' }, userId);
}

export async function createDriverBankAccount(
  userId: string,
  payload: DriverBankAccountCreatePayload,
): Promise<DriverBankApiResult<{ success?: boolean; account: DriverBankAccountDetail }>> {
  return driverBankRequest(
    '/driver/bank-accounts',
    {
      method: 'POST',
      body: JSON.stringify({
        iban: payload.iban,
        account_holder_name: payload.account_holder_name,
        label: payload.label ?? null,
        is_default: Boolean(payload.is_default),
      }),
    },
    userId,
  );
}

export async function updateDriverBankAccount(
  userId: string,
  accountId: string,
  payload: DriverBankAccountUpdatePayload,
): Promise<DriverBankApiResult<{ success?: boolean; account: DriverBankAccountDetail }>> {
  const id = encodeURIComponent(String(accountId || '').trim());
  return driverBankRequest(
    `/driver/bank-accounts/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    userId,
  );
}

export async function deleteDriverBankAccount(
  userId: string,
  accountId: string,
): Promise<DriverBankApiResult<{ success?: boolean }>> {
  const id = encodeURIComponent(String(accountId || '').trim());
  return driverBankRequest(`/driver/bank-accounts/${id}`, { method: 'DELETE' }, userId);
}

export async function setDefaultDriverBankAccount(
  userId: string,
  accountId: string,
): Promise<DriverBankApiResult<{ success?: boolean; account: DriverBankAccountDetail }>> {
  const id = encodeURIComponent(String(accountId || '').trim());
  return driverBankRequest(`/driver/bank-accounts/${id}/set-default`, { method: 'POST' }, userId);
}
