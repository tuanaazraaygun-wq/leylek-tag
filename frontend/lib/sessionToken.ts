import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'user';
const LEGACY_USER_KEY = 'leylek_user';

export async function getPersistedUserRaw(): Promise<string | null> {
  const primary = await AsyncStorage.getItem(USER_KEY);
  if (primary) return primary;
  return AsyncStorage.getItem(LEGACY_USER_KEY);
}

export async function setPersistedUserJson(json: string): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, json);
  await AsyncStorage.setItem(LEGACY_USER_KEY, json);
}

export async function clearSessionStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    USER_KEY,
    LEGACY_USER_KEY,
    'leylek_token',
    'leylek_role',
    'access_token',
  ]);
}

type TokenPayload = { access_token?: string; accessToken?: string };

export async function persistAccessToken(payload: TokenPayload): Promise<void> {
  const token = (payload.access_token ?? payload.accessToken)?.trim();
  const raw = await getPersistedUserRaw();
  if (!raw) {
    if (token) await AsyncStorage.setItem('access_token', token);
    return;
  }
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    if (token) {
      u.access_token = token;
      u.accessToken = token;
    }
    await setPersistedUserJson(JSON.stringify(u));
  } catch {
    if (token) await AsyncStorage.setItem('access_token', token);
  }
}
