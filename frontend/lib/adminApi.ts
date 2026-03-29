/**
 * Admin panel — tek kaynak: aynı backend ve /api öneki (backendConfig).
 * Telefon: TR 10 hane (532…); AsyncStorage’daki 05… / 90… biçimlerini normalize eder.
 */
import { API_BASE_URL } from './backendConfig';

export const ADMIN_API_BASE = API_BASE_URL;

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
