import AsyncStorage from '@react-native-async-storage/async-storage';

/** saveUser → setPersistedUserJson → persistAccessToken hepsi bu anahtarı kullanır */
export const USER_JSON_STORAGE_KEY = 'user';
const LEGACY_USER_KEY = 'leylek_user';

/** persistAccessToken (!raw dalı) + getPersistedAccessToken doğrudan okuma — user JSON ile aynı yaşam döngüsü */
export const ACCESS_TOKEN_STORAGE_KEY = 'access_token';

export async function getPersistedUserRaw(): Promise<string | null> {
  const primary = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
  if (primary) return primary;
  return AsyncStorage.getItem(LEGACY_USER_KEY);
}

export async function setPersistedUserJson(json: string): Promise<void> {
  await AsyncStorage.setItem(USER_JSON_STORAGE_KEY, json);
  await AsyncStorage.setItem(LEGACY_USER_KEY, json);
}

export async function clearSessionStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    USER_JSON_STORAGE_KEY,
    LEGACY_USER_KEY,
    'leylek_token',
    'leylek_role',
    ACCESS_TOKEN_STORAGE_KEY,
  ]);
}

/** Backend bazen Supabase Auth JWT çifti döner (Storage / realtime için). */
export type TokenPayload = {
  access_token?: string;
  accessToken?: string;
  token?: string;
  supabase_access_token?: string;
  supabase_refresh_token?: string;
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
  user?: unknown;
  supabase?: unknown;
  email?: string;
  password?: string;
  supabase_password?: string;
};

/** API yanıtlarında access_token | accessToken | token alanlarından JWT çıkarır */
export function extractAccessTokenFromPayload(payload: TokenPayload): string {
  const t = (payload.access_token ?? payload.accessToken ?? payload.token ?? '').trim();
  return typeof t === 'string' ? t : '';
}

export async function persistAccessToken(payload: TokenPayload): Promise<void> {
  const token = extractAccessTokenFromPayload(payload);
  const raw = await getPersistedUserRaw();
  if (!raw) {
    if (token) await AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    try {
      const u = JSON.parse(raw) as Record<string, unknown>;
      if (token) {
        u.access_token = token;
        u.accessToken = token;
      }
      await setPersistedUserJson(JSON.stringify(u));
    } catch {
      if (token) await AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    }
  }

  const readBack = await readPersistedAccessTokenQuiet();
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const storedLen = (await AsyncStorage.getItem(USER_JSON_STORAGE_KEY))?.length ?? 0;
    console.log('[session_token] persist summary', {
      extractedLen: token ? token.length : 0,
      readBackOk: !!readBack,
      storedUserJsonLen: storedLen,
    });
  }
  if (token && !readBack && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[session_token] mismatch after persist — token write/read inconsistent');
  }
}

/**
 * Okuma: önce düz `access_token`, sonra yalnızca `user` anahtarındaki JSON.
 * JWT konsola yazılmaz.
 */
async function readPersistedAccessTokenQuiet(): Promise<string | null> {
  const flat = await AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  const ft = flat?.trim();
  if (ft) return ft;

  const rawUser = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as Record<string, unknown>;
    const t = parsed.access_token || parsed.accessToken;
    const str = typeof t === 'string' ? t.trim() : '';
    return str || null;
  } catch {
    return null;
  }
}

/** Socket `register` ve korumalı istekler için — önce düz key, sonra kullanıcı JSON. */
export async function getPersistedAccessToken(): Promise<string | null> {
  return readPersistedAccessTokenQuiet();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls persisted storage for JWT (AsyncStorage flush / saveUser ordering).
 * Up to 20 attempts, 250ms between attempts after a miss.
 */
export async function waitForPersistedAccessToken(): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const t = await readPersistedAccessTokenQuiet();
    if (t) return t;
    if (attempt < 19) await sleep(250);
  }
  return null;
}
