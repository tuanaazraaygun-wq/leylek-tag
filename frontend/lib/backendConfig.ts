/**
 * REST ve Socket.IO aynı origin kullanmalı.
 * Aksi halde POST /ride/create (veya /ride/create-offer) bir sunucuda dispatch üretir,
 * sürücü socket'i başka sunucuya bağlanır → teklif hiç görünmez.
 */
import Constants from 'expo-constants';

function normalizeBase(u: string): string {
  let s = String(u).trim().replace(/\/$/, '');
  if (s.endsWith('/api')) {
    s = s.slice(0, -4);
  }
  return s;
}

export function getBackendBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { backendUrl?: string } | undefined;
  const fromExtra = extra?.backendUrl;
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  const raw =
    (fromExtra && String(fromExtra).trim() ? String(fromExtra) : '') ||
    (fromEnv && String(fromEnv).trim() ? String(fromEnv) : '') ||
    'http://157.173.113.156:8001';
  return normalizeBase(raw);
}

/** HTTP(S) kök: örn. https://api.leylektag.com veya http://IP:8001 */
export const BACKEND_BASE_URL = getBackendBaseUrl();

/** FastAPI /api öneki */
export const API_BASE_URL = `${BACKEND_BASE_URL}/api`;
