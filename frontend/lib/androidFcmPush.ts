/**
 * Android FCM registration token — Expo push ile paralel (faz-1).
 * expo-notifications getDevicePushTokenAsync → native FCM token (ek RN Firebase modülü yok).
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
      console.log('FCM_TOKEN_FETCH_SUCCESS', { tokenPrefix: `${data.slice(0, 14)}…` });
      return data;
    }
    console.log('FCM_TOKEN_FETCH_ERROR', { reason: 'empty_device_token' });
  } catch (e) {
    console.log('FCM_TOKEN_FETCH_ERROR', { message: String(e) });
  }
  return null;
}

/**
 * Backend POST /api/user/save-push-token token_type=fcm.
 * Aynı userId+token tekrarını göndermez (sonsuz loop önlemi).
 */
export async function registerFcmTokenWithBackend(userId: string): Promise<boolean> {
  if (!userId || Platform.OS !== 'android') return false;

  const token = await fetchAndroidFcmToken();
  if (!token) return false;

  if (lastRegisteredFcm?.userId === userId && lastRegisteredFcm?.token === token) {
    return true;
  }
  if (lastRegisteredFcm?.userId === userId && lastRegisteredFcm?.token !== token) {
    console.log('FCM_TOKEN_REFRESH', {
      oldPrefix: `${lastRegisteredFcm.token.slice(0, 14)}…`,
      newPrefix: `${token.slice(0, 14)}…`,
    });
  }

  console.log('PUSH_TOKEN_REGISTER_START', { transport: 'fcm', userId: `${userId.slice(0, 8)}…` });
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
    console.log('PUSH_TRANSPORT_SELECTED', { registered: 'fcm_parallel' });
    return true;
  } catch (e) {
    console.log('PUSH_TOKEN_REGISTER_ERROR', { transport: 'fcm', message: String(e) });
    return false;
  }
}
