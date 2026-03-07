/**
 * Expo Push Notifications Hook - TAM YENİDEN YAZILDI
 * Push token alma ve backend'e kaydetme işlemlerini yönetir
 * Uygulama kapalıyken de bildirim alır (FCM üzerinden)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Backend URL - SABIT - asla değişmemeli
const API_URL = 'https://api.leylektag.com/api';

// Notification handler - uygulama açıkken VE arka plandayken bildirimleri göster
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('🔔 [HANDLER] Bildirim alındı:', notification.request.content.title);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

interface UsePushNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
  isInitialized: boolean;
  registerPushToken: (userId: string) => Promise<boolean>;
  removePushToken: (userId: string) => Promise<void>;
  scheduleLocalNotification: (title: string, body: string, data?: Record<string, unknown>) => Promise<void>;
  getExpoPushToken: () => Promise<string | null>;
  requestPermissionAndGetToken: () => Promise<string | null>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Android için notification channel'ları oluştur
  const setupAndroidChannels = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    try {
      // Varsayılan kanal - tüm bildirimler
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Varsayılan Bildirimler',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3FA9F5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true, // Rahatsız etmeyin modunu geç
      });

      // Acil bildirimler - yolculuk teklifleri
      await Notifications.setNotificationChannelAsync('ride_offers', {
        name: 'Yolculuk Teklifleri',
        description: 'Yeni yolculuk teklifi bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightColor: '#00FF00',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      // Eşleşme bildirimleri
      await Notifications.setNotificationChannelAsync('matches', {
        name: 'Eşleşme Bildirimleri',
        description: 'Sürücü-yolcu eşleşme bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#FFD700',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      console.log('✅ Android notification kanalları oluşturuldu');
    } catch (err) {
      console.error('❌ Android kanal oluşturma hatası:', err);
    }
  }, []);

  // İzin iste ve token al - ANA FONKSİYON
  const requestPermissionAndGetToken = useCallback(async (): Promise<string | null> => {
    try {
      console.log('🔔 [INIT] Push notification setup başlıyor...');

      // Fiziksel cihaz kontrolü
      if (!Device.isDevice) {
        console.log('📱 Simülatörde push bildirimleri desteklenmiyor');
        setError('Simülatörde desteklenmiyor');
        return null;
      }

      // Android kanalları oluştur
      await setupAndroidChannels();

      // Mevcut izin durumunu kontrol et
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('🔔 Mevcut izin durumu:', existingStatus);

      let finalStatus = existingStatus;

      // İzin yoksa iste
      if (existingStatus !== 'granted') {
        console.log('🔔 Bildirim izni isteniyor...');
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
        });
        finalStatus = status;
        console.log('🔔 Yeni izin durumu:', finalStatus);
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Bildirim izni reddedildi');
        setError('Bildirim izni verilmedi');
        
        // Kullanıcıya bilgi ver
        Alert.alert(
          'Bildirim İzni Gerekli',
          'Yolculuk tekliflerinden haberdar olmak için bildirim iznini ayarlardan açın.',
          [{ text: 'Tamam' }]
        );
        
        return null;
      }

      // Expo Push Token al
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';
      console.log('🔔 Project ID:', projectId);

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const token = tokenData.data;
      console.log('✅ Push Token alındı:', token);
      
      setExpoPushToken(token);
      setError(null);
      setIsInitialized(true);

      return token;
    } catch (err: any) {
      console.error('❌ Push token alma hatası:', err);
      setError(err.message);
      return null;
    }
  }, [setupAndroidChannels]);

  // Sadece token al (izin istemeden)
  const getExpoPushToken = useCallback(async (): Promise<string | null> => {
    if (expoPushToken) return expoPushToken;
    return await requestPermissionAndGetToken();
  }, [expoPushToken, requestPermissionAndGetToken]);

  // Token'ı backend'e kaydet
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('🔔 [REGISTER] Başlıyor, userId:', userId);

      // Token al
      let token = expoPushToken;
      if (!token) {
        console.log('🔔 Token yok, alınıyor...');
        token = await requestPermissionAndGetToken();
      }

      if (!token) {
        console.log('⚠️ Token alınamadı');
        return false;
      }

      console.log('🔔 Token:', token.substring(0, 50) + '...');

      // Backend'e kaydet
      const url = `${API_URL}/user/register-push-token`;
      console.log('🔔 API URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
        }),
      });

      console.log('🔔 Response status:', response.status);

      const data = await response.json();
      console.log('🔔 Response data:', JSON.stringify(data));

      if (data.success) {
        console.log('✅ Token backend\'e kaydedildi');
        return true;
      } else {
        console.error('❌ Kayıt hatası:', data.detail || data.error);
        return false;
      }
    } catch (err) {
      console.error('❌ registerPushToken hatası:', err);
      return false;
    }
  }, [expoPushToken, requestPermissionAndGetToken]);

  // Token'ı sil (logout)
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      console.log('✅ Token silindi');
      setExpoPushToken(null);
    } catch (err) {
      console.error('❌ Token silme hatası:', err);
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
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Hemen gönder
      });
      console.log('✅ Yerel bildirim gönderildi:', title);
    } catch (err) {
      console.error('❌ Yerel bildirim hatası:', err);
    }
  }, []);

  // Notification listeners
  useEffect(() => {
    // Gelen bildirim listener
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 [RECEIVED] Bildirim alındı:', notification.request.content.title);
      setNotification(notification);
    });

    // Bildirime tıklama listener
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('🔔 [TAP] Bildirime tıklandı:', response.notification.request.content);
      const data = response.notification.request.content.data;
      
      // Bildirim tipine göre işlem yap
      if (data?.type === 'new_offer') {
        console.log('🔔 Yeni teklif bildirimine tıklandı');
      } else if (data?.type === 'match_accepted') {
        console.log('🔔 Eşleşme bildirimine tıklandı');
      }
    });

    // App state listener - arka plandan döndüğünde token kontrolü
    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔔 Uygulama ön plana geldi, token kontrolü...');
        // Token yoksa almayı dene
        if (!expoPushToken) {
          await requestPermissionAndGetToken();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      appStateListener.remove();
    };
  }, [expoPushToken, requestPermissionAndGetToken]);

  // İlk yüklemede token almayı dene
  useEffect(() => {
    if (!isInitialized) {
      requestPermissionAndGetToken();
    }
  }, [isInitialized, requestPermissionAndGetToken]);

  return {
    expoPushToken,
    notification,
    error,
    isInitialized,
    registerPushToken,
    removePushToken,
    scheduleLocalNotification,
    getExpoPushToken,
    requestPermissionAndGetToken,
  };
}

export default usePushNotifications;
