/**
 * LeylekTag Push Notifications Hook
 * Minimalist, sağlam, test edilmiş versiyon
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const API_URL = 'https://leylektag-debug.preview.emergentagent.com/api';

// Bildirim handler - uygulama açıkken bildirimleri göster
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationHook {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<string | null>;
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
}

export function usePushNotifications(): PushNotificationHook {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  /**
   * Android bildirim kanallarını oluştur
   */
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

    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Mesajlar',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  };

  /**
   * Push notification için izin al ve token oluştur
   */
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    // Simülatör kontrolü
    if (!Device.isDevice) {
      console.log('[PUSH] Simülatör - token alınamaz');
      return null;
    }

    try {
      // Android kanallarını oluştur
      await setupNotificationChannels();

      // Mevcut izin durumunu kontrol et
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // İzin yoksa iste
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // İzin verilmediyse
      if (finalStatus !== 'granted') {
        console.log('[PUSH] İzin verilmedi:', finalStatus);
        return null;
      }

      // Expo Project ID
      const projectId = Constants.expoConfig?.extra?.eas?.projectId 
        ?? 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';

      // Token al
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;

      console.log('[PUSH] Token alındı:', token.substring(0, 40) + '...');
      setExpoPushToken(token);

      return token;
    } catch (error) {
      console.log('[PUSH] Token alma hatası:', error);
      return null;
    }
  }, []);

  /**
   * Token'ı backend'e kaydet
   */
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) {
      console.log('[PUSH] userId yok');
      return false;
    }

    try {
      // Token al (yoksa)
      let token = expoPushToken;
      if (!token) {
        token = await registerForPushNotifications();
      }

      if (!token) {
        console.log('[PUSH] Token alınamadı');
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
        console.log('[PUSH] Token kaydedildi');
        return true;
      }
      
      console.log('[PUSH] Kayıt başarısız:', data.detail);
      return false;
    } catch (error) {
      console.log('[PUSH] Kayıt hatası:', error);
      return false;
    }
  }, [expoPushToken, registerForPushNotifications]);

  /**
   * Token'ı backend'den sil
   */
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      setExpoPushToken(null);
    } catch (error) {
      console.log('[PUSH] Token silme hatası:', error);
    }
  }, []);

  // Bildirim dinleyicileri
  useEffect(() => {
    // Bildirim alındığında
    notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
      console.log('[PUSH] Bildirim alındı:', notif.request.content.title);
      setNotification(notif);
    });

    // Bildirime tıklandığında
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('[PUSH] Bildirime tıklandı, data:', data);
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

  // Uygulama başladığında token al
  useEffect(() => {
    registerForPushNotifications();
  }, [registerForPushNotifications]);

  return {
    expoPushToken,
    notification,
    registerForPushNotifications,
    registerPushToken,
    removePushToken,
  };
}

export default usePushNotifications;
