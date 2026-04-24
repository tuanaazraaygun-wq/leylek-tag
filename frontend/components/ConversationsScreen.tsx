/**
 * Leylek Muhabbeti: sohbet listesi (conversations/me).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  other_user_role?: string | null;
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
  const [hideTarget, setHideTarget] = useState<MuhabbetConversationListItem | null>(null);
  const [hideBusy, setHideBusy] = useState(false);

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

  const runHideForConversation = useCallback(
    async (cidRaw: string) => {
      const cid = cidRaw.trim();
      if (!cid) return;
      setHideBusy(true);
      try {
        await doHide(cid);
      } finally {
        setHideBusy(false);
        setHideTarget(null);
      }
    },
    [doHide]
  );

  const onHideFromListOnly = useCallback(() => {
    const c = hideTarget;
    const cid = c ? String(c.conversation_id || c.id || '').trim() : '';
    if (!cid) {
      setHideTarget(null);
      return;
    }
    void runHideForConversation(cid);
  }, [hideTarget, runHideForConversation]);

  const onDeleteChatPressed = useCallback(() => {
    const c = hideTarget;
    const cid = c ? String(c.conversation_id || c.id || '').trim() : '';
    if (!cid) {
      setHideTarget(null);
      return;
    }
    Alert.alert(
      'Sohbeti sil',
      'Mesaj içerikleri sunucularımızda saklanmaz. Bu işlem sohbeti listenizden kaldırır.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sohbeti sil',
          style: 'destructive',
          onPress: () => void runHideForConversation(cid),
        },
      ]
    );
  }, [hideTarget, runHideForConversation]);

  const openHideModal = useCallback((c: MuhabbetConversationListItem) => {
    setHideTarget(c);
  }, []);

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
            const lastLine = last ? (last.length > 100 ? `${last.slice(0, 100)}…` : last) : 'Sohbet başlat';
            const or = (item.other_user_role || '').toLowerCase();
            const driverish = or === 'driver' || or === 'private_driver';
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  driverish ? styles.cardDriver : styles.cardPax,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={() => openChat(item)}
                onLongPress={() => openHideModal(item)}
                delayLongPress={450}
                accessibilityHint="Sohbetten kaldırmak için basılı tutun"
              >
                <View style={styles.cardRow1}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.other_user_name || 'Kullanıcı'}
                  </Text>
                  {item.last_message_at ? (
                    <Text style={styles.timeRight}>
                      {formatLastMessageListTime(String(item.last_message_at))}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.routeCompact} numberOfLines={1}>
                  {formatRouteLine(item.from_text, item.to_text)}
                </Text>
                <Text style={styles.previewSub} numberOfLines={2}>
                  {lastLine}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </>
  );

  const hideModal = (
    <Modal
      visible={!!hideTarget}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!hideBusy) setHideTarget(null);
      }}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => (hideBusy ? null : setHideTarget(null))}
        />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Sohbet</Text>
          <Text style={styles.modalBody}>
            Mesaj içerikleri sunucularımızda saklanmaz. Aşağıdaki seçenekler sohbeti yalnızca sizin listenizden kaldırır.
          </Text>
          <Pressable
            onPress={() => (hideBusy ? null : void onHideFromListOnly())}
            style={({ pressed }) => [styles.modalBtnPri, pressed && !hideBusy && { opacity: 0.9 }]}
            disabled={hideBusy}
          >
            {hideBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.modalBtnPriTxt}>Listemden gizle</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => (hideBusy ? null : void onDeleteChatPressed())}
            style={({ pressed }) => [styles.modalBtnDanger, pressed && !hideBusy && { opacity: 0.9 }]}
            disabled={hideBusy}
          >
            <Text style={styles.modalBtnDangerTxt}>Sohbeti sil</Text>
          </Pressable>
          <Pressable
            onPress={() => (hideBusy ? null : setHideTarget(null))}
            style={({ pressed }) => [styles.modalBtnSec, pressed && { opacity: 0.88 }]}
            disabled={hideBusy}
          >
            <Text style={styles.modalBtnSecTxt}>Vazgeç</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
        {hideModal}
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
        {hideModal}
      </View>
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
  list: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36 },
  emptyList: { flexGrow: 1, padding: 18 },
  err: { color: '#C00', fontSize: 15, textAlign: 'center' },
  link: { marginTop: 12, color: ACCENT, fontWeight: '600', textAlign: 'center' },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  cardDriver: { borderLeftWidth: 4, borderLeftColor: '#2563EB', backgroundColor: '#F0F7FF' },
  cardPax: { borderLeftWidth: 4, borderLeftColor: '#EA580C', backgroundColor: '#FFFAF0' },
  cardRow1: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  timeRight: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '500', marginTop: 1 },
  routeCompact: { marginTop: 6, color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },
  previewSub: { marginTop: 6, color: '#4B5563', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
  emptySub: { marginTop: 8, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 15, lineHeight: 22, paddingHorizontal: 12 },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    zIndex: 2,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  modalBody: { marginTop: 10, fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22 },
  modalBtnPri: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: PRIMARY_GRAD[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPriTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalBtnDanger: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,38,38,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDangerTxt: { fontSize: 16, fontWeight: '700', color: '#B91C1C' },
  modalBtnSec: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(60,60,67,0.1)',
    alignItems: 'center',
  },
  modalBtnSecTxt: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
