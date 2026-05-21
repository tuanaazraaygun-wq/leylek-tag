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
import {
  FCM_SAVE_PUSH_TOKEN_ENDPOINT,
  fetchNativeFcmToken,
  fcmPushPlatform,
  registerFcmTokenWithBackend,
} from '../lib/nativeFcmPush';
import { isTestFlightDiagnosticsEnabled } from '../lib/testFlightDebug';
import { setPushFcmDiagSnapshot } from '../lib/testFlightDiagSnapshot';
import { getPersistedAccessToken } from '../lib/sessionToken';

function isPushDiagTracingEnabled(): boolean {
  return (typeof __DEV__ !== 'undefined' && __DEV__) || isTestFlightDiagnosticsEnabled();
}

function reportFcmDiag(patch: {
  fcmTokenAcquired?: 'yes' | 'no' | 'unknown';
  fcmRegisterOk?: 'yes' | 'no' | 'unknown';
  fcmPlatform?: string;
  fcmEndpoint?: string;
}): void {
  if (!isTestFlightDiagnosticsEnabled()) return;
  setPushFcmDiagSnapshot({
    fcmEndpoint: FCM_SAVE_PUSH_TOKEN_ENDPOINT,
    fcmPlatform: fcmPushPlatform() ?? Platform.OS,
    ...patch,
  });
}

const API_URL = API_BASE_URL;

/** Bearer ile POST /api/register-push-token — Expo push token */
async function postRegisterExpoPushTokenCore(expoToken: string): Promise<boolean> {
  const bearer = (await getPersistedAccessToken())?.trim();
  if (!bearer) return false;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'android';
  try {
    const response = await fetch(`${API_URL}/register-push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ token: expoToken, platform }),
    });
    const raw = await response.text().catch(() => '');
    let body: { success?: boolean; detail?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
    const ok = !!(response.ok && body.success === true);
    if (ok) {
      console.log('[push_token_registered]', JSON.stringify({ platform, transport: 'expo' }));
    }
    return ok;
  } catch {
    return false;
  }
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
  fcmTokenAcquired: 'yes' | 'no' | 'unknown';
  fcmRegisterOk: 'yes' | 'no' | 'unknown';
  fcmPlatform: string;
  fcmEndpoint: string;
  lastUpdatedAt: number | null;
};

export interface PushNotificationHook {
  pushToken: string | null;
  tokenType: 'expo' | 'fcm' | null;
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
    `fcmTokenAcquired: ${d.fcmTokenAcquired}`,
    `fcmRegisterOk: ${d.fcmRegisterOk}`,
    `fcmPlatform: ${d.fcmPlatform}`,
    `fcmEndpoint: ${d.fcmEndpoint}`,
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
    isPushRegisterDebugOverlayEnabled()
      ? React.createElement(
          React.Fragment,
          null,
          children,
          React.createElement(PushRegisterDebugOverlayView, { value }),
        )
      : React.createElement(React.Fragment, null, children),
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

type RegisterChainOpts = {
  /** FCM aktif veya kayıt başarılı — Expo token alma atlanır */
  skipExpoFallback?: () => boolean;
  /** Native FCM token alındı (backend kaydı öncesi Expo’yu kilitle) */
  onFcmTokenAcquired?: () => void;
};

/** Promise dönmez; token adımı async; onToken(token|null, kind?) */
function runRegisterForPushNotificationsChain(
  setPushToken: (t: string | null) => void,
  setTokenType: (t: 'expo' | 'fcm' | null) => void,
  onToken: (token: string | null, kind?: 'expo' | 'fcm') => void,
  mergeDebug?: MergeDbg,
  chainOpts?: RegisterChainOpts
): void {
  mergeDebug?.({ chainFailReason: null });
  if (!Device.isDevice) {
    mergeDebug?.({ tokenAcquired: false, chainFailReason: 'not_physical_device' });
    onToken(null);
    return;
  }

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
            if (postResult !== PermissionsAndroid.RESULTS.GRANTED) {
              return Promise.reject(new Error('POST_NOTIFICATIONS denied'));
            }
          }
        );
      }
      return Promise.resolve();
    })
    .then(() => Notifications.requestPermissionsAsync())
    .then((perm) => {
      if (perm.status !== 'granted') {
        console.warn('[PUSH] Bildirim izni verilmedi:', perm.status);
        return Promise.reject(new Error('notification permission denied'));
      }
    })
    .then(async () => {
      const fcmPlatform = fcmPushPlatform() ?? Platform.OS;
      mergeDebug?.({
        fcmPlatform,
        fcmEndpoint: FCM_SAVE_PUSH_TOKEN_ENDPOINT,
        fcmTokenAcquired: 'no',
        fcmRegisterOk: 'unknown',
      });
      reportFcmDiag({ fcmTokenAcquired: 'no', fcmRegisterOk: 'unknown' });

      try {
        const fcmToken = await fetchNativeFcmToken();
        if (typeof fcmToken === 'string' && fcmToken.length > 0) {
          chainOpts?.onFcmTokenAcquired?.();
          setPushToken(fcmToken);
          setTokenType('fcm');
          mergeDebug?.({
            tokenAcquired: true,
            fcmTokenAcquired: 'yes',
            chainFailReason: null,
          });
          reportFcmDiag({ fcmTokenAcquired: 'yes' });
          onToken(fcmToken, 'fcm');
          return;
        }
      } catch (fcmErr) {
        console.warn('[PUSH] Native FCM token alınamadı:', fcmErr);
        mergeDebug?.({ chainFailReason: `fcm_err:${String(fcmErr)}` });
      }

      mergeDebug?.({ fcmTokenAcquired: 'no' });
      reportFcmDiag({ fcmTokenAcquired: 'no' });

      if (chainOpts?.skipExpoFallback?.()) {
        mergeDebug?.({ tokenAcquired: false, chainFailReason: 'expo_skipped_fcm_active' });
        onToken(null);
        return;
      }

      const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
      const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;

      if (projectId && typeof projectId === 'string') {
        try {
          const res = await Notifications.getExpoPushTokenAsync({ projectId });
          const token = res?.data;
          if (typeof token === 'string' && token.length > 0) {
            setPushToken(token);
            setTokenType('expo');
            mergeDebug?.({ tokenAcquired: true, chainFailReason: null });
            onToken(token, 'expo');
            return;
          }
        } catch (expoErr) {
          console.warn('[PUSH] Expo push token alınamadı:', expoErr);
          mergeDebug?.({ chainFailReason: `expo_err:${String(expoErr)}` });
        }
      } else {
        mergeDebug?.({ chainFailReason: 'missing_expo_project_id' });
        console.warn('[PUSH] extra.eas.projectId yok — app.json / EAS projectId gerekli');
      }

      mergeDebug?.({ tokenAcquired: false, chainFailReason: 'no_push_token' });
      onToken(null);
    })
    .catch((e) => {
      console.warn('[PUSH] Token zinciri başarısız:', e);
      const msg = e instanceof Error ? e.message : String(e);
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
  fcmTokenAcquired: 'unknown',
  fcmRegisterOk: 'unknown',
  fcmPlatform: Platform.OS,
  fcmEndpoint: FCM_SAVE_PUSH_TOKEN_ENDPOINT,
  lastUpdatedAt: null,
});

function usePushNotificationsState(): PushNotificationHook {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'expo' | 'fcm' | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [pushRegisterDebug, setPushRegisterDebug] = useState<PushRegisterDebugSnapshot>(initialPushRegisterDebug);

  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const pushTokenSubscriptionRef = useRef<Notifications.Subscription | undefined>(undefined);
  const pendingUserIdForPushRef = useRef<string | null>(null);
  const lastRegisteredPushRef = useRef<{ userId: string; token: string } | null>(null);
  const lastFcmRegisterSuccessRef = useRef(false);
  /** FCM token alındı / kayıt başarılı — Expo fallback ve listener kaydı engeli */
  const fcmSkipExpoRef = useRef(false);
  const pushRegisterInFlightRef = useRef(false);

  const mergePushRegisterDebug = useCallback((patch: Partial<PushRegisterDebugSnapshot>) => {
    if (!isPushDiagTracingEnabled()) return;
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
      if (!isPushDiagTracingEnabled()) return;
      mergePushRegisterDebug({
        screen: p.screen,
        userId: p.userId,
        showSplash: p.showSplash,
      });
    },
    [mergePushRegisterDebug]
  );

  const acquireTokenNonBlocking = useCallback(
    (onToken: (token: string | null, kind?: 'expo' | 'fcm') => void) => {
      runRegisterForPushNotificationsChain(
        setPushToken,
        setTokenType,
        onToken,
        mergePushRegisterDebug,
        {
          skipExpoFallback: () =>
            fcmSkipExpoRef.current || lastFcmRegisterSuccessRef.current,
          onFcmTokenAcquired: () => {
            fcmSkipExpoRef.current = true;
          },
        }
      );
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
      if (!userId) {
        mergePushRegisterDebug({
          lastTrigger: debugTrigger ?? '—',
          fetchFailReason: 'empty_user_id_work',
          tokenAcquired: false,
        });
        onComplete?.(false);
        return;
      }
      if (pushRegisterInFlightRef.current) {
        onComplete?.(lastFcmRegisterSuccessRef.current);
        return;
      }
      pushRegisterInFlightRef.current = true;
      const finish = (ok: boolean) => {
        pushRegisterInFlightRef.current = false;
        onComplete?.(ok);
      };

      pendingUserIdForPushRef.current = userId;
      acquireTokenNonBlocking((token, kind) => {
        if (!token || !kind) {
          mergePushRegisterDebug({
            tokenAcquired: false,
            fetchStarted: false,
            fetchDone: false,
            fetchSuccess: null,
            fetchFailReason: 'no_device_token',
          });
          console.warn('PUSH_TOKEN_SAVE_FAIL', { userId, reason: 'no_device_token' });
          finish(false);
          return;
        }

        if (kind === 'fcm') {
          fcmSkipExpoRef.current = true;
          if (lastRegisteredPushRef.current?.userId === userId && lastRegisteredPushRef.current?.token === token) {
            mergePushRegisterDebug({
              tokenAcquired: true,
              fcmTokenAcquired: 'yes',
              fetchStarted: true,
              fetchDone: true,
              fetchSuccess: true,
              fcmRegisterOk: 'yes',
              fetchFailReason: null,
            });
            reportFcmDiag({ fcmTokenAcquired: 'yes', fcmRegisterOk: 'yes' });
            lastFcmRegisterSuccessRef.current = true;
            fcmSkipExpoRef.current = true;
            finish(true);
            return;
          }
          mergePushRegisterDebug({
            tokenAcquired: true,
            fcmTokenAcquired: 'yes',
            fetchStarted: true,
            fetchDone: false,
            fetchSuccess: null,
            fcmRegisterOk: 'unknown',
            fetchFailReason: null,
          });
          reportFcmDiag({ fcmTokenAcquired: 'yes', fcmRegisterOk: 'unknown' });
          void registerFcmTokenWithBackend(userId, token)
            .then((success) => {
              if (success) {
                lastRegisteredPushRef.current = { userId, token };
                lastFcmRegisterSuccessRef.current = true;
                fcmSkipExpoRef.current = true;
              } else {
                lastFcmRegisterSuccessRef.current = false;
                fcmSkipExpoRef.current = false;
              }
              mergePushRegisterDebug({
                fetchDone: true,
                fetchSuccess: success,
                fcmRegisterOk: success ? 'yes' : 'no',
                fetchFailReason: success ? null : 'fcm_register_failed',
              });
              reportFcmDiag({
                fcmTokenAcquired: 'yes',
                fcmRegisterOk: success ? 'yes' : 'no',
              });
              finish(success);
            })
            .catch((err) => {
              lastFcmRegisterSuccessRef.current = false;
              fcmSkipExpoRef.current = false;
              mergePushRegisterDebug({
                fetchDone: true,
                fetchSuccess: false,
                fcmRegisterOk: 'no',
                fetchFailReason: `network:${String(err)}`,
              });
              reportFcmDiag({ fcmTokenAcquired: 'yes', fcmRegisterOk: 'no' });
              console.log('PUSH_TOKEN_REGISTER_ERROR', { transport: 'fcm', message: String(err) });
              finish(false);
            });
          return;
        }

        if (kind === 'expo') {
          if (fcmSkipExpoRef.current || lastFcmRegisterSuccessRef.current) {
            mergePushRegisterDebug({
              fetchDone: true,
              fetchSuccess: true,
              fetchFailReason: null,
            });
            finish(true);
            return;
          }
          if (lastRegisteredPushRef.current?.userId === userId && lastRegisteredPushRef.current?.token === token) {
            mergePushRegisterDebug({
              tokenAcquired: true,
              fetchStarted: true,
              fetchDone: true,
              fetchSuccess: true,
              fetchFailReason: null,
            });
            finish(true);
            return;
          }
          mergePushRegisterDebug({
            tokenAcquired: true,
            fetchStarted: true,
            fetchDone: false,
            fetchSuccess: null,
            fetchFailReason: null,
          });
          void postRegisterExpoPushTokenCore(token)
            .then((success) => {
              if (success) {
                lastRegisteredPushRef.current = { userId, token };
              }
              mergePushRegisterDebug({
                fetchDone: true,
                fetchSuccess: success,
                fetchFailReason: success ? null : 'expo_register_failed',
              });
              finish(success);
            })
            .catch((err) => {
              mergePushRegisterDebug({
                fetchDone: true,
                fetchSuccess: false,
                fetchFailReason: `network:${String(err)}`,
              });
              console.log('PUSH_TOKEN_REGISTER_ERROR', { transport: 'expo', message: String(err) });
              finish(false);
            });
          return;
        }

        finish(false);
      });
    },
    [acquireTokenNonBlocking, mergePushRegisterDebug]
  );

  const registerPushToken = useCallback(
    (userId: string, onComplete?: (success: boolean) => void, debugTrigger?: string) => {
      if (!userId) {
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
      pendingUserIdForPushRef.current = userId;

      if (
        lastFcmRegisterSuccessRef.current &&
        lastRegisteredPushRef.current?.userId === userId
      ) {
        mergePushRegisterDebug({
          registerTriggered: true,
          registerTriggeredAt: Date.now(),
          lastTrigger: debugTrigger ?? '—',
          fetchDone: true,
          fetchSuccess: true,
          fcmRegisterOk: 'yes',
        });
        onComplete?.(true);
        return;
      }

      const userChanged = lastRegisteredPushRef.current?.userId !== userId;
      if (userChanged) {
        lastFcmRegisterSuccessRef.current = false;
        fcmSkipExpoRef.current = false;
      }

      mergePushRegisterDebug({
        registerTriggered: true,
        registerTriggeredAt: Date.now(),
        lastTrigger: debugTrigger ?? '—',
        tokenAcquired: null,
        fcmTokenAcquired: 'unknown',
        fcmRegisterOk: 'unknown',
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
    pendingUserIdForPushRef.current = null;
    lastRegisteredPushRef.current = null;
    lastFcmRegisterSuccessRef.current = false;
    fcmSkipExpoRef.current = false;
    try {
      const bearer = (await getPersistedAccessToken())?.trim();
      await fetch(`${API_URL}/user/remove-push-token?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
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

    try {
      pushTokenSubscriptionRef.current = Notifications.addPushTokenListener((ev) => {
        const token = typeof (ev as { data?: string })?.data === 'string' ? (ev as { data: string }).data : '';
        const uid = pendingUserIdForPushRef.current;
        if (!token || !uid) return;
        if (fcmSkipExpoRef.current || lastFcmRegisterSuccessRef.current) return;
        if (lastRegisteredPushRef.current?.userId === uid && lastRegisteredPushRef.current?.token === token) {
          return;
        }
        void postRegisterExpoPushTokenCore(token).then((ok) => {
          if (ok) {
            lastRegisteredPushRef.current = { userId: uid, token };
          }
        });
      });
    } catch {
      pushTokenSubscriptionRef.current = undefined;
    }

    let fcmRefreshUnsub: (() => void) | undefined;
    if (fcmPushPlatform()) {
      void import('@react-native-firebase/messaging')
        .then(({ default: messaging }) => {
          fcmRefreshUnsub = messaging().onTokenRefresh((refreshed) => {
            const uid = pendingUserIdForPushRef.current;
            if (!refreshed || !uid) return;
            void registerFcmTokenWithBackend(uid, refreshed).then((ok) => {
              if (ok) {
                lastRegisteredPushRef.current = { userId: uid, token: refreshed };
                lastFcmRegisterSuccessRef.current = true;
                fcmSkipExpoRef.current = true;
                setPushToken(refreshed);
                setTokenType('fcm');
                reportFcmDiag({ fcmTokenAcquired: 'yes', fcmRegisterOk: 'yes' });
              }
            });
          });
        })
        .catch(() => {});
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      pushTokenSubscriptionRef.current?.remove();
      pushTokenSubscriptionRef.current = undefined;
      fcmRefreshUnsub?.();
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
