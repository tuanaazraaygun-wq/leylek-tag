/**
 * Test hatları (5321111111 / 5322222222) için yardımcılar.
 * Giriş: OTP yerine şifre — POST /api/auth/test-password-login (bcrypt, sunucu allowlist).
 */
const E164_TR_PASSENGER = '905321111111';
const E164_TR_DRIVER = '905322222222';

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
