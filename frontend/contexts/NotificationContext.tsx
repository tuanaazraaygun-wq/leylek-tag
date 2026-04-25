import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Alert, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { MUHABBET_NEW_LOCAL_MESSAGE } from '../lib/muhabbetLocalMessageEvents';
import { upsertMuhabbetMessageFromPushData } from '../lib/muhabbetMessagesStorage';

/** Bildirim → AsyncStorage (await) → global UI event; navigate öncesi tamamlanmalı */
export async function persistMuhabbetMessageFromNotificationData(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object') return;
  const d = data as Record<string, unknown>;
  if (String(d.type || '').trim() !== 'muhabbet_message') return;
  try {
    const summary = JSON.stringify({
      type: d.type,
      conversation_id: d.conversation_id,
      message_id: d.message_id,
      sender_id: d.sender_id,
      has_text: Boolean(d.text),
      created_at: d.created_at,
    });
    console.log('[push] muhabbet_message data=', summary);
  } catch {
    console.log('[push] muhabbet_message data=', String(d.type));
  }
  await upsertMuhabbetMessageFromPushData(d);
  const mid = d.message_id != null ? String(d.message_id) : '';
  console.log('[push] stored local message id=', mid);
  DeviceEventEmitter.emit(MUHABBET_NEW_LOCAL_MESSAGE, { ...d });
}

/** Bildirim handler: yalnızca `app/_layout.tsx` (çift tanım sıcak yenilemede son import’un kazanması riskini kaldırır). */

export type TappedNotificationData = { type?: string; tag_id?: string; action?: string; [key: string]: any } | null;

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  /** Bildirime tıklandığında set edilir; backend `type`: chat | match | offer (+ `detail_type`, `tag_id`) */
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
  const navigateCancelledRef = useRef(false);

  const clearLastTappedNotification = React.useCallback(() => {
    setLastTappedNotificationData(null);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Bildirim alındı:', notification);
      void persistMuhabbetMessageFromNotificationData(notification?.request?.content?.data);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      console.log('👆 Bildirime tıklandı:', data);
      void (async () => {
        await persistMuhabbetMessageFromNotificationData(data);
        setTappedData(
          data && typeof data === 'object' ? (data as TappedNotificationData) : null,
          setLastTappedNotificationData,
        );
      })();
    });

    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;
      const data = response.notification?.request?.content?.data;
      console.log('📬 Uygulama bildirim ile açıldı:', data);
      await persistMuhabbetMessageFromNotificationData(data);
      setTappedData((data && typeof data === 'object' ? data : null) as TappedNotificationData, setLastTappedNotificationData);
    })();

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

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

  const sendLocalNotification = async (title: string, body: string, data?: any) => {
    if (Platform.OS === 'web') {
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
      trigger: null,
    });
  };

  /** Tıklanan muhabbet / eşleşme: önce local persist (await), sonra route */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const data = lastTappedNotificationData as Record<string, unknown> | null;
    if (!data) return;
    const t = String(data.type || '');
    const cid = data.conversation_id != null ? String(data.conversation_id).trim() : '';
    if (
      !cid ||
      (t !== 'muhabbet_message' && t !== 'leylek_pair_match_request' && t !== 'leylek_key_match_completed')
    ) {
      return;
    }
    navigateCancelledRef.current = false;
    void (async () => {
      if (t === 'muhabbet_message') {
        await persistMuhabbetMessageFromNotificationData(data);
      }
      if (navigateCancelledRef.current) return;
      router.push(`/muhabbet-chat/${encodeURIComponent(cid)}` as Href);
      clearLastTappedNotification();
    })();
    return () => {
      navigateCancelledRef.current = true;
    };
  }, [lastTappedNotificationData, clearLastTappedNotification]);

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
