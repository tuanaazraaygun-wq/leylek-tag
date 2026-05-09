/**
 * Admin panel — tek kaynak: aynı backend ve /api öneki (backendConfig).
 * Telefon: TR 10 hane (532…); AsyncStorage’daki 05… / 90… biçimlerini normalize eder.
 */
import { API_BASE_URL } from './backendConfig';

export const ADMIN_API_BASE = API_BASE_URL;

export type AdminAiResponse = {
  ok?: boolean;
  mode?: string;
  summary?: string;
  hotspots?: string[];
  weakZones?: string[];
  recommendations?: string[];
  risks?: string[];
  metrics?: Record<string, unknown>;
  source?: string;
  filter?: Record<string, unknown>;
};

export type AdminAiSummaryPayload = {
  since_days?: number;
  use_llm?: boolean;
};

export type AdminAiRegionInsightPayload = AdminAiSummaryPayload & {
  city?: string | null;
  region_hint?: string | null;
};

export type AdminAiHelpSummaryPayload = {
  since_days?: number;
};

export class AdminApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' && detail.trim() ? detail : `Admin API request failed (${status})`);
    this.name = 'AdminApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function postAdminAi(
  token: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<AdminAiResponse> {
  const res = await fetch(`${ADMIN_API_BASE}/admin/ai/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError(res.status, (data as { detail?: unknown }).detail);
  }
  return data as AdminAiResponse;
}

export function postAdminAiSummary(
  token: string,
  payload: AdminAiSummaryPayload,
): Promise<AdminAiResponse> {
  return postAdminAi(token, 'summary', payload as Record<string, unknown>);
}

export function postAdminAiRegionInsight(
  token: string,
  payload: AdminAiRegionInsightPayload,
): Promise<AdminAiResponse> {
  return postAdminAi(token, 'region-insight', payload as Record<string, unknown>);
}

export function postAdminAiHelpSummary(
  token: string,
  payload: AdminAiHelpSummaryPayload,
): Promise<AdminAiResponse> {
  return postAdminAi(token, 'driver-passenger-help-summary', payload as Record<string, unknown>);
}

/** TR cep: 10 hane, sadece rakam (örn. 5326497412) */
export function normalizeTrPhone10(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length >= 12) {
    d = d.slice(2);
  } else if (d.startsWith('0') && d.length === 11) {
    d = d.slice(1);
  }
  if (d.length > 10) {
    d = d.slice(-10);
  }
  return d;
}
