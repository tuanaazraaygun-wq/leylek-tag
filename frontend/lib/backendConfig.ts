/**
 * REST ve Socket.IO aynı origin kullanmalı.
 * Aksi halde POST /ride/create (veya /ride/create-offer) bir sunucuda dispatch üretir,
 * sürücü socket'i başka sunucuya bağlanır → teklif hiç görünmez.
 *
 * Leylek Zeka: ayrı base URL (EXPO_PUBLIC_LEYLEK_ZEKA_BACKEND_URL / extra.leylekZekaBackendUrl)
 * ile test sunucusuna bağlanabilir; ana API domain'de kalır.
 */
import Constants from 'expo-constants';

/**
 * Push register zinciri teşhisi: release APK’da ekranda debug paneli için `true` yapın.
 * `__DEV__` iken panel zaten açıktır (iş mantığı değişmez).
 */
export const ENABLE_PUSH_REGISTER_DEBUG_OVERLAY = true;

export function isPushRegisterDebugOverlayEnabled(): boolean {
  return (typeof __DEV__ !== 'undefined' && __DEV__) || ENABLE_PUSH_REGISTER_DEBUG_OVERLAY;
}

/** extra.backendUrl ve env yokken ana API kökü */
export const DEFAULT_BACKEND_BASE_URL = 'https://api.leylektag.com';

/** Leylek Zeka path: POST {base}/api/ai/leylekzeka */
export const LEYLEK_ZEKA_CHAT_PATH = 'ai/leylekzeka';

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
    DEFAULT_BACKEND_BASE_URL;
  return normalizeBase(raw);
}

/** Ana uygulama HTTP(S) kökü — ride, auth, socket ile aynı */
export const BACKEND_BASE_URL = getBackendBaseUrl();

/** FastAPI /api öneki */
export const API_BASE_URL = `${BACKEND_BASE_URL}/api`;

type ExtraShape = {
  backendUrl?: string;
  leylekZekaBackendUrl?: string;
  leylekZekaPath?: string;
};

/**
 * Sadece Leylek Zeka chat isteği için API kökü (sonunda /api yok).
 * Öncelik: EXPO_PUBLIC_LEYLEK_ZEKA_BACKEND_URL → extra.leylekZekaBackendUrl → ana getBackendBaseUrl().
 */
export function getLeylekZekaBackendBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LEYLEK_ZEKA_BACKEND_URL?.trim();
  if (fromEnv) {
    return normalizeBase(fromEnv);
  }
  const extra = Constants.expoConfig?.extra as ExtraShape | undefined;
  const fromExtra = extra?.leylekZekaBackendUrl?.trim();
  if (fromExtra) {
    return normalizeBase(fromExtra);
  }
  return getBackendBaseUrl();
}

/**
 * Leylek Zeka path segmenti (`.../api/` altında, baş/son `/` yok).
 */
export function getLeylekZekaApiPath(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LEYLEK_ZEKA_PATH?.trim();
  if (fromEnv) {
    return fromEnv.replace(/^\/+/g, '').replace(/\/+$/g, '');
  }
  const extra = Constants.expoConfig?.extra as ExtraShape | undefined;
  const fromExtra = extra?.leylekZekaPath?.trim();
  if (fromExtra) {
    return fromExtra.replace(/^\/+/g, '').replace(/\/+$/g, '');
  }
  return LEYLEK_ZEKA_CHAT_PATH;
}

/** Tam URL: POST JSON { message, history } */
export function getLeylekZekaChatUrl(): string {
  const base = getLeylekZekaBackendBaseUrl();
  const path = getLeylekZekaApiPath();
  return `${base}/api/${path}`;
}
