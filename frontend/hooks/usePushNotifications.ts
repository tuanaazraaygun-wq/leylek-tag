/**
 * Expo Push Notifications Hook
 * Push token alma ve backend'e kaydetme işlemlerini yönetir
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Notification handler ayarla - uygulama açıkken bildirimleri göster
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Backend URL - önce extra'dan, sonra env'den, en son hardcoded
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://api.leylektag.com';
const API_URL = `${BACKEND_URL}/api`;

console.log('🔔 Push Notifications - API_URL:', API_URL);

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
}

interface UsePushNotificationsReturn extends PushNotificationState {
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
  scheduleLocalNotification: (title: string, body: string, data?: Record<string, unknown>) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Push token alma
  const getExpoPushToken = useCallback(async (): Promise<string | null> => {
    try {
      // Fiziksel cihaz kontrolü
      if (!Device.isDevice) {
        console.log('📱 Push bildirimleri sadece fiziksel cihazlarda çalışır');
        setError('Simülatörde push bildirimi desteklenmiyor');
        return null;
      }

      // Android için kanal oluştur
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Varsayılan',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3FA9F5',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // Acil bildirimler için kanal
        await Notifications.setNotificationChannelAsync('urgent', {
          name: 'Acil Bildirimler',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#FF0000',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      // İzin kontrolü
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('📱 Push bildirimi izni isteniyor...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Push bildirimi izni reddedildi');
        setError('Bildirim izni verilmedi');
        return null;
      }

      // Expo Push Token al
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';
      
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });

        console.log('✅ Push Token alındı:', tokenData.data);
        setExpoPushToken(tokenData.data);
        setError(null);
        
        return tokenData.data;
      } catch (tokenError: any) {
        // Development build'de token alamayabilir, bu normal
        console.log('⚠️ Push token alınamadı (development modda normal):', tokenError.message);
        return null;
      }
    } catch (err: any) {
      console.log('⚠️ Push notification setup hatası:', err.message);
      // Kritik değil, uygulamayı durdurmayalım
      return null;
    }
  }, []);

  // Token'ı backend'e kaydet
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('🔔 registerPushToken başlıyor, userId:', userId);
      
      let token = expoPushToken;
      
      // Token yoksa al
      if (!token) {
        console.log('🔔 Token yok, getExpoPushToken çağrılıyor...');
        token = await getExpoPushToken();
      }

      if (!token) {
        console.log('⚠️ Push token alınamadı, kayıt atlanıyor');
        return false;
      }

      console.log('🔔 Token alındı:', token.substring(0, 40) + '...');
      console.log('🔔 Backend URL:', API_URL);

      // Backend'e kaydet
      const url = `${API_URL}/user/register-push-token?user_id=${userId}&push_token=${encodeURIComponent(token)}`;
      console.log('🔔 Kayıt URL:', url.substring(0, 100) + '...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('🔔 Backend yanıtı status:', response.status);
      
      const data = await response.json();
      console.log('🔔 Backend yanıtı data:', JSON.stringify(data));

      if (data.success) {
        console.log('✅ Push token backend\'e kaydedildi');
        return true;
      } else {
        console.error('❌ Push token kayıt hatası:', data.detail || data.error);
        return false;
      }
    } catch (err) {
      console.error('❌ Push token kayıt hatası:', err);
      return false;
    }
  }, [expoPushToken, getExpoPushToken]);

  // Token'ı backend'den sil (logout)
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      console.log('✅ Push token silindi');
      setExpoPushToken(null);
    } catch (err) {
      console.error('❌ Push token silme hatası:', err);
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
        trigger: null, // Hemen gönder
      });
    } catch (err) {
      console.error('❌ Yerel bildirim hatası:', err);
    }
  }, []);

  // Listener'ları ayarla
  useEffect(() => {
    // Uygulama başladığında token al
    getExpoPushToken();

    // Bildirim geldiğinde (uygulama açıkken)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Bildirim alındı:', notification.request.content.title);
      setNotification(notification);
    });

    // Kullanıcı bildirime tıkladığında
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Bildirime tıklandı:', response.notification.request.content);
      // Burada deep link veya navigasyon işlemi yapılabilir
      const data = response.notification.request.content.data;
      if (data) {
        console.log('📦 Bildirim verisi:', data);
        // Örnek: tag_id varsa ilgili yolculuğa git
        // navigation.navigate('Trip', { tagId: data.tag_id });
      }
    });

    // App state değişikliklerini dinle
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Uygulama öne geldiğinde badge'i temizle
        Notifications.setBadgeCountAsync(0);
      }
      appStateRef.current = nextAppState;
    });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      subscription.remove();
    };
  }, [getExpoPushToken]);

  return {
    expoPushToken,
    notification,
    error,
    registerPushToken,
    removePushToken,
    scheduleLocalNotification,
  };
}

export default usePushNotifications;
