/**
 * Android FCM registration token — expo-notifications getDevicePushTokenAsync (native FCM).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from './backendConfig';

let lastRegisteredFcm: { userId: string; token: string } | null = null;

export async function fetchAndroidFcmToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  console.log('FCM_TOKEN_FETCH_START');
  try {
    const res = await Notifications.getDevicePushTokenAsync();
    const data = res?.data;
    if (typeof data === 'string' && data.length > 0) {
      console.log('FCM_TOKEN_FETCH_SUCCESS');
      return data;
    }
    console.log('FCM_TOKEN_FETCH_ERROR', { reason: 'empty_device_token' });
  } catch (e) {
    console.log('FCM_TOKEN_FETCH_ERROR', { message: String(e) });
  }
  return null;
}

/**
 * Backend POST …/user/save-push-token with token_type=fcm.
 * prefetchedToken: zincirde zaten alınmış token (çift getDevicePushToken önlemi).
 */
export async function registerFcmTokenWithBackend(
  userId: string,
  prefetchedToken?: string | null
): Promise<boolean> {
  if (!userId || Platform.OS !== 'android') return false;

  const token =
    typeof prefetchedToken === 'string' && prefetchedToken.length > 0
      ? prefetchedToken
      : await fetchAndroidFcmToken();
  if (!token) return false;

  if (lastRegisteredFcm?.userId === userId && lastRegisteredFcm?.token === token) {
    return true;
  }

  console.log('PUSH_TOKEN_REGISTER_START', { transport: 'fcm' });
  const endpoint = `${API_BASE_URL}/user/save-push-token`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        push_token: token,
        platform: 'android',
        token_type: 'fcm',
      }),
    });
    const raw = await response.text().catch(() => '');
    let body: { success?: boolean; detail?: string; message?: string } = {};
    try {
      body = (raw ? JSON.parse(raw) : {}) as typeof body;
    } catch {
      body = {};
    }
    const ok = !!(response.ok && body.success);
    if (!ok) {
      console.log('PUSH_TOKEN_REGISTER_ERROR', {
        transport: 'fcm',
        httpStatus: response.status,
        bodyPreview: raw.slice(0, 240),
      });
      return false;
    }
    lastRegisteredFcm = { userId, token };
    console.log('PUSH_TOKEN_REGISTER_SUCCESS', { transport: 'fcm' });
    return true;
  } catch (e) {
    console.log('PUSH_TOKEN_REGISTER_ERROR', { transport: 'fcm', message: String(e) });
    return false;
  }
}
