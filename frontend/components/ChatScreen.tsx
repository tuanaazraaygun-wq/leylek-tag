/**
 * Leylek Muhabbeti: 1-1 sohbet (conversations messages).
 * Benim balon: sağ, mavi gradient; karşı: sol, beyaz.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ACCENT = '#F59E0B';
const SURFACE = '#F2F2F7';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const BUBBLE_THEIRS = '#FFFFFF';

export type ChatMessageRow = {
  id: string;
  body?: string;
  sender_user_id?: string;
  created_at: string;
  /** API’de yok: optimistic anında true */
  pending?: boolean;
};

export type ChatScreenProps = {
  apiBaseUrl: string;
  conversationId: string;
  initialOtherUserName?: string;
  initialFromText?: string;
  initialToText?: string;
};

function formatMsgTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

async function getMyUserId(): Promise<string | null> {
  const raw = await getPersistedUserRaw();
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { id?: string };
    return u.id ? String(u.id).trim() : null;
  } catch {
    return null;
  }
}

export default function ChatScreen({
  apiBaseUrl,
  conversationId: cidProp,
  initialOtherUserName = '',
  initialFromText = '',
  initialToText = '',
}: ChatScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const base = apiBaseUrl.replace(/\/$/, '');
  const conversationId = (cidProp || '').trim();

  const [me, setMe] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState(initialOtherUserName || 'Sohbet');
  const [subFrom, setSubFrom] = useState(initialFromText);
  const [subTo, setSubTo] = useState(initialToText);
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setMe(await getMyUserId()))();
  }, []);

  const loadMetaFromMe = useCallback(
    async (token: string) => {
      if (initialOtherUserName && initialFromText && initialToText) return;
      try {
        const r = await fetch(`${base}/muhabbet/conversations/me?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (handleUnauthorizedAndMaybeRedirect(r)) return;
        const d = (await r.json().catch(() => ({}))) as { success?: boolean; conversations?: Record<string, unknown>[] };
        if (!r.ok || !d.success || !Array.isArray(d.conversations)) return;
        const c = d.conversations.find(
          (x) => String(x.conversation_id || x.id || '').toLowerCase() === conversationId.toLowerCase()
        );
        if (!c) return;
        if (!initialOtherUserName) setHeaderName((c.other_user_name as string) || 'Sohbet');
        if (!initialFromText) setSubFrom((c.from_text as string) || '');
        if (!initialToText) setSubTo((c.to_text as string) || '');
      } catch {
        /* */
      }
    },
    [base, conversationId, initialFromText, initialOtherUserName, initialToText]
  );

  const loadMessages = useCallback(
    async (token: string) => {
      const r = await fetch(
        `${base}/muhabbet/conversations/${encodeURIComponent(conversationId)}/messages?limit=200&offset=0`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (handleUnauthorizedAndMaybeRedirect(r)) {
        setMsgs([]);
        return;
      }
      const d = (await r.json().catch(() => ({}))) as { success?: boolean; messages?: ChatMessageRow[]; detail?: string };
      if (!r.ok || !d.success) {
        setErr(typeof d.detail === 'string' ? d.detail : 'Mesajlar yüklenemedi.');
        setMsgs([]);
        return;
      }
      setErr(null);
      setMsgs(Array.isArray(d.messages) ? d.messages : []);
    },
    [base, conversationId]
  );

  const onRefreshMessages = useCallback(async () => {
    if (!conversationId) return;
    setRefreshing(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;
      await loadMetaFromMe(token);
      await loadMessages(token);
    } finally {
      setRefreshing(false);
    }
  }, [conversationId, loadMessages, loadMetaFromMe]);

  const init = useCallback(async () => {
    if (!conversationId) {
      setErr('Geçersiz sohbet.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setErr('Oturum gerekli.');
        setLoading(false);
        return;
      }
      await Promise.all([loadMetaFromMe(token), loadMessages(token)]);
    } catch {
      setErr('Yükleme hatası.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, loadMessages, loadMetaFromMe]);

  useEffect(() => {
    void init();
  }, [init]);

  const subtitle =
    (subFrom && subTo) || subFrom
      ? `${(subFrom || '—').trim()} → ${(subTo || '—').trim()}`
      : 'Güzergahı bil';

  const onSend = async () => {
    const body = input.trim();
    if (!body || !conversationId || sending) return;
    let myId = me;
    if (!myId) {
      myId = await getMyUserId();
      if (myId) setMe(myId);
    }
    if (!myId) {
      setErr('Kullanıcı bilgisi alınamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageRow = {
      id: tempId,
      body,
      sender_user_id: myId,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMsgs((m) => [...m, optimistic]);
    setInput('');
    setErr(null);

    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setMsgs((m) => m.filter((x) => x.id !== tempId));
        setInput(body);
        setErr('Oturum gerekli.');
        return;
      }
      const r = await fetch(
        `${base}/muhabbet/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        }
      );
      if (handleUnauthorizedAndMaybeRedirect(r)) {
        setMsgs((m) => m.filter((x) => x.id !== tempId));
        setInput(body);
        return;
      }
      const d = (await r.json().catch(() => ({}))) as { success?: boolean; message?: ChatMessageRow; detail?: string };
      if (!r.ok || !d.success || !d.message) {
        setMsgs((m) => m.filter((x) => x.id !== tempId));
        setInput(body);
        setErr(typeof d.detail === 'string' && d.detail ? d.detail : 'Gönderilemedi.');
        return;
      }
      setMsgs((m) => {
        const without = m.filter((x) => x.id !== tempId);
        return [...without, { ...d.message!, pending: false }];
      });
      await loadMessages(token);
    } catch {
      setMsgs((m) => m.filter((x) => x.id !== tempId));
      setInput(body);
      setErr('Gönderim hatası.');
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) {
    return (
      <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
        <ScreenHeaderGradient title="Sohbet" onBack={() => router.back()} gradientColors={PRIMARY_GRAD} />
        <View style={styles.centered}>
          <Text style={styles.errBanner}>Sohbet bulunamadı.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <ScreenHeaderGradient
        title={headerName}
        subtitle={subtitle}
        onBack={() => router.back()}
        gradientColors={PRIMARY_GRAD}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
          </View>
        ) : (
          <>
            <FlatList
              data={msgs}
              keyExtractor={(m) => m.id}
              contentContainerStyle={[
                styles.listContent,
                msgs.length === 0 && { flexGrow: 1, justifyContent: 'center' },
                { paddingBottom: 8 + insets.bottom },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void onRefreshMessages()}
                  tintColor={PRIMARY_GRAD[0]}
                  colors={[PRIMARY_GRAD[0]]}
                />
              }
              ListEmptyComponent={
                <View style={styles.welcome}>
                  <Text style={styles.welcomeText}>Artık konuşabilirsiniz 👋</Text>
                  {err ? <Text style={styles.errSub}>{err}</Text> : null}
                </View>
              }
              ListHeaderComponent={
                msgs.length > 0 && err ? (
                  <Text style={styles.bannerErr}>{err}</Text>
                ) : null
              }
              renderItem={({ item }) => {
                const mine = !!(me && item.sender_user_id && String(item.sender_user_id) === me);
                return (
                  <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                    {mine ? (
                      <View style={styles.bubbleGradWrap}>
                        <LinearGradient
                          colors={[...PRIMARY_GRAD]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.bubbleGrad}
                        >
                          <Text style={styles.bubbleTextMine}>{(item.body || '').trim()}</Text>
                          <View style={styles.timeRow}>
                            {item.pending ? (
                              <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" style={{ marginRight: 4 }} />
                            ) : null}
                            <Text style={styles.bubbleTimeMine}>{formatMsgTime(item.created_at)}</Text>
                          </View>
                        </LinearGradient>
                      </View>
                    ) : (
                      <View style={styles.bubbleTheirsShell}>
                        <Text style={styles.bubbleTextTheirs}>{(item.body || '').trim()}</Text>
                        <Text style={styles.bubbleTimeTheirs}>{formatMsgTime(item.created_at)}</Text>
                      </View>
                    )}
                  </View>
                );
              }}
            />
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Mesaj yaz…"
                placeholderTextColor={TEXT_SECONDARY}
                maxLength={1000}
                multiline
                editable={!sending}
              />
              <Pressable
                onPress={() => void onSend()}
                disabled={sending || !input.trim()}
                style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.45 }]}
              >
                <LinearGradient
                  colors={[...PRIMARY_GRAD]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.sendInner}>
                  {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={22} color="#fff" />}
                </View>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 12, paddingTop: 12 },
  welcome: { alignItems: 'center', padding: 24 },
  welcomeText: { fontSize: 17, color: TEXT_PRIMARY, textAlign: 'center', lineHeight: 24 },
  errSub: { color: ACCENT, marginTop: 8, textAlign: 'center' },
  errBanner: { color: '#B00020' },
  bannerErr: { color: '#B00020', textAlign: 'center', marginBottom: 8, fontSize: 13 },
  bubbleRow: { marginBottom: 10, width: '100%' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubbleRowTheirs: { alignItems: 'flex-start' },
  bubbleGradWrap: { maxWidth: '88%', borderRadius: 18, overflow: 'hidden' },
  bubbleGrad: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleTheirsShell: {
    maxWidth: '88%',
    backgroundColor: BUBBLE_THEIRS,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.1)',
  },
  bubbleTextMine: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '500' },
  bubbleTextTheirs: { color: TEXT_PRIMARY, fontSize: 16, lineHeight: 22 },
  timeRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
  bubbleTimeMine: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  bubbleTimeTheirs: { marginTop: 4, fontSize: 11, color: TEXT_SECONDARY, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.2)', backgroundColor: SURFACE },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: TEXT_PRIMARY, marginRight: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(60,60,67,0.12)' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  sendInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
