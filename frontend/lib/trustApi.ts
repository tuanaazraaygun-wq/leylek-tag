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

export type TrustRequestResponse = {
  success?: boolean;
  trust_id?: string;
  /** trust_already_active: tag'de zaten pending|accepted; trust_race_lost: eşzamanlı istekte kaybeden */
  error?: string;
  detail?: string;
  request_ttl_expires_at?: string;
};

export type TrustRespondResponse = {
  success?: boolean;
  action?: string;
  error?: string;
};

export async function postTrustRequest(tagId: string): Promise<TrustRequestResponse | null> {
  const headers = await authHeaders();
  const res = await fetchWithTimeout(`${API_BASE_URL}/trust/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tag_id: tagId }),
    timeoutMs: 15000,
  });
  if (!res) return null;
  try {
    const json = (await res.json()) as TrustRequestResponse;
    return json;
  } catch {
    return null;
  }
}

export async function postTrustRespond(trustId: string, accept: boolean): Promise<TrustRespondResponse | null> {
  const headers = await authHeaders();
  const res = await fetchWithTimeout(`${API_BASE_URL}/trust/respond`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ trust_id: trustId, accept }),
    timeoutMs: 15000,
  });
  if (!res) return null;
  try {
    return (await res.json()) as TrustRespondResponse;
  } catch {
    return null;
  }
}

export async function postTrustEnd(trustId: string): Promise<{ success?: boolean; error?: string } | null> {
  const headers = await authHeaders();
  const res = await fetchWithTimeout(`${API_BASE_URL}/trust/end`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ trust_id: trustId }),
    timeoutMs: 15000,
  });
  if (!res) return null;
  try {
    return (await res.json()) as { success?: boolean; error?: string };
  } catch {
    return null;
  }
}

/** GET /trust/active — kabul edilmiş oturumda recovery_* alanları yeniden Agora için dolabilir */
export type TrustActiveSessionRow = Record<string, unknown> & {
  id?: string;
  status?: string;
  channel_name?: string;
  session_hard_deadline_at?: string;
  agora_token?: string;
  recovery_agora_token?: string;
  recovery_peer_user_id?: string;
  peer_user_id?: string;
};

export type TrustActiveResponse = {
  success?: boolean;
  session?: TrustActiveSessionRow | null;
  error?: string;
};

export async function getTrustActive(tagId: string): Promise<TrustActiveResponse | null> {
  const headers = await authHeaders();
  const q = encodeURIComponent(tagId.trim());
  const res = await fetchWithTimeout(`${API_BASE_URL}/trust/active?tag_id=${q}`, {
    method: 'GET',
    headers,
    timeoutMs: 15000,
  });
  if (!res) return null;
  try {
    return (await res.json()) as TrustActiveResponse;
  } catch {
    return null;
  }
}
