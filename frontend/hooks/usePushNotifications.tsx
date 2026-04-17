/**
 * LeylekTag Push Notifications
 * Token alma tamamen .then zinciri; await yok; dışarı Promise dönülmez; hatalar yutulur.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from 'react';
import {
  Platform,
  PermissionsAndroid,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE_URL, BACKEND_BASE_URL, isPushRegisterDebugOverlayEnabled } from '../lib/backendConfig';

const API_URL = API_BASE_URL;

function pushDbgTokenPrefix(s: string | null | undefined): string {
  if (!s) return '';
  return s.length <= 30 ? s : `${s.slice(0, 28)}…`;
}

function deferToNextFrame(fn: () => void) {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(fn, 0);
  });
}

export type PushRegisterDebugSnapshot = {
  backendBaseUrl: string;
  apiBaseUrl: string;
  screen: string;
  userId: string | null;
  showSplash: boolean;
  lastTrigger: string | null;
  registerTriggered: boolean;
  registerTriggeredAt: number | null;
  tokenAcquired: boolean | null;
  fetchStarted: boolean;
  fetchDone: boolean;
  fetchSuccess: boolean | null;
  fetchFailReason: string | null;
  chainFailReason: string | null;
  lastUpdatedAt: number | null;
};

export interface PushNotificationHook {
  pushToken: string | null;
  tokenType: 'expo' | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => void;
  registerPushToken: (
    userId: string,
    onComplete?: (success: boolean) => void,
    debugTrigger?: string
  ) => void;
  removePushToken: (userId: string) => Promise<void>;
  pushRegisterDebug: PushRegisterDebugSnapshot;
  reportPushRegisterDebugSurface: (p: {
    screen: string;
    userId: string | null;
    showSplash: boolean;
  }) => void;
}

const PushNotificationsContext = createContext<PushNotificationHook | null>(null);

function PushRegisterDebugOverlayView({ value }: { value: PushNotificationHook }) {
  if (!isPushRegisterDebugOverlayEnabled()) return null;
  const d = value.pushRegisterDebug;
  const lines = [
    `BACKEND_BASE_URL: ${d.backendBaseUrl}`,
    `API_BASE_URL: ${d.apiBaseUrl}`,
    `user?.id: ${d.userId ?? 'null'}`,
    `showSplash: ${String(d.showSplash)}`,
    `screen: ${d.screen}`,
    `registerTriggered: ${String(d.registerTriggered)}`,
    `lastTrigger: ${d.lastTrigger ?? '—'}`,
    `registerTriggeredAt: ${d.registerTriggeredAt ?? '—'}`,
    `tokenAcquired: ${d.tokenAcquired === null ? '—' : String(d.tokenAcquired)}`,
    `fetchStarted: ${String(d.fetchStarted)}`,
    `fetchDone: ${String(d.fetchDone)}`,
    `fetchSuccess: ${d.fetchSuccess === null ? '—' : String(d.fetchSuccess)}`,
    `fetchFailReason: ${d.fetchFailReason ?? '—'}`,
    `chainFailReason: ${d.chainFailReason ?? '—'}`,
  ];
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { zIndex: 99999, elevation: 99999 }]}
      collapsable={false}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 44,
          right: 6,
          left: 6,
          maxHeight: '38%',
          backgroundColor: 'rgba(0,0,0,0.82)',
          borderRadius: 8,
          padding: 8,
          overflow: 'hidden',
        }}
      >
        <Text
          pointerEvents="none"
          style={{ color: '#93c5fd', fontSize: 10, fontWeight: '700', marginBottom: 4 }}
        >
          PUSH REGISTER (debug)
        </Text>
        {lines.map((line, i) => (
          <Text
            key={`pd-${i}`}
            pointerEvents="none"
            style={{
              color: '#e2e8f0',
              fontSize: 9,
              lineHeight: 13,
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = usePushNotificationsState();
  return React.createElement(
    PushNotificationsContext.Provider,
    { value },
    React.createElement(React.Fragment, null, children, React.createElement(PushRegisterDebugOverlayView, { value }))
  );
}

export function usePushNotifications(): PushNotificationHook {
  const ctx = useContext(PushNotificationsContext);
  if (!ctx) {
    throw new Error(
      'usePushNotifications: PushNotificationsProvider eksik — app/_layout.tsx içine ekleyin.'
    );
  }
  return ctx;
}

type MergeDbg = (patch: Partial<PushRegisterDebugSnapshot>) => void;

/** Promise dönmez; await yok; hatalar swallow; onToken(null | string) */
function runRegisterForPushNotificationsChain(
  setPushToken: (t: string | null) => void,
  setTokenType: (t: 'expo' | null) => void,
  onToken: (token: string | null) => void,
  mergeDebug?: MergeDbg
): void {
  console.log('[PUSH_DEBUG] chain enter', { isDevice: Device.isDevice });
  mergeDebug?.({ chainFailReason: null });
  if (!Device.isDevice) {
    console.log('[PUSH_DEBUG] chain abort: not physical device');
    mergeDebug?.({ tokenAcquired: false, chainFailReason: 'not_physical_device' });
    onToken(null);
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

  const androidApiLevel =
    Platform.OS === 'android'
      ? typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10)
      : NaN;
  console.log('[PUSH_DEBUG] chain context', {
    projectId: projectId ?? null,
    platform: Platform.OS,
    androidApiLevel: Platform.OS === 'android' ? (Number.isNaN(androidApiLevel) ? String(Platform.Version) : androidApiLevel) : null,
  });

  const chainFail = (reason: string) => {
    mergeDebug?.({ tokenAcquired: false, chainFailReason: reason });
    onToken(null);
  };

  const afterAndroidChannels =
    Platform.OS === 'android'
      ? Notifications.setNotificationChannelAsync('match', {
          name: 'Eslesme Bildirimleri',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400],
          lightColor: '#10B981',
          sound: 'default',
        })
          .then(() =>
            Notifications.setNotificationChannelAsync('calls', {
              name: 'Arama Bildirimleri',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 700, 300, 700],
              lightColor: '#EF4444',
              sound: 'default',
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            })
          )
          .then(() =>
            Notifications.setNotificationChannelAsync('admin', {
              name: 'Duyurular',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 150, 250],
              lightColor: '#3FA9F5',
              sound: 'default',
            })
          )
          .catch(() => {})
      : Promise.resolve();

  afterAndroidChannels
    .then(() => {
      if (Platform.OS !== 'android') return Promise.resolve();
      const api =
        typeof Platform.Version === 'number'
          ? Platform.Version
          : parseInt(String(Platform.Version), 10);
      if (!Number.isNaN(api) && api >= 33) {
        return PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').then(
          (postResult) => {
            console.log('[PUSH_DEBUG] POST_NOTIFICATIONS', { result: postResult });
            if (postResult !== PermissionsAndroid.RESULTS.GRANTED) {
              return Promise.reject(new Error('POST_NOTIFICATIONS denied'));
            }
          }
        );
      }
      console.log('[PUSH_DEBUG] POST_NOTIFICATIONS', { result: 'skipped', reason: 'api_lt_33_or_invalid', api });
      return Promise.resolve();
    })
    .then(() => Notifications.requestPermissionsAsync())
    .then((perm) => {
      console.log('[PUSH_DEBUG] requestPermissionsAsync', { status: perm.status });
      if (perm.status !== 'granted') {
        console.warn('[PUSH] Bildirim izni verilmedi:', perm.status);
        return Promise.reject(new Error('notification permission denied'));
      }
    })
    .then(() => {
      if (!projectId) {
        console.warn('[PUSH] EAS projectId yok — app.json extra.eas.projectId gerekli');
        return Promise.reject(new Error('missing projectId'));
      }
      console.log('[PUSH_DEBUG] getExpoPushTokenAsync calling');
      return Notifications.getExpoPushTokenAsync({ projectId });
    })
    .then((expoToken) => {
      const token = expoToken?.data;
      if (token) {
        setPushToken(token);
        setTokenType('expo');
        mergeDebug?.({ tokenAcquired: true, chainFailReason: null });
        console.log('[PUSH_DEBUG] getExpoPushTokenAsync ok', { tokenPrefix: pushDbgTokenPrefix(token) });
        console.log('PUSH_TOKEN_ACQUIRED', { tokenPrefix: `${token.slice(0, 36)}…` });
        console.log('[PUSH] Expo device token acquired', {
          tokenPrefix: `${token.slice(0, 36)}…`,
        });
        onToken(token);
      } else {
        console.log('[PUSH_DEBUG] getExpoPushTokenAsync empty data');
        console.warn('[PUSH] Expo push token alınamadı (getExpoPushTokenAsync boş data)');
        chainFail('empty_expo_token_data');
      }
    })
    .catch((e) => {
      console.warn('[PUSH] Token zinciri başarısız:', e);
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[PUSH_DEBUG] chain catch', { message: msg });
      chainFail(msg);
    });
}

const initialPushRegisterDebug = (): PushRegisterDebugSnapshot => ({
  backendBaseUrl: BACKEND_BASE_URL,
  apiBaseUrl: API_BASE_URL,
  screen: '—',
  userId: null,
  showSplash: true,
  lastTrigger: null,
  registerTriggered: false,
  registerTriggeredAt: null,
  tokenAcquired: null,
  fetchStarted: false,
  fetchDone: false,
  fetchSuccess: null,
  fetchFailReason: null,
  chainFailReason: null,
  lastUpdatedAt: null,
});

function usePushNotificationsState(): PushNotificationHook {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'expo' | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [pushRegisterDebug, setPushRegisterDebug] = useState<PushRegisterDebugSnapshot>(initialPushRegisterDebug);

  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  const mergePushRegisterDebug = useCallback((patch: Partial<PushRegisterDebugSnapshot>) => {
    setPushRegisterDebug((prev) => ({
      ...prev,
      ...patch,
      backendBaseUrl: BACKEND_BASE_URL,
      apiBaseUrl: API_BASE_URL,
      lastUpdatedAt: Date.now(),
    }));
  }, []);

  const reportPushRegisterDebugSurface = useCallback(
    (p: { screen: string; userId: string | null; showSplash: boolean }) => {
      mergePushRegisterDebug({
        screen: p.screen,
        userId: p.userId,
        showSplash: p.showSplash,
      });
    },
    [mergePushRegisterDebug]
  );

  const acquireTokenNonBlocking = useCallback(
    (onToken: (token: string | null) => void) => {
      runRegisterForPushNotificationsChain(setPushToken, setTokenType, onToken, mergePushRegisterDebug);
    },
    [mergePushRegisterDebug]
  );

  const registerForPushNotifications = useCallback(() => {
    deferToNextFrame(() => {
      acquireTokenNonBlocking(() => {});
    });
  }, [acquireTokenNonBlocking]);

  const registerPushTokenWork = useCallback(
    (userId: string, onComplete?: (success: boolean) => void, debugTrigger?: string) => {
      console.log('[PUSH_DEBUG] registerPushTokenWork enter', { userId });
      if (!userId) {
        console.log('[PUSH_DEBUG] registerPushTokenWork skip: empty userId');
        mergePushRegisterDebug({
          lastTrigger: debugTrigger ?? '—',
          fetchFailReason: 'empty_user_id_work',
          tokenAcquired: false,
        });
        onComplete?.(false);
        return;
      }
      acquireTokenNonBlocking((token) => {
        console.log('[PUSH_DEBUG] token callback', {
          userId,
          hasToken: !!token,
          tokenPrefix: pushDbgTokenPrefix(token),
        });
        if (!token) {
          console.log('[PUSH_DEBUG] skip fetch: no token (chain logs above)');
          mergePushRegisterDebug({
            tokenAcquired: false,
            fetchStarted: false,
            fetchDone: false,
            fetchSuccess: null,
            fetchFailReason: 'no_device_token',
          });
          console.warn('PUSH_TOKEN_SAVE_FAIL', { userId, reason: 'no_device_token' });
          console.warn('[PUSH] Token yok — backend’e gönderilmedi (userId=', userId, ')');
          onComplete?.(false);
          return;
        }
        const endpoint = `${API_URL}/user/save-push-token`;
        mergePushRegisterDebug({ tokenAcquired: true, fetchStarted: true, fetchDone: false, fetchSuccess: null, fetchFailReason: null });
        console.log('[PUSH_DEBUG] fetch start', {
          endpoint,
          user_id: userId,
          tokenPrefix: pushDbgTokenPrefix(token),
        });
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            push_token: token,
            platform: Platform.OS,
          }),
        })
          .then(async (response) => {
            const raw = await response.text().catch(() => '');
            let data: { success?: boolean; detail?: string; message?: string } = {};
            try {
              data = (raw ? JSON.parse(raw) : {}) as { success?: boolean; detail?: string; message?: string };
            } catch {
              data = {};
            }
            const success = !!(response.ok && data.success);
            console.log('[PUSH_DEBUG] fetch done', {
              httpStatus: response.status,
              success,
              bodyPreview: raw.slice(0, 400),
            });
            if (!response.ok || !data.success) {
              const reason = data.detail || data.message || String(response.status);
              mergePushRegisterDebug({
                fetchDone: true,
                fetchSuccess: false,
                fetchFailReason: reason,
              });
              console.warn('PUSH_TOKEN_SAVE_FAIL', {
                userId,
                reason,
                data,
              });
              console.warn('[PUSH] save-push-token başarısız:', reason, data);
              onComplete?.(false);
              return;
            }
            mergePushRegisterDebug({
              fetchDone: true,
              fetchSuccess: true,
              fetchFailReason: null,
            });
            console.log('PUSH_TOKEN_SAVE_OK', {
              userId,
              tokenPrefix: `${token.slice(0, 36)}…`,
            });
            console.log('[PUSH] save-push-token OK', {
              userId: userId,
              tokenPrefix: `${token.slice(0, 36)}…`,
            });
            onComplete?.(true);
          })
          .catch((err) => {
            console.log('[PUSH_DEBUG] fetch network error', { message: String(err) });
            mergePushRegisterDebug({
              fetchDone: true,
              fetchSuccess: false,
              fetchFailReason: `network:${String(err)}`,
            });
            console.warn('PUSH_TOKEN_SAVE_FAIL', { userId, reason: 'network', err });
            console.warn('[PUSH] save-push-token ağ hatası:', err);
            onComplete?.(false);
          });
      });
    },
    [acquireTokenNonBlocking, mergePushRegisterDebug]
  );

  const registerPushToken = useCallback(
    (userId: string, onComplete?: (success: boolean) => void, debugTrigger?: string) => {
      console.log('[PUSH_DEBUG] registerPushToken enter', { userId });
      if (!userId) {
        console.log('[PUSH_DEBUG] registerPushToken skip: empty userId');
        mergePushRegisterDebug({
          registerTriggered: true,
          registerTriggeredAt: Date.now(),
          lastTrigger: debugTrigger ?? '—',
          fetchFailReason: 'empty_user_id',
          tokenAcquired: false,
        });
        onComplete?.(false);
        return;
      }
      mergePushRegisterDebug({
        registerTriggered: true,
        registerTriggeredAt: Date.now(),
        lastTrigger: debugTrigger ?? '—',
        tokenAcquired: null,
        fetchStarted: false,
        fetchDone: false,
        fetchSuccess: null,
        fetchFailReason: null,
        chainFailReason: null,
      });
      deferToNextFrame(() => {
        registerPushTokenWork(userId, onComplete, debugTrigger);
      });
    },
    [registerPushTokenWork, mergePushRegisterDebug]
  );

  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      setPushToken(null);
      setTokenType(null);
    } catch {
      /* swallow */
    }
  }, []);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return {
    pushToken,
    tokenType,
    notification,
    registerForPushNotifications,
    registerPushToken,
    removePushToken,
    pushRegisterDebug,
    reportPushRegisterDebugSurface,
  };
}

export default usePushNotifications;
