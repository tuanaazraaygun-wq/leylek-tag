/**
 * Expo Push Notifications Hook - V3 AGGRESSIVE
 * Firebase init kontrollü, detaylı loglama
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Backend URL - Production
const API_URL = 'https://api.leylektag.com/api';

// Notification handler - uygulama açıkken bildirimleri göster
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
        name: 'Genel Bildirimler',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3FA9F5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      
      await Notifications.setNotificationChannelAsync('ride_offers', {
        name: 'Yolculuk Teklifleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#00FF00',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      
      console.log('[PUSH] Android channels oluşturuldu');
    } catch (err) {
      console.log('[PUSH] Android channel hatası:', err);
    }
  }, []);

  // Token al - agresif ve detaylı
  const getTokenSafe = useCallback(async (): Promise<string | null> => {
    console.log('[PUSH] getTokenSafe başlıyor...');
    
    try {
      // Platform kontrolü
      console.log('[PUSH] Platform:', Platform.OS);
      console.log('[PUSH] isDevice:', Device.isDevice);
      
      if (!Device.isDevice) {
        console.log('[PUSH] Simülatör tespit edildi - token alınamaz');
        return null;
      }

      // Android kanalları oluştur
      if (Platform.OS === 'android') {
        await setupAndroidChannels();
      }

      // Mevcut izin durumunu kontrol et
      console.log('[PUSH] İzin durumu kontrol ediliyor...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[PUSH] Mevcut izin:', existingStatus);
      
      let finalStatus = existingStatus;

      // İzin yoksa iste
      if (existingStatus !== 'granted') {
        console.log('[PUSH] İzin isteniyor...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('[PUSH] Yeni izin durumu:', finalStatus);
      }

      if (finalStatus !== 'granted') {
        console.log('[PUSH] İzin VERİLMEDİ!');
        setError('Bildirim izni verilmedi');
        return null;
      }

      // Project ID
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';
      console.log('[PUSH] Project ID:', projectId);

      // Token al
      console.log('[PUSH] getExpoPushTokenAsync çağrılıyor...');
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const token = tokenData.data;
      console.log('[PUSH] TOKEN ALINDI:', token);
      
      if (token) {
        setExpoPushToken(token);
        setError(null);
      }
      
      return token;

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.log('[PUSH] HATA:', errorMsg);
      setError(errorMsg);
      
      // Hata detayını göster (debug için)
      if (errorMsg.includes('FirebaseApp') || errorMsg.includes('Firebase')) {
        console.log('[PUSH] Firebase hatası tespit edildi!');
      }
      
      return null;
    }
  }, [setupAndroidChannels]);

  // Token'ı backend'e kaydet
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    console.log('[PUSH] registerPushToken başlıyor, userId:', userId);
    
    try {
      if (!userId) {
        console.log('[PUSH] userId yok!');
        return false;
      }

      // Token al (yoksa)
      let token = expoPushToken;
      if (!token) {
        console.log('[PUSH] Mevcut token yok, alınıyor...');
        token = await getTokenSafe();
      }

      if (!token) {
        console.log('[PUSH] Token alınamadı!');
        return false;
      }

      console.log('[PUSH] Backend\'e gönderiliyor...');
      console.log('[PUSH] URL:', `${API_URL}/user/register-push-token`);
      console.log('[PUSH] Token:', token.substring(0, 40) + '...');

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
      console.log('[PUSH] Backend yanıtı:', JSON.stringify(data));
      
      if (data.success) {
        console.log('[PUSH] ✅ Token başarıyla kaydedildi!');
        return true;
      } else {
        console.log('[PUSH] ❌ Kayıt başarısız:', data.detail || data.error);
        return false;
      }

    } catch (err: any) {
      console.log('[PUSH] registerPushToken hatası:', err?.message || err);
      return false;
    }
  }, [expoPushToken, getTokenSafe]);

  // Token sil (logout)
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      setExpoPushToken(null);
      console.log('[PUSH] Token silindi');
    } catch (err) {
      console.log('[PUSH] Token silme hatası:', err);
    }
  }, []);

  // Yerel bildirim gönder
  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { 
          title, 
          body, 
          data: data || {}, 
          sound: 'default',
        },
        trigger: null,
      });
      console.log('[PUSH] Yerel bildirim gönderildi:', title);
    } catch (err) {
      console.log('[PUSH] Yerel bildirim hatası:', err);
    }
  }, []);

  // Notification listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[PUSH] Bildirim alındı:', notification.request.content.title);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PUSH] Bildirime tıklandı');
      const data = response.notification.request.content.data;
      console.log('[PUSH] Bildirim data:', JSON.stringify(data));
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

  // Uygulama başladığında token almayı dene
  useEffect(() => {
    if (!isInitialized) {
      console.log('[PUSH] İlk başlatma - token alınıyor...');
      getTokenSafe().then((token) => {
        console.log('[PUSH] İlk token sonucu:', token ? 'BAŞARILI' : 'BAŞARISIZ');
        setIsInitialized(true);
      }).catch((err) => {
        console.log('[PUSH] İlk token hatası:', err);
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
