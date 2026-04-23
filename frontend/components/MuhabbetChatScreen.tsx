/**
 * Muhabbet 1:1 sohbet — kabul sonrası (GET/POST .../conversations/{id}/messages).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

export type ChatMessageRow = {
  id: string;
  body?: string | null;
  sender_user_id?: string | null;
  created_at?: string | null;
};

export type MuhabbetChatScreenProps = {
  apiBaseUrl: string;
  conversationId: string;
  titleName?: string;
  otherUserId?: string;
  onBack?: () => void;
};

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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);

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
        return;
      }
      const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows([]);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; messages?: ChatMessageRow[] };
      if (res.ok && d.success && Array.isArray(d.messages)) setRows(d.messages);
      else setRows([]);
    } catch {
      setRows([]);
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
    const ou = (otherUserId || '').trim();
    if (!ou) return;
    router.push(`/muhabbet-profile/${encodeURIComponent(ou)}` as Href);
  }, [otherUserId, router]);

  const headerRight =
    otherUserId && otherUserId.trim() ? (
      <Pressable onPress={openOtherProfile} style={styles.headerIcon} accessibilityRole="button">
        <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
      </Pressable>
    ) : null;

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <ScreenHeaderGradient
        title={titleName || 'Sohbet'}
        onBack={onBack ?? (() => router.back())}
        gradientColors={PRIMARY_GRAD}
        right={headerRight}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
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
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = myId && String(item.sender_user_id || '').toLowerCase() === myId;
              return (
                <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                  {mine ? (
                    <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
                      <Text style={styles.bubbleTextMine}>{item.body || ''}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.bubbleTheirs}>
                      <Text style={styles.bubbleTextTheirs}>{item.body || ''}</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 8 },
  bubbleWrap: { marginVertical: 4, maxWidth: '88%' },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleTheirs: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#E5E7EB',
  },
  bubbleTextMine: { color: '#fff', fontSize: 16, lineHeight: 22 },
  bubbleTextTheirs: { color: TEXT_PRIMARY, fontSize: 16, lineHeight: 22 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.12)',
    backgroundColor: '#fff',
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
