/**
 * Native Firebase FCM registration token (iOS + Android) via @react-native-firebase/messaging.
 */
import { Platform } from 'react-native';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

export const FCM_SAVE_PUSH_TOKEN_ENDPOINT = `${API_BASE_URL}/user/save-push-token`;

let lastRegisteredFcm: { userId: string; token: string } | null = null;

export type FcmPushPlatform = 'ios' | 'android';

export function fcmPushPlatform(): FcmPushPlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

async function getMessagingModule() {
  return (await import('@react-native-firebase/messaging')).default;
}

/**
 * Firebase FCM registration token (not APNs device token, not Expo push token).
 */
export async function fetchNativeFcmToken(): Promise<string | null> {
  const platform = fcmPushPlatform();
  if (!platform) return null;

  console.log('FCM_TOKEN_FETCH_START', { source: 'firebase_messaging', platform });
  try {
    const messaging = await getMessagingModule();
    if (platform === 'ios') {
      const registered = messaging().isDeviceRegisteredForRemoteMessages;
      if (!registered) {
        await messaging().registerDeviceForRemoteMessages();
      }
    }
    const token = await messaging().getToken();
    if (typeof token === 'string' && token.length > 0) {
      console.log('FCM_TOKEN_FETCH_SUCCESS', { source: 'firebase_messaging', platform });
      return token;
    }
    console.log('FCM_TOKEN_FETCH_ERROR', { source: 'firebase_messaging', reason: 'empty_token', platform });
  } catch (e) {
    console.log('FCM_TOKEN_FETCH_ERROR', {
      source: 'firebase_messaging',
      platform,
      message: String(e),
    });
  }

  if (platform === 'android') {
    try {
      const Notifications = await import('expo-notifications');
      const res = await Notifications.getDevicePushTokenAsync();
      const data = res?.data;
      if (typeof data === 'string' && data.length > 0) {
        console.log('FCM_TOKEN_FETCH_SUCCESS', { source: 'expo_device_token_fallback', platform });
        return data;
      }
    } catch (e) {
      console.log('FCM_TOKEN_FETCH_ERROR', {
        source: 'expo_device_token_fallback',
        platform,
        message: String(e),
      });
    }
  }

  return null;
}

/**
 * POST /api/user/save-push-token with token_type=fcm.
 */
export async function registerFcmTokenWithBackend(
  userId: string,
  prefetchedToken?: string | null
): Promise<boolean> {
  const platform = fcmPushPlatform();
  if (!userId || !platform) return false;

  const token =
    typeof prefetchedToken === 'string' && prefetchedToken.length > 0
      ? prefetchedToken
      : await fetchNativeFcmToken();
  if (!token) return false;

  if (lastRegisteredFcm?.userId === userId && lastRegisteredFcm?.token === token) {
    return true;
  }

  console.log('PUSH_TOKEN_REGISTER_START', { transport: 'fcm', platform });
  try {
    const response = await fetch(FCM_SAVE_PUSH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        push_token: token,
        platform,
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
        platform,
        httpStatus: response.status,
        bodyPreview: raw.slice(0, 240),
      });
      return false;
    }
    try {
      const bearer = (await getPersistedAccessToken())?.trim();
      if (bearer) {
        const r2 = await fetch(`${API_BASE_URL}/user/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({ token }),
        });
        if (!r2.ok) {
          const t2 = await r2.text().catch(() => '');
          console.log('PUSH_TOKEN_REGISTER_USER_PUSH_TOKENS', {
            httpStatus: r2.status,
            bodyPreview: t2.slice(0, 200),
          });
        }
      }
    } catch (e) {
      console.log('PUSH_TOKEN_REGISTER_USER_PUSH_TOKENS_ERR', { message: String(e) });
    }
    lastRegisteredFcm = { userId, token };
    console.log('PUSH_TOKEN_REGISTER_SUCCESS', { transport: 'fcm', platform });
    return true;
  } catch (e) {
    console.log('PUSH_TOKEN_REGISTER_ERROR', { transport: 'fcm', platform, message: String(e) });
    return false;
  }
}
