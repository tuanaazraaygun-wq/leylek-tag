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

export type EmergencyContactRow = {
  id: string;
  name: string;
  phone_masked: string;
  source: 'manual' | 'device_contact';
  sort_order: number;
  created_at?: string;
};

export type EmergencyContactsListResponse = {
  success?: boolean;
  contacts?: EmergencyContactRow[];
};

export type EmergencyContactsStatusResponse = {
  success?: boolean;
  count?: number;
  min_met?: boolean;
  max_reached?: boolean;
};

export type EmergencyContactCreateResponse = {
  success?: boolean;
  contact?: EmergencyContactRow;
  detail?: string;
};

export async function apiEmergencyContactsList(): Promise<EmergencyContactsListResponse | null> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/emergency-contacts`, {
    method: 'GET',
    headers: await authHeaders(),
    timeoutMs: 20000,
  });
  if (!res) return null;
  try {
    return (await res.json()) as EmergencyContactsListResponse;
  } catch {
    return null;
  }
}

export async function apiEmergencyContactsStatus(): Promise<EmergencyContactsStatusResponse | null> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/emergency-contacts/status`, {
    method: 'GET',
    headers: await authHeaders(),
    timeoutMs: 15000,
  });
  if (!res) return null;
  try {
    return (await res.json()) as EmergencyContactsStatusResponse;
  } catch {
    return null;
  }
}

export async function apiEmergencyContactCreate(body: {
  name: string;
  phone: string;
  source: 'manual' | 'device_contact';
  sort_order?: number;
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/emergency-contacts`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      name: body.name.trim(),
      phone: body.phone.trim(),
      source: body.source,
      sort_order: body.sort_order ?? 0,
    }),
    timeoutMs: 20000,
  });
  if (!res) return { ok: false, status: 0, json: {} };
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export async function apiEmergencyContactPatch(
  id: string,
  body: Partial<{ name: string; phone: string; source: 'manual' | 'device_contact'; sort_order: number; is_active: boolean }>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/emergency-contacts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
    timeoutMs: 20000,
  });
  if (!res) return { ok: false, status: 0, json: {} };
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export async function apiEmergencyContactDelete(id: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/emergency-contacts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
    timeoutMs: 20000,
  });
  if (!res) return { ok: false, status: 0 };
  let detail: string | undefined;
  try {
    const j = (await res.json()) as { detail?: string };
    detail = typeof j.detail === 'string' ? j.detail : undefined;
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, detail };
}
