/** Kart / liste rotası: şehir içi ilçe özeti veya şehirler arası şehir çifti; tam adres basılmaz. */

export type RouteLabelFields = {
  listing_scope?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  city?: string | null;
  from_text?: string | null;
  to_text?: string | null;
};

const ROUTE_LABEL_MAX = 28;
const POSTAL_ONLY_RE = /^\d{4,8}$/;

function isNoiseRouteSegment(seg: string): boolean {
  const s = seg.trim();
  if (!s) return true;
  if (/^(türkiye|turkiye|turkey|tr)$/i.test(s)) return true;
  if (POSTAL_ONLY_RE.test(s.replace(/\s/g, ''))) return true;
  return false;
}

function truncateRouteLabel(s: string, max = ROUTE_LABEL_MAX): string {
  const t = s.trim();
  if (!t) return '—';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function cityLikeFromText(text?: string | null): string | null {
  const parts = (text || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!;
    if (isNoiseRouteSegment(p)) continue;
    if (p.length >= 2 && p.length <= 44) return p;
  }
  return null;
}

function localEndpointSummary(raw?: string | null): string {
  const parts = (raw || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean);
  const good = parts.filter((p) => !isNoiseRouteSegment(p));
  if (good.length === 0) return '—';
  if (good.length === 1) return truncateRouteLabel(good[0]!);
  const pen = good[good.length - 2]!;
  return truncateRouteLabel(pen);
}

export function formatMuhabbetRouteLabel(row: RouteLabelFields): string {
  const scope = (row.listing_scope || '').toLowerCase().trim();
  if (scope === 'intercity') {
    let o = (row.origin_city || '').trim();
    let d = (row.destination_city || '').trim();
    if (!o || isNoiseRouteSegment(o)) o = cityLikeFromText(row.from_text) || '';
    if (!d || isNoiseRouteSegment(d)) d = cityLikeFromText(row.to_text) || '';
    const left = truncateRouteLabel(o || '—');
    const right = truncateRouteLabel(d || '—');
    return `${left} → ${right}`;
  }
  const a = localEndpointSummary(row.from_text);
  const b = localEndpointSummary(row.to_text);
  return `${a} → ${b}`;
}
