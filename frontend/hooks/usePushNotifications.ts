/**
 * Expo Push Notifications Hook - STABIL VERSİYON
 * Alert yok, crash yok, sessizce çalışır
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Backend URL
const API_URL = 'https://api.leylektag.com/api';

// Notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface UsePushNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
  isInitialized: boolean;
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
  scheduleLocalNotification: (title: string, body: string, data?: Record<string, unknown>) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Android için notification channel oluştur
  const setupAndroidChannels = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Varsayılan',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3FA9F5',
        sound: 'default',
      });
      console.log('✅ Android channel oluşturuldu');
    } catch (err) {
      console.log('Android channel hatası:', err);
    }
  }, []);

  // Token al - güvenli, crash-proof
  const getTokenSafe = useCallback(async (): Promise<string | null> => {
    try {
      // Simülatör kontrolü
      if (!Device.isDevice) {
        console.log('Simülatör - push desteklenmiyor');
        return null;
      }

      // Android kanalları
      await setupAndroidChannels();

      // İzin kontrolü
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Bildirim izni verilmedi');
        return null;
      }

      // Token al
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const token = tokenData.data;
      console.log('✅ Token alındı:', token?.substring(0, 30));
      return token;

    } catch (err: any) {
      console.log('Token alma hatası:', err?.message || err);
      return null;
    }
  }, [setupAndroidChannels]);

  // Token'ı backend'e kaydet
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    try {
      if (!userId) {
        console.log('userId yok, kayıt atlandı');
        return false;
      }

      // Token al
      let token = expoPushToken;
      if (!token) {
        token = await getTokenSafe();
        if (token) {
          setExpoPushToken(token);
        }
      }

      if (!token) {
        console.log('Token alınamadı, kayıt atlandı');
        return false;
      }

      // Backend'e gönder
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
        console.log('✅ Token kaydedildi');
        return true;
      } else {
        console.log('Token kayıt hatası:', data.detail);
        return false;
      }

    } catch (err: any) {
      console.log('registerPushToken hatası:', err?.message || err);
      return false;
    }
  }, [expoPushToken, getTokenSafe]);

  // Token sil
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      setExpoPushToken(null);
    } catch (err) {
      console.log('Token silme hatası:', err);
    }
  }, []);

  // Yerel bildirim
  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: data || {}, sound: 'default' },
        trigger: null,
      });
    } catch (err) {
      console.log('Yerel bildirim hatası:', err);
    }
  }, []);

  // Listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Bildirim alındı:', notification.request.content.title);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Bildirime tıklandı');
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // İlk yüklemede token al
  useEffect(() => {
    if (!isInitialized) {
      getTokenSafe().then((token) => {
        if (token) {
          setExpoPushToken(token);
        }
        setIsInitialized(true);
      }).catch(() => {
        setIsInitialized(true);
      });
    }
  }, [isInitialized, getTokenSafe]);

  return {
    expoPushToken,
    notification,
    error,
    isInitialized,
    registerPushToken,
    removePushToken,
    scheduleLocalNotification,
  };
}

export default usePushNotifications;
