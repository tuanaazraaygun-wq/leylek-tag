/**
 * LeylekTag Push Notifications Hook - FCM Native Token
 * Expo yerine direkt FCM token kullanır
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const API_URL = 'https://leylektag-debug.preview.emergentagent.com/api';

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
  tokenType: 'fcm' | 'expo' | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<string | null>;
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
}

export function usePushNotifications(): PushNotificationHook {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'fcm' | 'expo' | null>(null);
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
  };

  // Token al - önce native FCM, sonra Expo
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('[PUSH] Simülatör - token alınamaz');
      return null;
    }

    try {
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

      // Önce native FCM token'ı dene (Android için)
      if (Platform.OS === 'android') {
        try {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          if (deviceToken && deviceToken.data) {
            const token = deviceToken.data as string;
            console.log('[PUSH] FCM Native Token alındı:', token.substring(0, 30) + '...');
            setPushToken(token);
            setTokenType('fcm');
            return token;
          }
        } catch (fcmError) {
          console.log('[PUSH] FCM token hatası, Expo token deneniyor:', fcmError);
        }
      }

      // Fallback: Expo Push Token
      try {
        const Constants = require('expo-constants').default;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';
        
        const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
        if (expoToken && expoToken.data) {
          console.log('[PUSH] Expo Token alındı:', expoToken.data.substring(0, 30) + '...');
          setPushToken(expoToken.data);
          setTokenType('expo');
          return expoToken.data;
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
      let type = tokenType;
      
      if (!token) {
        token = await registerForPushNotifications();
        type = tokenType;
      }

      if (!token) {
        console.log('[PUSH] Token alınamadı');
        return false;
      }

      console.log('[PUSH] Backend\'e kaydediliyor:', type, token.substring(0, 30) + '...');

      const response = await fetch(`${API_URL}/user/register-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          push_token: token,
          token_type: type || 'fcm',
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
  }, [pushToken, tokenType, registerForPushNotifications]);

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
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
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
