import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Bildirim handler: yalnızca `app/_layout.tsx` (çift tanım sıcak yenilemede son import’un kazanması riskini kaldırır). */

export type TappedNotificationData = { type?: string; tag_id?: string; action?: string; [key: string]: any } | null;

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  /** Bildirime tıklandığında set edilir (örn. new_offer → tag_id ile teklif ekranına git) */
  lastTappedNotificationData: TappedNotificationData;
  clearLastTappedNotification: () => void;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
  lastTappedNotificationData: null,
  clearLastTappedNotification: () => {},
  sendLocalNotification: async () => {},
  requestPermissions: async () => false,
});

function setTappedData(
  data: TappedNotificationData,
  set: React.Dispatch<React.SetStateAction<TappedNotificationData>>
) {
  if (data && typeof data === 'object') {
    set({ ...data });
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [lastTappedNotificationData, setLastTappedNotificationData] = useState<TappedNotificationData>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  const clearLastTappedNotification = React.useCallback(() => {
    setLastTappedNotificationData(null);
  }, []);

  useEffect(() => {
    // Web'de expo-notifications API'leri tam destekli değil; yalnızca native'de kur.
    if (Platform.OS === 'web') {
      return;
    }

    // Bu provider sadece dinleyicileri yönetir.
    // Token alma: PushNotificationsProvider (app/_layout) — burada yalnızca dinleyiciler.
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Bildirim alındı:', notification);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response?.notification?.request?.content?.data;
      console.log('👆 Bildirime tıklandı:', data);
      setTappedData(data || null, setLastTappedNotificationData);
    });

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        const data = response.notification.request.content.data;
        console.log('📬 Uygulama bildirim ile açıldı:', data);
        setTappedData(data || null, setLastTappedNotificationData);
      }
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

  // İzin iste
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Bildirim İzni',
        'Eşleşme ve mesaj bildirimlerini almak için bildirim iznini açmanız gerekiyor.',
        [{ text: 'Tamam' }]
      );
      return false;
    }

    return true;
  };

  // Yerel bildirim gönder
  const sendLocalNotification = async (title: string, body: string, data?: any) => {
    if (Platform.OS === 'web') {
      // Web'de expo-notifications desteklenmediği için sessizce çık.
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Hemen gönder
    });
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        lastTappedNotificationData,
        clearLastTappedNotification,
        sendLocalNotification,
        requestPermissions,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export default NotificationContext;
