/**
 * REST ve Socket.IO aynı origin kullanmalı.
 * Aksi halde POST /ride/create (veya /ride/create-offer) bir sunucuda dispatch üretir,
 * sürücü socket'i başka sunucuya bağlanır → teklif hiç görünmez.
 *
 * Leylek Zeka: ayrı base URL (EXPO_PUBLIC_LEYLEK_ZEKA_BACKEND_URL / extra.leylekZekaBackendUrl)
 * ile test sunucusuna bağlanabilir; ana API domain'de kalır.
 */
import Constants from 'expo-constants';

/** Push register debug paneli — yalnızca geliştirme derlemesinde; prod’da kapalı */
export function isPushRegisterDebugOverlayEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

/** extra.backendUrl ve env yokken ana API kökü */
export const DEFAULT_BACKEND_BASE_URL = 'https://api.leylektag.com';

/** Release APK: expo env/extra yoksa veya leylektag.com (Next) tabanı seçilmişse Places istemcisi */
export const RELEASE_PLACES_API_FALLBACK_ROOT = 'http://157.173.113.156:8001/api';

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

/** expo extra veya env ile backend adresi özellikle verilmiş mi (built-in DEFAULT sayılmaz) */
export function hasExplicitBackendUrlConfig(): boolean {
  const extra = Constants.expoConfig?.extra as { backendUrl?: string } | undefined;
  const fromExtra = extra?.backendUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  return Boolean(fromExtra || fromEnv);
}

/** leylektag.com / www — Next.js ile /api karışması; api.leylektag.com dahil DEĞİL */
export function isLeylekTagMarketingHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'leylektag.com' || h === 'www.leylektag.com';
}

/**
 * GET /places/search için API kökü (`.../api`, sondaki / yok).
 * Prod: özellikle yapılandırma yoksa veya pazarlama ana bilgisayarı → RELEASE_PLACES_API_FALLBACK_ROOT.
 */
export function getPlacesSearchApiRoot(): string {
  const defaultRoot = `${getBackendBaseUrl()}/api`.replace(/\/+$/, '');
  const isRelease = typeof __DEV__ !== 'undefined' && __DEV__ === false;

  if (!isRelease) {
    return defaultRoot;
  }

  if (!hasExplicitBackendUrlConfig()) {
    return RELEASE_PLACES_API_FALLBACK_ROOT.replace(/\/+$/, '');
  }

  try {
    const u = new URL(defaultRoot.includes('://') ? defaultRoot : `https://${defaultRoot}`);
    if (isLeylekTagMarketingHostname(u.hostname)) {
      return RELEASE_PLACES_API_FALLBACK_ROOT.replace(/\/+$/, '');
    }
  } catch {
    return RELEASE_PLACES_API_FALLBACK_ROOT.replace(/\/+$/, '');
  }

  return defaultRoot;
}

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
