/**
 * LeylekTag Push Notifications Hook
 * Tek bir Expo push akışı kullanır.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../lib/backendConfig';

/** Socket/REST ile aynı kök — APK’da extra boş kalsa bile EXPO_PUBLIC_BACKEND_URL devreye girer */
const API_URL = API_BASE_URL;

// Bildirim handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationHook {
  pushToken: string | null;
  tokenType: 'expo' | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<string | null>;
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
}

export function usePushNotifications(): PushNotificationHook {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'expo' | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Android bildirim kanalları
  const setupNotificationChannels = async () => {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
      name: 'Genel Bildirimler',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3FA9F5',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Yolculuk Teklifleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#00FF00',
      sound: 'default',
    });

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
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#3FA9F5',
      sound: 'default',
    });
  };

  // Tek bir Expo push token akisi kullan. Kanal önce oluşturulur, sonra token alınır.
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('[PUSH] Simülatör - token alınamaz');
      return null;
    }

    try {
      // Android: "default" ve diğer kanallar token kaydından ÖNCE oluşturulur (uygulama açılışında _layout'ta da oluşturuluyor)
      await setupNotificationChannels();

      // İzin kontrolü
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
          console.log('EXPO TOKEN:', token);
          console.log('[PUSH] Expo Token alındı:', token.substring(0, 30) + '...');
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
      let token = pushToken;
      if (!token) {
        token = await registerForPushNotifications();
      }

      if (!token) {
        console.log('[PUSH] Token alınamadı');
        return false;
      }

      console.log('[PUSH] Backend\'e kaydediliyor: expo', token.substring(0, 30) + '...');

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
  }, [pushToken, registerForPushNotifications]);

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

  // Başlangıçta token al
  useEffect(() => {
    registerForPushNotifications();
  }, [registerForPushNotifications]);

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
