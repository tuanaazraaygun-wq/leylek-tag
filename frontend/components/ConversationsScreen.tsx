/**
 * Leylek Muhabbeti: sohbet listesi (conversations/me).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import MuhabbetWatermark from './MuhabbetWatermark';
import { getPersistedAccessToken } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ACCENT = '#F59E0B';
const SURFACE = '#F2F2F7';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6 },
  android: { elevation: 2 },
  default: {},
});

export type MuhabbetConversationListItem = {
  conversation_id?: string;
  id?: string;
  other_user_id?: string;
  other_user_name?: string;
  from_text?: string | null;
  to_text?: string | null;
  last_message_body?: string | null;
  last_message_at?: string | null;
  request_status?: string | null;
  created_at?: string;
};

export type ConversationsScreenProps = {
  /** `.../api` sonlu kök (ör. API_BASE_URL) */
  apiBaseUrl: string;
  /** full: geri + tam ekran; embedded: sekme içi liste */
  variant?: 'full' | 'embedded';
  /** Yalnızca kabul edilmiş eşleşme sohbetleri (Sohbetler sekmesi) */
  onlyAccepted?: boolean;
  /** Üst bileşen yenilemesinde listeyi tekrar çek */
  refreshNonce?: number;
};

function formatRouteLine(from: string | null | undefined, to: string | null | undefined): string {
  return `${(from && String(from).trim()) || '—'} → ${(to && String(to).trim()) || '—'}`;
}

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

/** Muhabbet sohbet ekranı deep link (Ana sayfa önizlemesi vb. ile paylaşılır). */
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
}: ConversationsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const base = apiBaseUrl.replace(/\/$/, '');
  const embedded = variant === 'embedded';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<MuhabbetConversationListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    if (!embedded) setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setErr('Oturum bulunamadı.');
        setRows([]);
        return;
      }
      const res = await fetch(`${base}/muhabbet/conversations/me?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows([]);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        conversations?: MuhabbetConversationListItem[];
        detail?: string;
      };
      if (!res.ok || !data.success) {
        setErr(typeof data.detail === 'string' && data.detail ? data.detail : 'Liste yüklenemedi.');
        setRows([]);
        return;
      }
      let list = Array.isArray(data.conversations) ? data.conversations : [];
      if (onlyAccepted) {
        list = list.filter((c) => (c.request_status || '').toLowerCase() === 'accepted');
      }
      setRows(list);
    } catch {
      setErr('Bağlantı hatası.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base, embedded, onlyAccepted]);

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openChat = (c: MuhabbetConversationListItem) => {
    const cid = String(c.conversation_id || c.id || '').trim();
    if (!cid) return;
    router.push(
      buildMuhabbetChatHref(cid, {
        otherUserName: c.other_user_name || 'Kullanıcı',
        fromText: (c.from_text && String(c.from_text)) || '',
        toText: (c.to_text && String(c.to_text)) || '',
        otherUserId: c.other_user_id ? String(c.other_user_id) : undefined,
      })
    );
  };

  const listHeaderEmbedded = embedded ? (
    <View style={styles.embedHeader}>
      <Text style={styles.embedTitle}>Sohbetler</Text>
      <Text style={styles.embedSub}>Kabul edilen teklifler sonrası sohbet burada görünür.</Text>
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
          keyExtractor={(item, i) => String(item.conversation_id || item.id || i)}
          style={{ flex: 1 }}
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
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Henüz sohbet yok</Text>
              <Text style={styles.emptySub}>
                Kabul edilen teklifler sonrası sohbet burada listelenir. Teklifler sekmesinden talep gönder, kabul sonrası mesajlaş.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const last = (item.last_message_body && String(item.last_message_body).trim()) || '';
            const lastLine = last ? (last.length > 80 ? `${last.slice(0, 80)}…` : last) : 'Sohbet başlat';
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                onPress={() => openChat(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.other_user_name || 'Kullanıcı'}
                  </Text>
                  {item.last_message_at ? (
                    <Text style={styles.timeSmall}>
                      {formatLastMessageListTime(String(item.last_message_at))}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.route} numberOfLines={1}>
                  {formatRouteLine(item.from_text, item.to_text)}
                </Text>
                <Text style={styles.preview} numberOfLines={2}>
                  {lastLine}
                </Text>
              </Pressable>
            );
          }}
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
      <View style={{ flex: 1, zIndex: 1 }}>{listBody}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  embedRoot: { flex: 1, backgroundColor: SURFACE, position: 'relative' },
  embedHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  embedTitle: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  embedSub: { marginTop: 6, fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredPad: { flex: 1, justifyContent: 'center', padding: 24 },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, padding: 16 },
  err: { color: '#C00', fontSize: 15, textAlign: 'center' },
  link: { marginTop: 12, color: ACCENT, fontWeight: '600', textAlign: 'center' },
  card: { backgroundColor: CARD_BG, borderRadius: 18, padding: 16, marginBottom: 10, ...CARD_SHADOW },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY },
  timeSmall: { fontSize: 12, color: TEXT_SECONDARY },
  route: { marginTop: 4, color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  preview: { marginTop: 8, color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21, opacity: 0.9 },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
  emptySub: { marginTop: 8, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 15, lineHeight: 22, paddingHorizontal: 12 },
});
