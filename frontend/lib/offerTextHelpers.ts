export function formatOfferKmBadge(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return '?';
  return n.toFixed(1).replace('.', ',');
}

export function offerPickupLine(offer: Record<string, unknown>): string {
  const v =
    offer.pickup_location ??
    offer.pickup_address ??
    offer.from_address ??
    offer.origin_label ??
    offer.pickup;
  const s = typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
  return s || '—';
}

export function offerDropoffLine(offer: Record<string, unknown>): string {
  const v =
    offer.dropoff_location ??
    offer.dropoff_address ??
    offer.to_address ??
    offer.destination_label ??
    offer.dropoff;
  const s = typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
  return s || '—';
}
