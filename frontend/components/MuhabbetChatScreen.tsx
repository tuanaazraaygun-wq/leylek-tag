/**
 * Muhabbet 1:1 sohbet — ön görüşme; tam eşleşme Leylek Anahtar ile.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import MuhabbetWatermark from './MuhabbetWatermark';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const ORANGE_GRAD = ['#F59E0B', '#FBBF24'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

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
        colors={['#E8F4FF', '#FFF8F0', '#E8F4FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MuhabbetWatermark />
      <View style={styles.layer}>
        <ScreenHeaderGradient
          title={titleName || 'Sohbet'}
          onBack={onBack ?? (() => router.back())}
          gradientColors={PRIMARY_GRAD}
          right={headerRight}
        />
        {ctx?.matched_via_leylek_key ? (
          <View style={styles.matchStrip}>
            <Ionicons name="shield-checkmark" size={16} color="#166534" />
            <Text style={styles.matchStripTxt}>Leylek Anahtar ile eşleşme kaydı oluşturuldu</Text>
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
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={
                <View style={styles.warnCard}>
                  <Ionicons name="warning" size={20} color="#B45309" style={{ marginRight: 8 }} />
                  <Text style={styles.warnTxt}>
                    Güvenliğiniz için eşleşmeden önce buluşma noktasını, alınma noktasını, varış bilgisini ve ücreti
                    karşılıklı teyit edin. Leylek Anahtar ile eşleşme tamamlanmadan yolculuğa başlamayın. Bu alan yalnızca
                    ön görüşme içindir.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const { mine, drv } = bubbleForMsg(item);
                const time = formatMessageTimeLabel(item.created_at);
                if (mine) {
                  if (drv) {
                    return (
                      <View style={styles.bubbleColMine}>
                        <LinearGradient colors={PRIMARY_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubblePad}>
                          <Text style={styles.tMine}>{item.body || ''}</Text>
                        </LinearGradient>
                        {time ? <Text style={styles.tTimeMine}>{time}</Text> : null}
                      </View>
                    );
                  }
                  return (
                    <View style={styles.bubbleColMine}>
                      <LinearGradient colors={ORANGE_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubblePad}>
                        <Text style={styles.tMine}>{item.body || ''}</Text>
                      </LinearGradient>
                      {time ? <Text style={styles.tTimeMine}>{time}</Text> : null}
                    </View>
                  );
                }
                if (drv) {
                  return (
                    <View style={styles.bubbleColTheirs}>
                      <View style={[styles.bubbleTheirs, styles.bubbleTheirsDriver]}>
                        <Text style={styles.tTheirsD}>{item.body || ''}</Text>
                      </View>
                      {time ? <Text style={styles.tTimeTheirs}>{time}</Text> : null}
                    </View>
                  );
                }
                return (
                  <View style={styles.bubbleColTheirs}>
                    <View style={[styles.bubbleTheirs, styles.bubbleTheirsPax]}>
                      <Text style={styles.tTheirsP}>{item.body || ''}</Text>
                    </View>
                    {time ? <Text style={styles.tTimeTheirs}>{time}</Text> : null}
                  </View>
                );
              }}
            />
          )}
          <View style={styles.keyRow}>
            <Animated.View style={{ opacity: ctaPulse, width: '100%' }}>
              <Pressable onPress={openLeylekKey} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
                <LinearGradient
                  colors={['#2563EB', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.keyCta}
                >
                  <Ionicons name="key" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.keyCtaTxt}>Leylek Anahtar ile eşleş</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
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
              style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.45 }]}
            >
              <Ionicons name="send" size={22} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  layer: { flex: 1, zIndex: 1 },
  kav: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  matchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,101,52,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  matchStripTxt: { flex: 1, fontSize: 12, color: '#166534', fontWeight: '600' },
  list: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  warnCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(180,83,9,0.25)',
  },
  warnTxt: { flex: 1, fontSize: 13, color: '#713F12', lineHeight: 19, fontWeight: '500' },
  bubbleColMine: { alignSelf: 'flex-end', maxWidth: '90%', marginBottom: 8 },
  bubbleColTheirs: { alignSelf: 'flex-start', maxWidth: '90%', marginBottom: 8 },
  bubblePad: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  tMine: { color: '#fff', fontSize: 16, lineHeight: 22 },
  bubbleTheirs: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleTheirsDriver: { backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)' },
  bubbleTheirsPax: { backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' },
  tTheirsD: { color: '#1E3A5F', fontSize: 16, lineHeight: 22, fontWeight: '500' },
  tTheirsP: { color: '#7C2D12', fontSize: 16, lineHeight: 22, fontWeight: '500' },
  tTimeMine: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 },
  tTimeTheirs: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },
  keyRow: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4, backgroundColor: 'rgba(255,255,255,0.65)' },
  keyCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  keyCtaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: PRIMARY_GRAD[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
