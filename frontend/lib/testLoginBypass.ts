/**
 * Production-safe test login: only two fixed E.164-equivalent numbers may skip OTP.
 * Server enforces the same allowlist; this module is for client UX + parity checks.
 */
const E164_TR_PASSENGER = '905400000001';
const E164_TR_DRIVER = '905400000002';

/** Digits-only canonical TR mobile: 905XXXXXXXXX */
export function normalizePhoneDigitsForTestLogin(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) return d;
  if (d.length === 10 && d.startsWith('5')) return `90${d}`;
  return d;
}

export function isTestUser(phone: string): boolean {
  const c = normalizePhoneDigitsForTestLogin(phone);
  return c === E164_TR_PASSENGER || c === E164_TR_DRIVER;
}

export function getTestUserRole(phone: string): 'driver' | 'passenger' {
  const c = normalizePhoneDigitsForTestLogin(phone);
  if (c === E164_TR_DRIVER) return 'driver';
  return 'passenger';
}
