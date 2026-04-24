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
  deleted_at?: string | null;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);

  const keyboardOffset = insets.top + (Platform.OS === 'ios' ? 52 : 12);

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

  const softDelete = async (messageId: string) => {
    if (!cid || !messageId) return;
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    setDeletingId(messageId);
    try {
      const res = await fetch(
        `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages/${encodeURIComponent(messageId)}/delete`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      if (handleUnauthorizedAndMaybeRedirect(res)) return;
      const d = (await res.json().catch(() => ({}))) as { success?: boolean; message?: ChatMessageRow };
      if (res.ok && d.success && d.message) {
        setRows((prev) => prev.map((m) => (m.id === messageId ? (d.message as ChatMessageRow) : m)));
      } else {
        void load();
      }
    } catch {
      void load();
    } finally {
      setDeletingId(null);
    }
  };

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
            renderItem={({ item }) => {
              const mine = myId && String(item.sender_user_id || '').toLowerCase() === myId;
              const del = item.deleted_at;
              return (
                <View style={[styles.bubbleCol, mine ? styles.bubbleColMine : styles.bubbleColTheirs]}>
                  <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                    {del ? (
                      <View style={styles.bubbleDeleted}>
                        <Text style={styles.bubbleDeletedText}>Bu mesaj silindi</Text>
                      </View>
                    ) : mine ? (
                      <LinearGradient colors={[...PRIMARY_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
                        <Text style={styles.bubbleTextMine}>{item.body || ''}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.bubbleTheirs}>
                        <Text style={styles.bubbleTextTheirs}>{item.body || ''}</Text>
                      </View>
                    )}
                    {mine && !del ? (
                      <Pressable
                        onPress={() => void softDelete(item.id)}
                        disabled={deletingId === item.id}
                        style={({ pressed }) => [styles.delBtn, pressed && { opacity: 0.6 }]}
                        hitSlop={8}
                        accessibilityLabel="Mesajı sil"
                      >
                        <Ionicons name="trash-outline" size={16} color={TEXT_SECONDARY} />
                      </Pressable>
                    ) : null}
                  </View>
                  {item.created_at ? (
                    <Text style={[styles.timeLbl, mine ? styles.timeLblMine : styles.timeLblTheirs]}>
                      {formatMessageTimeLabel(item.created_at)}
                    </Text>
                  ) : null}
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
  kav: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  bubbleCol: { marginBottom: 10, maxWidth: '92%' },
  bubbleColMine: { alignSelf: 'flex-end' },
  bubbleColTheirs: { alignSelf: 'flex-start' },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubbleWrapMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse', justifyContent: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start' },
  delBtn: { padding: 4, marginBottom: 2 },
  timeLbl: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },
  timeLblMine: { textAlign: 'right', alignSelf: 'flex-end' },
  timeLblTheirs: { textAlign: 'left', alignSelf: 'flex-start' },
  bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, maxWidth: '100%' },
  bubbleTheirs: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#E5E7EB',
    maxWidth: '100%',
  },
  bubbleDeleted: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(60,60,67,0.08)',
  },
  bubbleDeletedText: { fontSize: 13, color: TEXT_SECONDARY, fontStyle: 'italic' },
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
