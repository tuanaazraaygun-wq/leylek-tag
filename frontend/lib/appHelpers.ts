function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export async function parseApiJson(response: Response): Promise<{ data: unknown }> {
  const text = await response.text();
  if (!text) return { data: null };
  try {
    return { data: JSON.parse(text) as unknown };
  } catch {
    return { data: text };
  }
}

export function apiErrMsg(data: unknown, fallback: string): string {
  const o = asRecord(data);
  if (!o) return typeof data === 'string' && data.trim() ? data.trim() : fallback;
  const detail = o.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    const fr = asRecord(first);
    if (fr && typeof fr.msg === 'string') return fr.msg;
  }
  const msg = o.message ?? o.error ?? o.msg;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return fallback;
}

/** Türkiye cep: 10 hane (başında 0 veya +90 olabilir). */
export function normalizeTrMobile10(raw?: string | null): string {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('90') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : '';
}
