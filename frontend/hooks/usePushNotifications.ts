/**
 * LeylekTag Push Notifications
 * Tek Expo push akışı; state `PushNotificationsProvider` ile kökte mount edilir (tüm route’lar).
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../lib/backendConfig';

/** Socket/REST ile aynı kök — APK’da extra boş kalsa bile EXPO_PUBLIC_BACKEND_URL devreye girer */
const API_URL = API_BASE_URL;

/** Foreground/background sunumu: tek tanım `app/_layout.tsx` içinde (index yüklenmeden önce de geçerli olsun). */

export interface PushNotificationHook {
  pushToken: string | null;
  tokenType: 'expo' | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<string | null>;
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
}

const PushNotificationsContext = createContext<PushNotificationHook | null>(null);

/** Kök layout’ta bir kez sarın; böylece `/` dışı açılışlarda da token alınır. */
export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = usePushNotificationsState();
  return React.createElement(
    PushNotificationsContext.Provider,
    { value },
    children
  );
}

/** Provider dışında kullanılırsa hata verir (yanlışlıkla çift mount önlenir). */
export function usePushNotifications(): PushNotificationHook {
  const ctx = useContext(PushNotificationsContext);
  if (!ctx) {
    throw new Error(
      'usePushNotifications: PushNotificationsProvider eksik — app/_layout.tsx içine ekleyin.'
    );
  }
  return ctx;
}

function usePushNotificationsState(): PushNotificationHook {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'expo' | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // Android: default + offers app/_layout.tsx içinde oluşturulur (duplicate yok)
  const setupNotificationChannels = async () => {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('match', {
      name: 'Eslesme Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#10B981',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Arama Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 300, 700],
      lightColor: '#EF4444',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('admin', {
      name: 'Duyurular',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#3FA9F5',
      sound: 'default',
    });
  };

  // Her çağrıda yeni Expo push token al (eski token kullanılmasın).
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('[PUSH] Simülatör - token alınamaz');
      return null;
    }

    try {
      // Android: default/offers _layout’ta; burada match, calls, admin
      await setupNotificationChannels();

      // Android 13+ (API 33): POST_NOTIFICATIONS — bazı cihazlarda yalnızca expo izin akışı yetmeyebilir.
      if (Platform.OS === 'android') {
        const api =
          typeof Platform.Version === 'number'
            ? Platform.Version
            : parseInt(String(Platform.Version), 10);
        if (!Number.isNaN(api) && api >= 33) {
          const postResult = await PermissionsAndroid.request(
            'android.permission.POST_NOTIFICATIONS'
          );
          if (postResult !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('[PUSH] POST_NOTIFICATIONS reddedildi:', postResult);
            return null;
          }
        }
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PUSH] İzin verilmedi');
        return null;
      }

      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ||
          Constants.easConfig?.projectId;

        if (!projectId) {
          console.log('[PUSH] EAS projectId bulunamadı');
          return null;
        }

        const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
        if (expoToken && expoToken.data) {
          const token = expoToken.data;
          console.log('PUSH TOKEN DEVICE:', token);
          setPushToken(token);
          setTokenType('expo');
          return token;
        }
      } catch (expoError) {
        console.log('[PUSH] Expo token hatası:', expoError);
      }

      return null;
    } catch (error) {
      console.log('[PUSH] Token alma hatası:', error);
      return null;
    }
  }, []);

  // Token'ı backend'e kaydet
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) {
      console.log('[PUSH] userId yok');
      return false;
    }

    try {
      // Login sonrası her seferinde yeni token alıp backend'e overwrite et.
      const token = await registerForPushNotifications();

      if (!token) {
        console.log('[PUSH] Token alınamadı');
        return false;
      }

      console.log('PUSH TOKEN BACKEND:', token);

      const response = await fetch(`${API_URL}/user/register-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('[PUSH] Token kaydedildi');
        return true;
      }
      
      console.log('[PUSH] Kayıt başarısız:', data.detail);
      return false;
    } catch (error) {
      console.log('[PUSH] Kayıt hatası:', error);
      return false;
    }
  }, [registerForPushNotifications]);

  // Token sil
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      setPushToken(null);
      setTokenType(null);
    } catch (error) {
      console.log('[PUSH] Token silme hatası:', error);
    }
  }, []);

  // Listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
      console.log('[PUSH] Bildirim alındı:', notif.request.content.title);
      setNotification(notif);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('[PUSH] Bildirime tıklandı:', data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // ÖNEMLİ: Açılışta registerForPushNotifications ÇAĞRILMAZ.
  // Android 13+ POST_NOTIFICATIONS + Expo izin diyaloğu splash/login öncesinde
  // kullanıcıyı kilitleyebilir. Token yalnızca giriş sonrası registerPushToken(userId) ile alınır.

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
