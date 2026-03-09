/**
 * Expo Push Notifications Hook - V4 ULTRA AGGRESSIVE
 * Uygulama açılır açılmaz izin iste
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
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
  requestPermission: () => Promise<string | null>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Android kanalları
  const setupAndroidChannels = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bildirimler',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3FA9F5',
        sound: 'default',
      });
    }
  };

  // İzin iste ve token al
  const requestPermission = useCallback(async (): Promise<string | null> => {
    try {
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
        return null;
      }

      // Token al
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f00346b0-b9cb-47f9-a647-7f56b168e3a9';
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const token = tokenData.data;
      if (token) {
        setExpoPushToken(token);
      }
      return token;

    } catch (err: any) {
      console.log('Push error:', err?.message);
      return null;
    }
  }, []);

  // Token kaydet
  const registerPushToken = useCallback(async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;

      let token = expoPushToken;
      if (!token) {
        token = await requestPermission();
      }

      if (!token) return false;

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
      return data.success === true;

    } catch (err) {
      return false;
    }
  }, [expoPushToken, requestPermission]);

  // Token sil
  const removePushToken = useCallback(async (userId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/user/remove-push-token?user_id=${userId}`, {
        method: 'DELETE',
      });
      setExpoPushToken(null);
    } catch (err) {}
  }, []);

  // Listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

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
    if (!isInitialized) {
      requestPermission().finally(() => setIsInitialized(true));
    }
  }, [isInitialized, requestPermission]);

  return {
    expoPushToken,
    notification,
    error,
    isInitialized,
    registerPushToken,
    removePushToken,
    requestPermission,
  };
}

export default usePushNotifications;
