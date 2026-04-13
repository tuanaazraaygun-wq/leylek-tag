export type PassengerGender = 'female' | 'male';

const PAYMENT_ALIASES: Record<string, string> = {
  cash: 'cash',
  nakit: 'cash',
  card: 'card',
  kredi: 'card',
  kart: 'card',
  credit_card: 'card',
};

export function normalizePassengerPaymentMethod(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const mapped = PAYMENT_ALIASES[s] ?? PAYMENT_ALIASES[s.replace(/\s+/g, '_')] ?? null;
  if (mapped) return mapped;
  if (s === 'cash' || s === 'card') return s;
  return s;
}

export function parseGender(raw: unknown): 'female' | 'male' | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'female' || s === 'f' || s === 'kadın' || s === 'kadin' || s === 'woman') return 'female';
  if (s === 'male' || s === 'm' || s === 'erkek' || s === 'man') return 'male';
  return null;
}
