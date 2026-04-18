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

export type TokenPayload = { access_token?: string; accessToken?: string; token?: string };

/** API yanıtlarında access_token | accessToken | token alanlarından JWT çıkarır */
export function extractAccessTokenFromPayload(payload: TokenPayload): string {
  const t = (payload.access_token ?? payload.accessToken ?? payload.token ?? '').trim();
  return typeof t === 'string' ? t : '';
}

export async function persistAccessToken(payload: TokenPayload): Promise<void> {
  console.log('PERSIST_INPUT_PAYLOAD', payload);
  const token = extractAccessTokenFromPayload(payload);
  console.log('EXTRACTED_TOKEN', token ? token.length : null);
  const raw = await getPersistedUserRaw();
  if (!raw) {
    if (token) await AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    const flatCheck = await AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    console.log('FLAT_KEY_AFTER_WRITE', flatCheck ? flatCheck.length : null);
    const userCheck = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
    console.log('USER_JSON_AFTER_WRITE', userCheck);
  } else {
    try {
      const u = JSON.parse(raw) as Record<string, unknown>;
      if (token) {
        u.access_token = token;
        u.accessToken = token;
      }
      await setPersistedUserJson(JSON.stringify(u));
      const flatCheck = await AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
      console.log('FLAT_KEY_AFTER_WRITE', flatCheck ? flatCheck.length : null);
      const userCheck = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
      console.log('USER_JSON_AFTER_WRITE', userCheck);
    } catch {
      if (token) await AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
      const flatCheck = await AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
      console.log('FLAT_KEY_AFTER_WRITE', flatCheck ? flatCheck.length : null);
      const userCheck = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
      console.log('USER_JSON_AFTER_WRITE', userCheck);
    }
  }

  const storedUserRaw = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
  console.log('PERSIST_ACCESS_TOKEN_WRITE', {
    keyUsed: USER_JSON_STORAGE_KEY,
    storedUserRaw,
  });

  const readBack = await readPersistedAccessTokenQuiet();
  console.log('PERSIST_ACCESS_TOKEN_READBACK', {
    hasToken: !!readBack,
    length: readBack?.length ?? 0,
  });
  if (token && !readBack) {
    console.log('TOKEN_STORAGE_MISMATCH', {
      reason: 'payload_had_token_but_readBack_empty',
      payloadTokenLen: token.length,
      storedUserRawLen: storedUserRaw?.length ?? 0,
    });
  }

  const flatSnap = await AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  let userAfterWriteHasToken = false;
  try {
    const rawSnap = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
    if (rawSnap) {
      const parsed = JSON.parse(rawSnap) as Record<string, unknown>;
      userAfterWriteHasToken = !!(parsed.access_token || parsed.accessToken);
    }
  } catch {
    userAfterWriteHasToken = false;
  }
  console.log('TOKEN_FLOW_SUMMARY', {
    extracted: token ? token.length : null,
    flatAfterWrite: flatSnap ? 'present' : 'null',
    userAfterWriteHasToken,
  });
}

/**
 * Okuma: önce düz `access_token`, sonra yalnızca `user` anahtarındaki JSON.
 * waitFor / persist readback için (loglu — kök neden teşhisi).
 */
async function readPersistedAccessTokenQuiet(): Promise<string | null> {
  let token: string | null = null;
  let summaryFlat = false;
  let tokenFromUser = false;

  console.log('READ_FLAT_ATTEMPT');
  const flat = await AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  summaryFlat = !!(flat && flat.trim());
  if (summaryFlat) {
    token = flat!.trim();
    console.log('TOKEN_FROM_FLAT_KEY', token.length);
    console.log('TOKEN_READ_SUMMARY', { flat: summaryFlat, user: tokenFromUser });
    console.log('FINAL_TOKEN_RESULT', !!token);
    return token;
  }

  console.log('READ_USER_ATTEMPT');
  const rawUser = await AsyncStorage.getItem(USER_JSON_STORAGE_KEY);
  console.log('READ_TOKEN_RAW_USER', rawUser);
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as Record<string, unknown>;
      const t = parsed.access_token || parsed.accessToken;
      const str = typeof t === 'string' ? t.trim() : '';
      console.log('TOKEN_FROM_USER_JSON', str ? str.length : null);
      if (str) {
        tokenFromUser = true;
        token = str;
        console.log('TOKEN_READ_SUMMARY', { flat: summaryFlat, user: tokenFromUser });
        console.log('FINAL_TOKEN_RESULT', !!token);
        return str;
      }
    } catch (e) {
      console.log('READ_TOKEN_USER_JSON_PARSE_ERROR', String(e));
    }
  }

  console.log('TOKEN_READ_SUMMARY', { flat: summaryFlat, user: tokenFromUser });
  console.log('FINAL_TOKEN_RESULT', false);
  return null;
}

/** Socket `register` ve korumalı istekler için — önce düz key, sonra kullanıcı JSON. */
export async function getPersistedAccessToken(): Promise<string | null> {
  const t = await readPersistedAccessTokenQuiet();
  console.log('GET_TOKEN_RESULT', t ? { present: true, length: t.length } : { present: false });
  return t;
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
