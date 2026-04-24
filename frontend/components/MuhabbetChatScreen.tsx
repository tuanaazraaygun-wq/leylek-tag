/**
 * Muhabbet 1:1 sohbet — ön görüşme; tam eşleşme Leylek Anahtar ile.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { getOrCreateSocket } from '../contexts/SocketContext';
import MuhabbetWatermark from './MuhabbetWatermark';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
/** Sürücü / yolcu balon — istenen gradientler */
const DRIVER_BUBBLE_GRAD = ['#4facfe', '#00f2fe'] as const;
const PAX_BUBBLE_GRAD = ['#f7971e', '#ffd200'] as const;
const SEND_BTN_GRAD = ['#4facfe', '#00f2fe'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

const BUBBLE_SHADOW = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  android: { elevation: 3 },
  default: {},
});

export type ChatMessageRow = {
  id: string;
  body?: string | null;
  sender_user_id?: string | null;
  created_at?: string | null;
};

export type ChatContext = {
  other_user_id?: string;
  my_role?: string | null;
  other_role?: string | null;
  matched_via_leylek_key?: boolean;
  matched_at?: string | null;
};

export type MuhabbetChatScreenProps = {
  apiBaseUrl: string;
  conversationId: string;
  titleName?: string;
  otherUserId?: string;
  onBack?: () => void;
};

function formatMessageTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameCalDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameCalDay) {
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isDriverAppRole(r: string | null | undefined): boolean {
  const x = (r || '').toLowerCase();
  return x === 'driver' || x === 'private_driver';
}

export default function MuhabbetChatScreen({
  apiBaseUrl,
  conversationId,
  titleName,
  otherUserId,
  onBack,
}: MuhabbetChatScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const base = apiBaseUrl.replace(/\/$/, '');
  const cid = (conversationId || '').trim();

  const [myId, setMyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ChatMessageRow[]>([]);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pairRequestLoading, setPairRequestLoading] = useState(false);
  const pairRequestBusyRef = useRef(false);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const ctaPulse = useRef(new Animated.Value(1)).current;

  const keyboardOffset = insets.top + (Platform.OS === 'ios' ? 52 : 12);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 0.94,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [ctaPulse]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw || cancelled) return;
        const u = JSON.parse(raw) as { id?: string };
        if (u?.id) setMyId(String(u.id).trim().toLowerCase());
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setRows([]);
        setCtx(null);
        return;
      }
      const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows([]);
        setCtx(null);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        messages?: ChatMessageRow[];
        context?: ChatContext;
      };
      if (res.ok && d.success && Array.isArray(d.messages)) {
        setRows(d.messages);
        setCtx(d.context || null);
      } else {
        setRows([]);
        setCtx(null);
      }
    } catch {
      setRows([]);
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [base, cid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!cid) return;
    const s = getOrCreateSocket();
    const onMatch = (data: { conversation_id?: string }) => {
      const m = data?.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
      if (m && m === cid.toLowerCase()) void load();
    };
    s.on('leylek_key_match_completed', onMatch);
    return () => {
      s.off('leylek_key_match_completed', onMatch);
    };
  }, [cid, load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !cid) return;
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageRow = {
      id: tempId,
      body,
      sender_user_id: myId,
      created_at: new Date().toISOString(),
    };
    setRows((prev) => [...prev, optimistic]);
    setDraft('');
    setSending(true);
    try {
      const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; message?: ChatMessageRow; detail?: string };
      if (!res.ok || !d.success || !d.message) {
        setRows((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      setRows((prev) => {
        const rest = prev.filter((m) => m.id !== tempId);
        return [...rest, d.message as ChatMessageRow];
      });
    } catch {
      setRows((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const openOtherProfile = useCallback(() => {
    const ou = (otherUserId || ctx?.other_user_id || '').trim();
    if (!ou) return;
    router.push(`/muhabbet-profile/${encodeURIComponent(ou)}` as Href);
  }, [otherUserId, ctx, router]);

  const openLeylekKey = useCallback(() => {
    router.push('/leylek-anahtar' as Href);
  }, [router]);

  const sendLeylekPairRequest = useCallback(async () => {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token || !cid || pairRequestBusyRef.current) return;
    pairRequestBusyRef.current = true;
    setPairRequestLoading(true);
    try {
      const res = await fetch(
        `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/leylek-pair-request`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      const d = (await res.json().catch(() => ({}))) as {
        detail?: string;
        message?: string;
        pending?: boolean;
      };
      if (res.status === 429) {
        Alert.alert('Çok sık istek', typeof d.detail === 'string' ? d.detail : 'Lütfen kısa bir süre sonra tekrar deneyin.');
        return;
      }
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      if (!res.ok) {
        Alert.alert('İstek gönderilemedi', typeof d.detail === 'string' ? d.detail : 'Tekrar deneyin.');
        return;
      }
      if (d.pending) {
        Alert.alert('Bekleyen istek', d.message || 'Zaten bir eşleşme isteğiniz var.');
        return;
      }
      Alert.alert('Gönderildi', d.message || 'Karşı taraf onaylarsa eşleşme tamamlanır.');
    } catch {
      Alert.alert('Bağlantı hatası', 'İnternet bağlantınızı kontrol edin.');
    } finally {
      pairRequestBusyRef.current = false;
      setPairRequestLoading(false);
    }
  }, [base, cid]);

  const profileTarget = (otherUserId || ctx?.other_user_id || '').trim();
  const headerRight = profileTarget ? (
    <Pressable onPress={openOtherProfile} style={styles.headerIcon} accessibilityRole="button">
      <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
    </Pressable>
  ) : null;

  const myR = (ctx?.my_role || '').toLowerCase();
  const oR = (ctx?.other_role || '').toLowerCase();

  const bubbleForMsg = (item: ChatMessageRow) => {
    const mine = myId && String(item.sender_user_id || '').toLowerCase() === myId;
    const sr = mine ? myR : oR;
    const drv = isDriverAppRole(sr);
    return { mine, drv };
  };

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <LinearGradient
        colors={['#F5F7FA', '#E8EEF5', '#FAF6F0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.wmWrap} pointerEvents="none">
        <MuhabbetWatermark />
      </View>
      <View style={styles.layer}>
        <ScreenHeaderGradient
          title={titleName || 'Sohbet'}
          onBack={onBack ?? (() => router.back())}
          gradientColors={PRIMARY_GRAD}
          right={headerRight}
        />
        {ctx?.matched_via_leylek_key ? (
          <View style={styles.matchStrip}>
            <View style={styles.matchBadge}>
              <Ionicons name="shield-checkmark" size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.matchBadgeTxt} numberOfLines={2}>
                Leylek Anahtar ile eşleşme tamamlandı
              </Text>
            </View>
          </View>
        ) : null}
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={
                <View style={styles.warnCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#B45309" style={{ marginRight: 8 }} />
                  <Text style={styles.warnTxt}>
                    Yolculuğa başlamadan önce bilgileri doğrulayın. Leylek Anahtar ile eşleşmeden hareket etmeyin.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const { mine, drv } = bubbleForMsg(item);
                const time = formatMessageTimeLabel(item.created_at);
                if (mine) {
                  const g = drv ? DRIVER_BUBBLE_GRAD : PAX_BUBBLE_GRAD;
                  return (
                    <View style={styles.bubbleColMine}>
                      <View style={[styles.bubbleShadowWrap, styles.bubbleAlignEnd]}>
                        <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubblePad}>
                          <Text style={styles.tGrad}>{item.body || ''}</Text>
                        </LinearGradient>
                      </View>
                      {time ? <Text style={styles.tTimeMine}>{time}</Text> : null}
                    </View>
                  );
                }
                const g2 = drv ? DRIVER_BUBBLE_GRAD : PAX_BUBBLE_GRAD;
                return (
                  <View style={styles.bubbleColTheirs}>
                    <View style={[styles.bubbleShadowWrap, styles.bubbleAlignStart]}>
                      <LinearGradient colors={g2} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubblePad}>
                        <Text style={styles.tGrad}>{item.body || ''}</Text>
                      </LinearGradient>
                    </View>
                    {time ? <Text style={styles.tTimeTheirs}>{time}</Text> : null}
                  </View>
                );
              }}
            />
          )}
          <View style={styles.keyRow}>
            <Animated.View style={{ opacity: ctaPulse, width: '100%' }}>
              <View style={styles.keyCtaGlow}>
                <Pressable
                  onPress={() => void sendLeylekPairRequest()}
                  disabled={pairRequestLoading}
                  style={({ pressed }) => [pressed && !pairRequestLoading && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel="Leylek Anahtar ile eşleşme isteği gönder"
                >
                  <LinearGradient
                    colors={['#6366F1', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.keyCta, pairRequestLoading && { opacity: 0.75 }]}
                  >
                    {pairRequestLoading ? (
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    ) : (
                      <Ionicons name="key" size={18} color="#fff" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.keyCtaTxt}>
                      {pairRequestLoading ? 'Gönderiliyor…' : 'Leylek Anahtar ile eşleş'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
            <Pressable onPress={openLeylekKey} style={styles.keyCodeLink} hitSlop={8}>
              <Text style={styles.keyCodeLinkTxt}>Anahtar kodunu kendin girmek için tıkla</Text>
            </Pressable>
          </View>
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Mesaj yaz…"
              placeholderTextColor={TEXT_SECONDARY}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={() => void send()}
              disabled={sending || !draft.trim()}
              style={({ pressed }) => [
                styles.sendBtnWrap,
                (!draft.trim() || sending) && { opacity: 0.4 },
                pressed && draft.trim() && !sending && { opacity: 0.9, transform: [{ scale: 0.96 }] },
              ]}
            >
              <LinearGradient
                colors={SEND_BTN_GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnGrad}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="arrow-up" size={22} color="#fff" />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF1F5' },
  wmWrap: { ...StyleSheet.absoluteFillObject, opacity: 0.4, zIndex: 0 },
  layer: { flex: 1, zIndex: 1 },
  kav: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  matchStrip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    maxWidth: '96%',
    ...Platform.select({
      ios: {
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  matchBadgeTxt: { flex: 1, fontSize: 13, color: '#fff', fontWeight: '700', lineHeight: 18 },
  list: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  warnCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(180,83,9,0.2)',
  },
  warnTxt: { flex: 1, fontSize: 13, color: '#713F12', lineHeight: 19, fontWeight: '500' },
  bubbleColMine: { alignSelf: 'flex-end', maxWidth: '90%', marginBottom: 8 },
  bubbleColTheirs: { alignSelf: 'flex-start', maxWidth: '90%', marginBottom: 8 },
  bubbleShadowWrap: { ...BUBBLE_SHADOW, borderRadius: 18, maxWidth: '100%' },
  bubbleAlignEnd: { alignSelf: 'flex-end' },
  bubbleAlignStart: { alignSelf: 'flex-start' },
  bubblePad: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  tGrad: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  tTimeMine: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 },
  tTimeTheirs: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },
  keyRow: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4, backgroundColor: 'rgba(255,255,255,0.72)' },
  keyCtaGlow: {
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  keyCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  keyCtaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  keyCodeLink: { alignSelf: 'center', marginTop: 6, marginBottom: 2, paddingVertical: 4 },
  keyCodeLinkTxt: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.1)',
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: TEXT_PRIMARY,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  sendBtnWrap: { borderRadius: 22, overflow: 'hidden', ...BUBBLE_SHADOW },
  sendBtnGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
