import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Bildirim ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
  sendLocalNotification: async () => {},
  requestPermissions: async () => false,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Push token al
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        console.log('📱 Push Token:', token);
      }
    });

    // Bildirim dinleyicileri
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Bildirim alındı:', notification);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Bildirime tıklandı:', response);
      // Burada bildirime tıklandığında yapılacak işlemler
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

// Push token kayıt fonksiyonu
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token = null;

  if (Platform.OS === 'web') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Varsayılan',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3FA9F5',
      sound: 'default',
    });

    // Eşleşme bildirimleri için kanal
    await Notifications.setNotificationChannelAsync('match', {
      name: 'Eşleşme Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#10B981',
      sound: 'default',
    });

    // Mesaj bildirimleri için kanal
    await Notifications.setNotificationChannelAsync('message', {
      name: 'Mesaj Bildirimleri',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#3B82F6',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Bildirim izni reddedildi');
      return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    } catch (error) {
      console.log('Push token alınamadı:', error);
    }
  } else {
    console.log('⚠️ Fiziksel cihaz gerekli');
  }

  return token;
}

export default NotificationContext;
