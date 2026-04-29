/**
 * Leylek Teklif Sende: sohbet listesi (conversations/me).
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import MuhabbetWatermark from './MuhabbetWatermark';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { MUHABBET_CONVERSATION_READ, MUHABBET_NEW_LOCAL_MESSAGE } from '../lib/muhabbetLocalMessageEvents';
import {
  clearMuhabbetMessagesLocal,
  coerceMessageCreatedAt,
  getLastMessageFromLocal,
} from '../lib/muhabbetMessagesStorage';
import { formatMuhabbetRouteLabel } from '../lib/formatMuhabbetRouteLabel';
import { getOrCreateSocket } from '../contexts/SocketContext';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ACCENT = '#F59E0B';
const SURFACE = '#F2F2F7';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_SHADOW_SOFT = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 },
  android: { elevation: 3 },
  default: {},
});

const CARD_SHADOW_PREMIUM = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  android: { elevation: 8 },
  default: {},
});

export type MuhabbetConversationListItem = {
  conversation_id?: string;
  id?: string;
  other_user_id?: string;
  other_user_name?: string;
  other_user_public_name?: string;
  other_user_role?: string | null;
  other_user_role_label?: string | null;
  other_user_profile_photo_url?: string | null;
  from_text?: string | null;
  to_text?: string | null;
  listing_scope?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  city?: string | null;
  last_message_body?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  request_status?: string | null;
  matched_at?: string | null;
  match_source?: string | null;
  created_at?: string;
  unread_count?: number;
};

function initialsFromPublicName(nameRaw: string): string {
  const parts = (nameRaw || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export type ConversationsScreenProps = {
  /** `.../api` sonlu kök (ör. API_BASE_URL) */
  apiBaseUrl: string;
  /** full: geri + tam ekran; embedded: sekme içi liste */
  variant?: 'full' | 'embedded';
  /** Yalnızca kabul edilmiş eşleşme sohbetleri (Sohbetler sekmesi) */
  onlyAccepted?: boolean;
  /** Üst bileşen yenilemesinde listeyi tekrar çek */
  refreshNonce?: number;
  /** Liste unread toplamı (alt tab rozeti vb.) */
  onUnreadSumChange?: (total: number) => void;
};

const MS = 1000;
const MIN = 60 * MS;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * last_message_at: son 24 saat göreli (Az önce / X dk önce / X sa. önce),
 * daha eskilerde göreli değil → kısa tarih + saat.
 */
function formatLastMessageListTime(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 0) {
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (diff < MIN) return 'Az önce';
  if (diff < HOUR) {
    const m = Math.max(1, Math.floor(diff / MIN));
    return `${m} dk önce`;
  }
  if (diff < DAY) {
    const h = Math.max(1, Math.floor(diff / HOUR));
    return `${h} sa. önce`;
  }
  const y = new Date().getFullYear();
  const o: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };
  if (d.getFullYear() !== y) o.year = '2-digit';
  return d.toLocaleString('tr-TR', o);
}

function UnreadPulseWrap({ active, children }: { active: boolean; children: React.ReactNode }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      op.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      op.setValue(1);
    };
  }, [active, op]);
  return <Animated.View style={{ opacity: op }}>{children}</Animated.View>;
}

type ConversationListRowProps = {
  item: MuhabbetConversationListItem;
  onOpen: (c: MuhabbetConversationListItem) => void;
  onLongRemove: (c: MuhabbetConversationListItem) => void;
};

const ConversationListRow = memo(function ConversationListRow({
  item,
  onOpen,
  onLongRemove,
}: ConversationListRowProps) {
  const isFocused = useIsFocused();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const last =
    (item.last_message_body && String(item.last_message_body).trim()) ||
    (item.last_message && String(item.last_message).trim()) ||
    '';
  const lastLine = last ? (last.length > 100 ? `${last.slice(0, 100)}…` : last) : 'Henüz mesaj yok';
  const or = (item.other_user_role || '').toLowerCase();
  const driverish = or === 'driver' || or === 'private_driver';
  const unreadCount = Math.max(0, Number(item.unread_count || 0));
  const unread = unreadCount > 0;
  const publicName =
    (item.other_user_public_name && String(item.other_user_public_name).trim()) ||
    (item.other_user_name && String(item.other_user_name).trim()) ||
    'Leylek kullanıcısı';
  const roleLabel = item.other_user_role_label || (driverish ? 'Sürücü' : 'Yolcu');
  const hasMatched = Boolean(item.matched_at) || (item.request_status || '').toLowerCase() === 'accepted';
  const hasPending = (item.request_status || '').toLowerCase() === 'pending';
  const photoUrl = (item.other_user_profile_photo_url || '').trim();
  const routeLabel = formatMuhabbetRouteLabel({
    listing_scope: item.listing_scope,
    origin_city: item.origin_city,
    destination_city: item.destination_city,
    city: item.city,
    from_text: item.from_text,
    to_text: item.to_text,
  });

  const handlePress = useCallback(() => {
    onOpen(item);
  }, [item, onOpen]);

  const handleLongPress = useCallback(() => {
    onLongRemove(item);
  }, [item, onLongRemove]);

  return (
    <Pressable
      style={{ alignSelf: 'stretch' }}
      onPressIn={() =>
        void Animated.timing(scaleAnim, {
          toValue: 0.98,
          duration: 55,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        void Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start()
      }
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      android_disableSound
      accessibilityHint="Sohbetten kaldırmak için basılı tutun"
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={styles.cardSheet}>
        <LinearGradient
          colors={['#60A5FA', '#93C5FD', '#FDBA74']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardAccentBar}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardRowMain}>
            {photoUrl ? (
              <View style={styles.avatarRing}>
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              </View>
            ) : (
              <View style={styles.avatarRing}>
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initialsFromPublicName(publicName)}</Text>
                </View>
              </View>
            )}
            <View style={styles.cardTextCol}>
              <View style={styles.nameTimeRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {publicName}
                </Text>
                <View style={styles.timeCol}>
                  <UnreadPulseWrap active={unread && isFocused}>
                    <View style={styles.timeColPulseInner}>
                      <View style={styles.timeUnreadRow}>
                        {item.last_message_at ? (
                          <Text style={[styles.timeRight, unread && styles.timeRightUnread]}>
                            {formatLastMessageListTime(String(item.last_message_at))}
                          </Text>
                        ) : null}
                      </View>
                      {unread ? (
                        unreadCount > 9 ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeTxt}>9+</Text>
                          </View>
                        ) : (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeTxt}>{unreadCount}</Text>
                          </View>
                        )
                      ) : null}
                    </View>
                  </UnreadPulseWrap>
                </View>
              </View>
              <Text style={styles.routeCompact} numberOfLines={1} ellipsizeMode="tail">
                {routeLabel}
              </Text>
              <Text
                style={[styles.previewSub, unread && styles.previewSubUnread]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {lastLine}
              </Text>
              <View style={styles.badgesLine}>
                <Text style={[styles.rolePill, driverish ? styles.rolePillDriver : styles.rolePillPax]}>{roleLabel}</Text>
                {hasMatched ? <Text style={styles.matchedPill}>Eşleşti</Text> : null}
                {!hasMatched && hasPending ? <Text style={styles.pendingPill}>Görüşme</Text> : null}
              </View>
            </View>
          </View>
        </View>
      </View>
      </Animated.View>
    </Pressable>
  );
});
export function buildMuhabbetChatHref(
  conversationId: string,
  p: { otherUserName: string; fromText: string; toText: string; otherUserId?: string }
): Href {
  const q = new URLSearchParams();
  if (p.otherUserName) q.set('n', p.otherUserName);
  if (p.fromText) q.set('f', p.fromText);
  if (p.toText) q.set('t', p.toText);
  if (p.otherUserId) q.set('ou', p.otherUserId);
  const s = q.toString();
  return (s
    ? `/muhabbet-chat/${encodeURIComponent(conversationId)}?${s}`
    : `/muhabbet-chat/${encodeURIComponent(conversationId)}`) as Href;
}

export default function ConversationsScreen({
  apiBaseUrl,
  variant = 'full',
  onlyAccepted = false,
  refreshNonce = 0,
  onUnreadSumChange,
}: ConversationsScreenProps) {
  const router = useRouter();
  const chatOpenBusyRef = useRef(false);
  const insets = useSafeAreaInsets();
  const base = apiBaseUrl.replace(/\/$/, '');
  const embedded = variant === 'embedded';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<MuhabbetConversationListItem[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const myUserIdRef = useRef('');
  const [err, setErr] = useState<string | null>(null);

  const emitUnreadSum = useCallback(
    (items: MuhabbetConversationListItem[]) => {
      if (!onUnreadSumChange) return;
      const sum = items.reduce((acc, c) => acc + Math.max(0, Number(c.unread_count || 0)), 0);
      onUnreadSumChange(sum);
    },
    [onUnreadSumChange]
  );

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);
  const sortConversations = useCallback((items: MuhabbetConversationListItem[]) => {
    return [...items].sort((a, b) => {
      const ta = new Date(String(a.last_message_at || a.created_at || 0)).getTime();
      const tb = new Date(String(b.last_message_at || b.created_at || 0)).getTime();
      return tb - ta;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw || cancelled) return;
        const u = JSON.parse(raw) as { id?: string };
        if (u?.id) setMyUserId(String(u.id).trim().toLowerCase());
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    if (!embedded) setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setErr('Oturum bulunamadı.');
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      const res = await fetch(`${base}/muhabbet/conversations/me?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversations?: MuhabbetConversationListItem[];
        detail?: string;
      };
      if (!res.ok || !data.success) {
        setErr(typeof data.detail === 'string' && data.detail ? data.detail : 'Liste yüklenemedi.');
        console.log('[muhabbet] preserving rows during reconnect');
        return;
      }
      let list = Array.isArray(data.conversations) ? data.conversations : [];
      if (onlyAccepted) {
        list = list.filter((c) => {
          const req = (c.request_status || '').toLowerCase();
          if (req === 'accepted') return true;
          if (String(c.matched_at || '').trim()) return true;
          // Eski kayıtlarda request_status boş olabilir; mesaj trafiği varsa sohbeti gizleme.
          if (
            String(c.last_message_at || '').trim() ||
            String(c.last_message_body || '').trim() ||
            String(c.last_message || '').trim()
          ) {
            return true;
          }
          return false;
        });
      }
      const enriched = await Promise.all(
        list.map(async (c) => {
          const cid = String(c.conversation_id || c.id || '').trim();
          if (!cid) return c;
          try {
            const lp = await getLastMessageFromLocal(cid);
            if (lp && !String(c.last_message_body || c.last_message || '').trim()) {
              return {
                ...c,
                last_message_body: lp.text,
                last_message_at: lp.created_at,
                unread_count: Number(c.unread_count ?? 0),
              };
            }
          } catch {
            /* noop */
          }
          return {
            ...c,
            last_message_body: c.last_message_body ?? c.last_message ?? null,
            last_message_at: c.last_message_at ?? null,
            unread_count: Number(c.unread_count ?? 0),
          };
        })
      );
      const sorted = sortConversations(enriched);
      setRows(sorted);
      emitUnreadSum(sorted);
    } catch {
      setErr('Bağlantı hatası.');
      console.log('[muhabbet] preserving rows during reconnect');
    } finally {
      setLoading(false);
    }
  }, [base, embedded, onlyAccepted, sortConversations, emitUnreadSum]);

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      void load();
    }, 400);
  }, [load]);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (embedded) void load();
    }, [embedded, load])
  );

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = DeviceEventEmitter.addListener(MUHABBET_NEW_LOCAL_MESSAGE, (payload: Record<string, unknown>) => {
      if (String(payload?.type || '').trim() !== 'muhabbet_message') return;
      const conv =
        payload.conversation_id != null ? String(payload.conversation_id).trim().toLowerCase() : '';
      if (!conv) return;
      const text = payload.text != null ? String(payload.text) : '';
      const at = coerceMessageCreatedAt(payload.created_at);
      const senderId = payload.sender_id != null ? String(payload.sender_id).trim().toLowerCase() : '';
      setRows((prev) => {
        const mapped = prev.map((c) => {
          const cid = String(c.conversation_id || c.id || '').trim().toLowerCase();
          if (cid !== conv) return c;
          const isIncoming = Boolean(senderId && myUserIdRef.current && senderId !== myUserIdRef.current);
          return {
            ...c,
            last_message_body: text || null,
            last_message_at: at,
            unread_count: isIncoming ? Math.max(1, Number(c.unread_count || 0) + 1) : Number(c.unread_count || 0),
          };
        });
        const next = sortConversations(mapped);
        queueMicrotask(() => emitUnreadSum(next));
        return next;
      });
    });
    return () => sub.remove();
  }, [sortConversations, emitUnreadSum]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = DeviceEventEmitter.addListener(MUHABBET_CONVERSATION_READ, (payload: Record<string, unknown>) => {
      const conv = payload?.conversation_id != null ? String(payload.conversation_id).trim().toLowerCase() : '';
      if (!conv) return;
      setRows((prev) => {
        const next = prev.map((c) => {
          const cid = String(c.conversation_id || c.id || '').trim().toLowerCase();
          if (cid !== conv) return c;
          return { ...c, unread_count: 0 };
        });
        queueMicrotask(() => emitUnreadSum(next));
        return next;
      });
    });
    return () => sub.remove();
  }, [emitUnreadSum]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const socket = getOrCreateSocket();
    const onConversationUpdated = (payload: {
      conversation_id?: string;
      last_message_body?: string;
      last_message_at?: string;
      sender_id?: string;
      unread_for_user_id?: string;
    }) => {
      const conv = payload?.conversation_id != null ? String(payload.conversation_id).trim().toLowerCase() : '';
      if (!conv) return;
      const body = payload?.last_message_body != null ? String(payload.last_message_body) : '';
      const at = coerceMessageCreatedAt(payload?.last_message_at);
      const sender = payload?.sender_id != null ? String(payload.sender_id).trim().toLowerCase() : '';
      const unreadFor = payload?.unread_for_user_id != null ? String(payload.unread_for_user_id).trim().toLowerCase() : '';
      setRows((prev) => {
        let found = false;
        const myLo = myUserIdRef.current.trim().toLowerCase();
        if (!myLo) {
          scheduleReload();
          return prev;
        }
        const next = prev.map((c) => {
          const cid = String(c.conversation_id || c.id || '').trim().toLowerCase();
          if (cid !== conv) return c;
          found = true;
          const isUnreadForMe = Boolean(unreadFor && unreadFor === myLo && sender && sender !== myLo);
          return {
            ...c,
            last_message_body: body || c.last_message_body || null,
            last_message_at: at,
            unread_count: isUnreadForMe ? Math.max(1, Number(c.unread_count || 0) + 1) : Number(c.unread_count || 0),
          };
        });
        if (!found) {
          void load();
          return prev;
        }
        const sorted = sortConversations(next);
        queueMicrotask(() => emitUnreadSum(sorted));
        return sorted;
      });
    };
    socket.on('muhabbet_conversation_updated', onConversationUpdated);
    return () => {
      socket.off('muhabbet_conversation_updated', onConversationUpdated);
    };
  }, [load, sortConversations, scheduleReload, emitUnreadSum]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const doHide = useCallback(
    async (cid: string) => {
      try {
        const token = (await getPersistedAccessToken())?.trim();
        if (!token) return;
        const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/hide`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (handleUnauthorizedAndMaybeRedirect(res)) return;
        if (res.ok) await load();
      } catch {
        /* noop */
      }
    },
    [base, load]
  );

  const confirmRemoveConversation = useCallback(
    (c: MuhabbetConversationListItem) => {
      const cid = String(c.conversation_id || c.id || '').trim();
      if (!cid) return;
      Alert.alert('Sil', 'Bu öğeyi silmek istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              try {
                await clearMuhabbetMessagesLocal(cid);
              } catch {
                /* noop */
              }
              await doHide(cid);
            })(),
        },
      ]);
    },
    [doHide]
  );

  const openChat = useCallback(
    (c: MuhabbetConversationListItem) => {
      if (chatOpenBusyRef.current) return;
      const cid = String(c.conversation_id || c.id || '').trim();
      if (!cid) return;
      chatOpenBusyRef.current = true;
      setTimeout(() => {
        chatOpenBusyRef.current = false;
      }, 500);
      setRows((prev) =>
        prev.map((x) => {
          const xc = String(x.conversation_id || x.id || '').trim().toLowerCase();
          if (xc !== cid.toLowerCase()) return x;
          return { ...x, unread_count: 0 };
        })
      );
      DeviceEventEmitter.emit(MUHABBET_CONVERSATION_READ, { conversation_id: cid });
      void (async () => {
        try {
          const token = (await getPersistedAccessToken())?.trim();
          if (!token) return;
          await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          /* noop */
        }
      })();
      const otherPublicName =
        (c.other_user_public_name && String(c.other_user_public_name).trim()) ||
        (c.other_user_name && String(c.other_user_name).trim()) ||
        'Leylek kullanıcısı';
      router.push(
        buildMuhabbetChatHref(cid, {
          otherUserName: otherPublicName,
          fromText: (c.from_text && String(c.from_text)) || '',
          toText: (c.to_text && String(c.to_text)) || '',
          otherUserId: c.other_user_id ? String(c.other_user_id) : undefined,
        })
      );
    },
    [router, base]
  );

  const conversationKeyExtractor = useCallback((item: MuhabbetConversationListItem, index: number) => {
    const id = String(item.conversation_id || item.id || '').trim();
    return id.length > 0 ? id : `conversation-${index}`;
  }, []);

  const renderConversationItem = useCallback(
    ({ item }: { item: MuhabbetConversationListItem }) => (
      <ConversationListRow item={item} onOpen={openChat} onLongRemove={confirmRemoveConversation} />
    ),
    [openChat, confirmRemoveConversation]
  );

  const listHeaderEmbedded = embedded ? (
    <View style={styles.embedHeaderOuter}>
      <LinearGradient
        colors={['rgba(239,246,255,0.98)', 'rgba(255,247,237,0.96)', 'rgba(254,243,199,0.35)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.embedHeaderCard}
      >
        <LinearGradient
          colors={['#BFDBFE', '#FED7AA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.embedBadgeGrad}
        >
          <Text style={styles.embedBadgeTxt}>Eşleşen sohbetler</Text>
        </LinearGradient>
        <View style={styles.embedTitleRow}>
          <LinearGradient colors={['#2563EB', '#3B82F6']} style={styles.embedTitleIconBubble}>
            <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.embedTitle}>Sohbetler</Text>
        </View>
        <Text style={styles.embedSub}>Gelen mesajlar burada gözükecek.</Text>
      </LinearGradient>
    </View>
  ) : null;

  const listBody = (
    <>
      {!embedded && loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
        </View>
      ) : err ? (
        <View style={[styles.centeredPad, embedded && { flex: 1 }]}>
          <Text style={styles.err}>{err}</Text>
          <Text style={styles.link} onPress={() => void load()}>
            Tekrar dene
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={conversationKeyExtractor}
          style={{ flex: 1 }}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.list}
          ListHeaderComponent={embedded ? listHeaderEmbedded : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onPullRefresh()}
              tintColor={PRIMARY_GRAD[0]}
              colors={[PRIMARY_GRAD[0]]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyOuter}>
              <LinearGradient
                colors={['rgba(239,246,255,0.65)', 'rgba(255,247,237,0.75)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyCard}
              >
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbox-ellipses-outline" size={40} color="#2563EB" />
                </View>
                <Text style={styles.emptyTitle}>Henüz sohbet yok</Text>
                <Text style={styles.emptySub}>
                  Tekliflerinden eşleşme kabul edildiğinde sohbetlerin burada görünür. Talep gönder, kabul sonrası mesajlaş.
                </Text>
              </LinearGradient>
            </View>
          }
          renderItem={renderConversationItem}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <View style={[styles.embedRoot, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <MuhabbetWatermark />
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
          </View>
        ) : (
          <View style={{ flex: 1, zIndex: 1 }}>{listBody}</View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <MuhabbetWatermark />
      <ScreenHeaderGradient
        title="Sohbetler"
        onBack={() => router.back()}
        gradientColors={PRIMARY_GRAD}
      />
      <View style={{ flex: 1, zIndex: 1 }}>
        {listBody}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  embedRoot: { flex: 1, backgroundColor: SURFACE, position: 'relative' },
  embedHeaderOuter: { paddingHorizontal: 14, paddingTop: 0, paddingBottom: 0 },
  embedHeaderCard: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,130,246,0.2)',
    ...CARD_SHADOW_SOFT,
  },
  embedBadgeGrad: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  embedBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#1E3A8A', letterSpacing: 0.15 },
  embedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  embedTitleIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  embedTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: '#0F172A',
  },
  embedSub: { fontSize: 12, color: '#64748B', lineHeight: 16, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredPad: { flex: 1, justifyContent: 'center', padding: 24 },
  list: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 36 },
  emptyList: { flexGrow: 1, padding: 18 },
  err: { color: '#C00', fontSize: 15, textAlign: 'center' },
  link: { marginTop: 12, color: ACCENT, fontWeight: '600', textAlign: 'center' },
  cardSheet: {
    marginBottom: 14,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#FAFBFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E7FF',
    ...CARD_SHADOW_PREMIUM,
  },
  cardAccentBar: { height: 3, width: '100%', zIndex: 1 },
  cardBody: { paddingVertical: 15, paddingHorizontal: 16, zIndex: 1 },
  cardRowMain: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  cardTextCol: { flex: 1, minWidth: 0 },
  nameTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeCol: { alignItems: 'flex-end', gap: 5 },
  timeColPulseInner: { alignItems: 'flex-end', gap: 5 },
  timeUnreadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarRing: {
    borderRadius: 999,
    padding: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#BFDBFE',
    ...Platform.select({
      ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E5E7EB' },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { color: '#1E40AF', fontWeight: '800', fontSize: 15 },
  name: { flex: 1, fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  badgesLine: { marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rolePill: { fontSize: 11, fontWeight: '800', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, overflow: 'hidden' },
  rolePillDriver: { color: '#1E40AF', backgroundColor: 'rgba(59,130,246,0.16)' },
  rolePillPax: { color: '#C2410C', backgroundColor: 'rgba(251,146,60,0.18)' },
  matchedPill: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  pendingPill: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
    backgroundColor: 'rgba(251,191,36,0.22)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  timeRight: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '500', textAlign: 'right' },
  timeRightUnread: { color: '#1D4ED8', fontWeight: '700' },
  unreadBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  routeCompact: {
    marginTop: 8,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  previewSub: { marginTop: 6, color: '#334155', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  previewSubUnread: { color: '#1E293B', fontWeight: '700' },
  emptyOuter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 36, minHeight: 280 },
  emptyCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.25)',
    ...CARD_SHADOW_SOFT,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.3 },
  emptySub: {
    marginTop: 10,
    textAlign: 'center',
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
});
