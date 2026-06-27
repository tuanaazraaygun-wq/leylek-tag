import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Alert, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { MUHABBET_NEW_LOCAL_MESSAGE } from '../lib/muhabbetLocalMessageEvents';
import { upsertMuhabbetMessageFromPushData } from '../lib/muhabbetMessagesStorage';
import { tryPlayDriverOfferSoundFromPushData } from '../utils/sound';
import { refreshSessionFromServerForPush } from '../lib/muhabbetTripPushSessionPrefetch';

/** Bildirim → AsyncStorage (await) → global UI event; navigate öncesi tamamlanmalı */
export async function persistMuhabbetMessageFromNotificationData(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object') return;
  const d = data as Record<string, unknown>;
  if (String(d.type || '').trim() !== 'muhabbet_message' && String(d.type || '').trim() !== 'message') return;
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

/** FCM/APNs data — yalnızca client routing alanları (secret/token yok). */
const PUSH_ROUTING_DATA_KEYS = [
  'type',
  'tag_id',
  'invite_id',
  'request_id',
  'requester_id',
  'source',
  'detail_type',
  'action',
  'offer_id',
  'from_driver',
  'conversation_id',
  'session_id',
  'caller_id',
  'caller_name',
  'target_user_id',
  'call_id',
  'channel_name',
  'agora_token',
  'call_type',
  'event',
  'is_dispatch',
  'is_broadcast',
  'is_rolling_batch',
  'driver_id',
  'connection_id',
  'message_template',
] as const;

/** FCM/APNs ham payload — iOS tap/initial bazen nested `data` veya JSON string taşır. */
function unwrapRemotePushDataPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const nested = src.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...src, ...(nested as Record<string, unknown>) };
  }
  if (typeof nested === 'string') {
    const trimmed = nested.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...src, ...parsed };
        }
      } catch {
        /* noop */
      }
    }
  }
  return src;
}

export function normalizeRemotePushRoutingData(raw: unknown): TappedNotificationData {
  const src = unwrapRemotePushDataPayload(raw);
  if (!src) return null;
  const out: Record<string, unknown> = {};
  for (const key of PUSH_ROUTING_DATA_KEYS) {
    const v = src[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    out[key] = v;
  }
  if (!out.type && !out.tag_id && !out.conversation_id && !out.session_id && !out.call_id) {
    return null;
  }
  return out as TappedNotificationData;
}

function routingTapDedupeKey(normalized: Record<string, unknown>): string {
  const typeLo = String(normalized.type || '').trim().toLowerCase();
  if (typeLo === 'incoming_call') {
    return `${typeLo}:${String(normalized.call_id || '').trim()}`;
  }
  if (typeLo === 'trusted_direct_invite') {
    return `${typeLo}:${String(normalized.invite_id || '').trim()}`;
  }
  if (typeLo === 'quick_match_invite') {
    return `${typeLo}:${String(normalized.invite_id || '').trim()}`;
  }
  return `${typeLo}:${String(
    normalized.tag_id || normalized.conversation_id || normalized.session_id || '',
  ).trim()}`;
}

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
  const fcmOpenedUnsubRef = useRef<(() => void) | null>(null);
  const fcmForegroundOfferUnsubRef = useRef<(() => void) | null>(null);
  const lastRoutingTapDedupeRef = useRef<string>('');
  const navigateCancelledRef = useRef(false);

  const clearLastTappedNotification = React.useCallback(() => {
    setLastTappedNotificationData(null);
  }, []);

  const applyRoutingNotificationTap = React.useCallback(async (raw: unknown) => {
    const normalized = normalizeRemotePushRoutingData(raw);
    if (!normalized) return;
    const dedupeKey = routingTapDedupeKey(normalized);
    if (dedupeKey !== ':' && lastRoutingTapDedupeRef.current === dedupeKey) {
      return;
    }
    if (dedupeKey !== ':') {
      lastRoutingTapDedupeRef.current = dedupeKey;
    }
    await persistMuhabbetMessageFromNotificationData(normalized);
    setTappedData(normalized, setLastTappedNotificationData);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let cancelled = false;

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const pushData = notification?.request?.content?.data;
      void persistMuhabbetMessageFromNotificationData(pushData);
      void tryPlayDriverOfferSoundFromPushData(pushData);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      void applyRoutingNotificationTap(data);
    });

    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || !response) return;
      const data = response.notification?.request?.content?.data;
      await applyRoutingNotificationTap(data);
    })();

    void (async () => {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
      try {
        const messaging = (await import('@react-native-firebase/messaging')).default;
        const initial = await messaging().getInitialNotification();
        if (!cancelled && initial?.data) {
          await applyRoutingNotificationTap(initial.data);
        }
        if (cancelled) return;
        fcmOpenedUnsubRef.current = messaging().onNotificationOpenedApp((remoteMessage) => {
          void applyRoutingNotificationTap(remoteMessage?.data);
        });
        fcmForegroundOfferUnsubRef.current = messaging().onMessage((remoteMessage) => {
          void tryPlayDriverOfferSoundFromPushData(remoteMessage?.data);
        });
      } catch {
        /* RN Firebase messaging yok (Expo Go vb.) */
      }
    })();

    return () => {
      cancelled = true;
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (fcmOpenedUnsubRef.current) {
        fcmOpenedUnsubRef.current();
        fcmOpenedUnsubRef.current = null;
      }
      if (fcmForegroundOfferUnsubRef.current) {
        fcmForegroundOfferUnsubRef.current();
        fcmForegroundOfferUnsubRef.current = null;
      }
    };
  }, [applyRoutingNotificationTap]);

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

  /** Tıklanan muhabbet / eşleşme / Leylek trip: önce local persist (await), sonra route */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const data = lastTappedNotificationData as Record<string, unknown> | null;
    if (!data) return;
    const t = String(data.type || '')
      .trim()
      .toLowerCase();
    const cid = data.conversation_id != null ? String(data.conversation_id).trim() : '';
    const sid = data.session_id != null ? String(data.session_id).trim() : '';

    const tripScreenTypes = new Set(['call', 'qr']);
    const opensTripWithSession = (tripScreenTypes.has(t) || t === 'trip') && !!sid;

    if (t === 'trusted_driver_available') {
      navigateCancelledRef.current = false;
      void (async () => {
        if (navigateCancelledRef.current) return;
        router.push('/trusted-network?role=passenger' as Href);
        clearLastTappedNotification();
      })();
      return () => {
        navigateCancelledRef.current = true;
      };
    }

    if (opensTripWithSession) {
      navigateCancelledRef.current = false;
      void (async () => {
        if (t === 'muhabbet_message' || t === 'message') {
          await persistMuhabbetMessageFromNotificationData(data);
        }
        if (navigateCancelledRef.current) return;
        if (sid) {
          try {
            await refreshSessionFromServerForPush(sid, 'push_open');
          } catch {
            /* prefetch başarısız olsa da rotaya gidilir */
          }
        }
        if (navigateCancelledRef.current) return;
        router.push(`/leylek-trip/${encodeURIComponent(sid)}` as Href);
        clearLastTappedNotification();
      })();
      return () => {
        navigateCancelledRef.current = true;
      };
    }

    if (t === 'trip' && cid && !sid) {
      navigateCancelledRef.current = false;
      void (async () => {
        if (navigateCancelledRef.current) return;
        router.push(`/muhabbet-chat/${encodeURIComponent(cid)}` as Href);
        clearLastTappedNotification();
      })();
      return () => {
        navigateCancelledRef.current = true;
      };
    }

    if (
      !cid ||
      (t !== 'muhabbet_message' &&
        t !== 'message' &&
        t !== 'leylek_pair_match_request' &&
        t !== 'leylek_key_match_completed')
    ) {
      return;
    }
    navigateCancelledRef.current = false;
    void (async () => {
      if (t === 'muhabbet_message' || t === 'message') {
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
