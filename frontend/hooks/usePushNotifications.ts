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
import { Platform, PermissionsAndroid, InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../lib/backendConfig';

const API_URL = API_BASE_URL;

function deferToNextFrame(fn: () => void) {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(fn, 0);
  });
}

export interface PushNotificationHook {
  pushToken: string | null;
  tokenType: 'expo' | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => void;
  registerPushToken: (userId: string, onComplete?: (success: boolean) => void) => void;
  removePushToken: (userId: string) => Promise<void>;
}

const PushNotificationsContext = createContext<PushNotificationHook | null>(null);

export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = usePushNotificationsState();
  return React.createElement(PushNotificationsContext.Provider, { value }, children);
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

/** Promise dönmez; await yok; hatalar swallow; onToken(null | string) */
function runRegisterForPushNotificationsChain(
  setPushToken: (t: string | null) => void,
  setTokenType: (t: 'expo' | null) => void,
  onToken: (token: string | null) => void
): void {
  if (!Device.isDevice) {
    onToken(null);
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

  const fail = () => {
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
              return Promise.reject();
            }
          }
        );
      }
      return Promise.resolve();
    })
    .then(() =>
      Notifications.getPermissionsAsync().then(({ status }) => {
        if (status === 'granted') return Promise.resolve();
        return Notifications.requestPermissionsAsync().then(({ status: next }) => {
          if (next !== 'granted') return Promise.reject();
        });
      })
    )
    .then(() => {
      if (!projectId) return Promise.reject();
      return Notifications.getExpoPushTokenAsync({ projectId });
    })
    .then((expoToken) => {
      const token = expoToken?.data;
      if (token) {
        setPushToken(token);
        setTokenType('expo');
        onToken(token);
      } else {
        fail();
      }
    })
    .catch(() => {
      fail();
    });
}

function usePushNotificationsState(): PushNotificationHook {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'expo' | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  const acquireTokenNonBlocking = useCallback((onToken: (token: string | null) => void) => {
    runRegisterForPushNotificationsChain(setPushToken, setTokenType, onToken);
  }, []);

  const registerForPushNotifications = useCallback(() => {
    deferToNextFrame(() => {
      acquireTokenNonBlocking(() => {});
    });
  }, [acquireTokenNonBlocking]);

  const registerPushTokenWork = useCallback(
    (userId: string, onComplete?: (success: boolean) => void) => {
      if (!userId) {
        onComplete?.(false);
        return;
      }
      acquireTokenNonBlocking((token) => {
        if (!token) {
          onComplete?.(false);
          return;
        }
        fetch(`${API_URL}/user/register-push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            push_token: token,
            platform: Platform.OS,
          }),
        })
          .then((response) => response.json().catch(() => ({})))
          .then((data: { success?: boolean; detail?: string; message?: string }) => {
            if (!data.success) {
              console.warn('[PUSH] register-push-token başarısız:', data.detail || data.message || data);
            }
            onComplete?.(!!data.success);
          })
          .catch(() => {
            onComplete?.(false);
          });
      });
    },
    [acquireTokenNonBlocking]
  );

  const registerPushToken = useCallback(
    (userId: string, onComplete?: (success: boolean) => void) => {
      if (!userId) {
        onComplete?.(false);
        return;
      }
      deferToNextFrame(() => {
        registerPushTokenWork(userId, onComplete);
      });
    },
    [registerPushTokenWork]
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
  };
}

export default usePushNotifications;
