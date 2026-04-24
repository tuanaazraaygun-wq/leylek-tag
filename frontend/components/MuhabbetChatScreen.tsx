/**
 * Muhabbet 1:1 sohbet — mesaj içeriği sunucuda tutulmaz; yalnızca Socket.IO ile odaya yayın.
 * REST mesaj endpoint’leri devre dışı; bağlam (roller, eşleşme) GET ile alınır.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  __DEV__,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import type { Socket } from 'socket.io-client';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import { getOrCreateSocket } from '../contexts/SocketContext';
import { notifyAuthTokenBecameAvailableForSocket } from '../lib/socketRegisterScheduler';
import { subscribeSocketSessionRefresh } from '../lib/socketSessionRefresh';
import MuhabbetWatermark from './MuhabbetWatermark';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
/** Sürücü / yolcu balon — istenen gradientler */
const DRIVER_BUBBLE_GRAD = ['#4facfe', '#00f2fe'] as const;
const PAX_BUBBLE_GRAD = ['#f7971e', '#ffd200'] as const;
const SEND_BTN_GRAD = ['#4facfe', '#00f2fe'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

/** Muhabbet mesaj satırı — sunucu DB tutmaz; id istemci UUID veya socket message_id. */
export type OutMessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';

function newClientMessageUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  /** Giden mesaj: gönderim / okundu bilgisi */
  out_status?: OutMessageStatus;
};

export type ChatContext = {
  other_user_id?: string;
  my_role?: string | null;
  other_role?: string | null;
  matched_via_leylek_key?: boolean;
  matched_at?: string | null;
  /** Sunucu geçmiş mesaj tutmaz */
  ephemeral_chat?: boolean;
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

function DeliveryTicks({ status }: { status: OutMessageStatus }) {
  if (status === 'sending') {
    return <Ionicons name="time-outline" size={14} color="#9CA3AF" style={{ marginLeft: 3 }} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle-outline" size={16} color="#DC2626" style={{ marginLeft: 3 }} />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={15} color="#9CA3AF" style={{ marginLeft: 3 }} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done-outline" size={15} color="#6B7280" style={{ marginLeft: 3 }} />;
  }
  if (status === 'seen') {
    return <Ionicons name="checkmark-done" size={15} color="#3B82F6" style={{ marginLeft: 3 }} />;
  }
  return null;
}

/**
 * Bir sonraki `registered` success ack’ini bekle (kısayol yok).
 * Reconnect’te Context ref’i gecikince “zaten kayıtlı” sanılıp join atlanmasını önler.
 */
function waitForNextRegisterSuccess(socket: Socket, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(tid);
      socket.off('registered', onReg);
      resolve(ok);
    };
    const tid = setTimeout(() => finish(false), timeoutMs);
    const onReg = (data: { success?: boolean }) => {
      if (data?.success === true) finish(true);
    };
    socket.on('registered', onReg);
    notifyAuthTokenBecameAvailableForSocket();
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
  const myIdRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ChatMessageRow[]>([]);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pairRequestLoading, setPairRequestLoading] = useState(false);
  const pairRequestBusyRef = useRef(false);
  /** İstemci tarafı 60 sn eşleşme isteği aralığı (sunucu cooldown ile uyumlu) */
  const lastLeylekPairRequestAtRef = useRef(0);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const ctaPulse = useRef(new Animated.Value(1)).current;
  /** Sohbet odası (joined_muhabbet) — mesaj almak için gerekli */
  const [roomJoined, setRoomJoined] = useState(false);
  const roomJoinedRef = useRef(false);
  /** Ekran mount / unmount: açıkken message_seen gönder */
  const chatSessionActiveRef = useRef(true);
  /** message_id -> 8 sn ack bekleme (timeout iptali onAck’te) */
  const ackTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const keyboardOffset = insets.top + (Platform.OS === 'ios' ? 52 : 12);

  const clearAckWait = useCallback((messageId: string) => {
    const t = ackTimeoutsRef.current.get(messageId);
    if (t) clearTimeout(t);
    ackTimeoutsRef.current.delete(messageId);
  }, []);

  const emitJoinForChat = useCallback(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    if (!socket.connected) return;
    notifyAuthTokenBecameAvailableForSocket();
    console.log('[chat] join emitted', cid);
    socket.emit('join_muhabbet_conversation', { conversation_id: cid });
  }, [cid]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

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
        if (u?.id) {
          const lo = String(u.id).trim().toLowerCase();
          myIdRef.current = lo;
          setMyId(lo);
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Sadece rol / eşleşme bağlamı; mesaj geçmişi API'den gelmez. */
  const loadContext = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setRows([]);
        setCtx(null);
        return;
      }
      const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleUnauthorizedAndMaybeRedirect(res)) {
        setRows([]);
        setCtx(null);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        context?: ChatContext;
      };
      if (res.ok && d.success) {
        setCtx(d.context || null);
        setRows([]);
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
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!cid) return;
    const s = getOrCreateSocket();
    const onMatch = (data: { conversation_id?: string }) => {
      const m = data?.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
      if (m && m === cid.toLowerCase()) void loadContext();
    };
    s.on('leylek_key_match_completed', onMatch);
    s.on('leylek_pair_match_completed', onMatch);
    return () => {
      s.off('leylek_key_match_completed', onMatch);
      s.off('leylek_pair_match_completed', onMatch);
    };
  }, [cid, loadContext]);

  /** Karşı taraftan gelen eşleşme isteği — yalnız bu sohbet odasındayken (join_muhabbet_conversation). */
  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const cidLo = cid.toLowerCase();
    const onReq = (data: {
      conversation_id?: string;
      request_id?: string;
      from_user_id?: string;
      initiator_user_id?: string;
    }) => {
      const conv = data?.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
      if (conv !== cidLo) return;
      const rid = data?.request_id != null ? String(data.request_id).trim().toLowerCase() : '';
      if (!rid) return;
      const fromLo = String(
        data?.from_user_id != null ? data.from_user_id : data?.initiator_user_id != null ? data.initiator_user_id : ''
      )
        .trim()
        .toLowerCase();
      if (!fromLo) return;
      void (async () => {
        let me = (myId || '').trim().toLowerCase();
        if (!me) {
          try {
            const raw = await getPersistedUserRaw();
            if (raw) {
              const u = JSON.parse(raw) as { id?: string };
              if (u?.id) me = String(u.id).trim().toLowerCase();
            }
          } catch {
            /* noop */
          }
        }
        if (me && fromLo === me) return;
        Alert.alert(
          'Eşleşme isteği',
          'Karşı taraf sizinle eşleşmek istiyor.',
          [
            {
              text: 'Daha sonra',
              style: 'cancel',
              onPress: () => {
                socket.emit('leylek_pair_decline', { conversation_id: cid, request_id: rid });
              },
            },
            {
              text: 'Eşleş',
              onPress: () => {
                try {
                  socket.emit('join_muhabbet_conversation', { conversation_id: cid });
                } catch {
                  /* noop */
                }
                socket.emit('leylek_pair_accept', { conversation_id: cid, request_id: rid });
              },
            },
          ],
          { cancelable: true }
        );
      })();
    };
    socket.on('leylek_pair_match_request', onReq);
    return () => {
      socket.off('leylek_pair_match_request', onReq);
    };
  }, [cid, myId]);

  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const cidLo = cid.trim().toLowerCase();
    let cancelled = false;
    chatSessionActiveRef.current = true;
    roomJoinedRef.current = false;
    setRoomJoined(false);

    const emitJoin = () => {
      if (cancelled || !socket.connected) return;
      notifyAuthTokenBecameAvailableForSocket();
      console.log('[chat] join emitted', cid);
      socket.emit('join_muhabbet_conversation', { conversation_id: cid });
    };

    const runRegisterAndJoin = async () => {
      if (cancelled) return;
      notifyAuthTokenBecameAvailableForSocket();
      if (!socket.connected) {
        try {
          socket.connect();
        } catch {
          /* noop */
        }
        await new Promise<void>((resolve) => {
          if (socket.connected) {
            resolve();
            return;
          }
          const t = setTimeout(() => resolve(), 12000);
          const onC = () => {
            clearTimeout(t);
            socket.off('connect', onC);
            resolve();
          };
          socket.on('connect', onC);
        });
      }
      if (cancelled) return;
      if (socket.connected) {
        console.log('[chat] socket connected');
        console.log('[chat] current socket id =', socket.id);
      }
      const regOk = await waitForNextRegisterSuccess(socket, 15000);
      if (cancelled) return;
      if (!regOk) {
        console.warn('[chat] register ack timeout — join atlanıyor; tekrar denenecek');
        return;
      }
      console.log('[chat] registered');
      console.log('[chat] current socket id =', socket.id);
      emitJoin();
      setTimeout(() => {
        if (!cancelled && socket.connected) emitJoin();
      }, 1000);
    };

    const onJoinedMuhabbet = (p: { conversation_id?: string; room?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c !== cidLo) return;
      roomJoinedRef.current = true;
      setRoomJoined(true);
      console.log('[chat] joined room', c);
    };

    const onMsg = (msg: {
      conversation_id?: string;
      message_id?: string;
      text?: string;
      sender_id?: string;
      created_at?: string;
    }) => {
      const conv = msg?.conversation_id != null ? String(msg.conversation_id).toLowerCase() : '';
      if (conv !== cidLo) {
        if (__DEV__) {
          console.warn('[chat] message ignored: conversation_id mismatch', { conv, expected: cidLo });
        }
        return;
      }
      const mid = String(msg?.message_id || '').trim();
      if (!mid) return;
      console.log('[chat] received message message_id=', mid, msg);
      const senderLo = String(msg?.sender_id || '')
        .trim()
        .toLowerCase();
      const text = String(msg?.text ?? '');
      const created = String(msg?.created_at || new Date().toISOString());
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      const isMine = Boolean(myLo && senderLo === myLo);

      setRows((prev) => {
        if (prev.some((m) => m.id === mid)) {
          if (__DEV__) console.log('[chat] message dedupe skip', mid);
          return prev;
        }
        return [...prev, { id: mid, body: text, sender_user_id: senderLo, created_at: created }];
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

      if (!isMine && myLo) {
        try {
          socket.emit('message_delivered', {
            conversation_id: cid,
            message_id: mid,
            sender_id: senderLo,
          });
        } catch {
          /* noop */
        }
        if (AppState.currentState === 'active' && chatSessionActiveRef.current) {
          try {
            socket.emit('message_seen', {
              conversation_id: cid,
              message_id: mid,
              sender_id: senderLo,
            });
          } catch {
            /* noop */
          }
        }
      }
    };

    const onAck = (p: { conversation_id?: string; message_id?: string; status?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c && c !== cidLo) return;
      const mid = String(p?.message_id || '').trim();
      if (!mid) return;
      const st = String(p?.status || 'sent').toLowerCase();
      if (st !== 'sent' && p?.status != null) return;
      clearAckWait(mid);
      console.log('[chat] current socket id =', socket.id);
      console.log('[chat] received ack message_id=', mid, p);
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      setRows((prev) =>
        prev.map((m) => {
          if (m.id !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          return { ...m, out_status: 'sent' };
        })
      );
    };

    const onDelivered = (p: { conversation_id?: string; message_id?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c && c !== cidLo) return;
      const mid = String(p?.message_id || '').trim();
      if (!mid) return;
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      setRows((prev) =>
        prev.map((m) => {
          if (m.id !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          if (m.out_status === 'seen') return m;
          return { ...m, out_status: 'delivered' };
        })
      );
    };

    const onSeenEvt = (p: { conversation_id?: string; message_id?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c && c !== cidLo) return;
      const mid = String(p?.message_id || '').trim();
      if (!mid) return;
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      setRows((prev) =>
        prev.map((m) => {
          if (m.id !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          return { ...m, out_status: 'seen' };
        })
      );
    };

    const onDel = (payload: { message_id?: string; conversation_id?: string }) => {
      const conv = payload?.conversation_id != null ? String(payload.conversation_id).toLowerCase() : '';
      if (conv && conv !== cidLo) return;
      const mid = payload?.message_id != null ? String(payload.message_id).toLowerCase() : '';
      if (!mid) return;
      setRows((prev) => prev.filter((m) => m.id.toLowerCase() !== mid));
    };

    const refreshChatSocketSession = (reason: string) => {
      if (cancelled) return;
      console.log('[chat] socket session refresh', reason);
      roomJoinedRef.current = false;
      setRoomJoined(false);
      void runRegisterAndJoin();
    };
    const unsubSessionRefresh = subscribeSocketSessionRefresh(refreshChatSocketSession);

    socket.on('joined_muhabbet', onJoinedMuhabbet);
    socket.on('message', onMsg);
    socket.on('message_ack', onAck);
    socket.on('message_delivered', onDelivered);
    socket.on('message_seen', onSeenEvt);
    socket.on('message_deleted', onDel);

    let onAnyDbg: ((event: string, ...args: unknown[]) => void) | null = null;
    if (__DEV__) {
      onAnyDbg = (event: string, ...args: unknown[]) => {
        if (event === 'heartbeat' || event === 'pong_keepalive') return;
        console.log('[socket event]', event, args[0]);
      };
      (socket as unknown as { onAny: (cb: (event: string, ...args: unknown[]) => void) => void }).onAny(onAnyDbg);
    }

    void runRegisterAndJoin();

    return () => {
      cancelled = true;
      chatSessionActiveRef.current = false;
      roomJoinedRef.current = false;
      setRoomJoined(false);
      ackTimeoutsRef.current.forEach((t) => clearTimeout(t));
      ackTimeoutsRef.current.clear();
      unsubSessionRefresh();
      try {
        socket.emit('leave_muhabbet_conversation', { conversation_id: cid });
      } catch {
        /* noop */
      }
      socket.off('joined_muhabbet', onJoinedMuhabbet);
      socket.off('message', onMsg);
      socket.off('message_ack', onAck);
      socket.off('message_delivered', onDelivered);
      socket.off('message_seen', onSeenEvt);
      socket.off('message_deleted', onDel);
      if (onAnyDbg) {
        (socket as unknown as { offAny?: (cb: (event: string, ...args: unknown[]) => void) => void }).offAny?.(
          onAnyDbg
        );
      }
    };
  }, [cid, clearAckWait]);

  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const onMuErr = (p: { code?: string; detail?: string; conversation_id?: string; max?: number }) => {
      const conv = p?.conversation_id != null ? String(p.conversation_id).toLowerCase() : '';
      if (conv && conv !== cid.toLowerCase()) return;
      const det = typeof p?.detail === 'string' ? p.detail : '';
      if (p?.code === 'text_too_long') {
        Alert.alert('Mesaj çok uzun', det || `En fazla ${p?.max ?? 2000} karakter.`);
        return;
      }
      if (p?.code === 'not_registered') {
        notifyAuthTokenBecameAvailableForSocket();
        if (conv && conv === cid.toLowerCase()) {
          Alert.alert('Bağlantı', det || 'Oturum doğrulanıyor. Bir saniye sonra tekrar deneyin.');
        }
        return;
      }
      if (p?.code === 'bad_message_id') {
        Alert.alert('Mesaj', det || 'Geçersiz mesaj kimliği.');
        return;
      }
      Alert.alert('Sohbet', det || 'İşlem yapılamadı.');
    };
    socket.on('muhabbet_error', onMuErr);
    return () => {
      socket.off('muhabbet_error', onMuErr);
    };
  }, [cid]);

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!cid || !messageId) return;
      getOrCreateSocket().emit('delete_message', { message_id: messageId, conversation_id: cid });
    },
    [cid]
  );

  const scheduleAckTimeout = useCallback(
    (messageId: string) => {
      clearAckWait(messageId);
      const tmo = setTimeout(() => {
        ackTimeoutsRef.current.delete(messageId);
        setRows((prev) =>
          prev.map((m) =>
            m.id === messageId && m.out_status === 'sending' ? { ...m, out_status: 'failed' as const } : m
          )
        );
        console.log('[chat] ack timeout message_id=', messageId);
      }, 8000);
      ackTimeoutsRef.current.set(messageId, tmo);
    },
    [clearAckWait]
  );

  const resendMessage = useCallback(
    (row: ChatMessageRow) => {
      const body = (row.body || '').trim();
      const messageId = row.id;
      if (!body || !cid || !messageId) return;
      const socket = getOrCreateSocket();
      if (!socket.connected) {
        Alert.alert('Sohbet', 'Bağlantı yok. İnternetinizi kontrol edin.');
        return;
      }
      if (!roomJoinedRef.current) {
        emitJoinForChat();
      }
      setRows((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, out_status: 'sending' as const } : m))
      );
      scheduleAckTimeout(messageId);
      console.log('[chat] sending muhabbet_send message_id=', messageId);
      try {
        socket.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
      } catch {
        clearAckWait(messageId);
        setRows((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, out_status: 'failed' as const } : m))
        );
      }
    },
    [cid, clearAckWait, emitJoinForChat, scheduleAckTimeout]
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || !cid) return;
    const socket = getOrCreateSocket();
    if (!socket.connected) {
      Alert.alert('Sohbet', 'Bağlantı yok. İnternetinizi kontrol edin.');
      return;
    }
    if (!roomJoinedRef.current) {
      emitJoinForChat();
    }
    const myLo = (myIdRef.current || myId || '').trim().toLowerCase();
    if (!myLo) {
      Alert.alert('Sohbet', 'Kullanıcı bilgisi yüklenemedi.');
      return;
    }
    const messageId = newClientMessageUuid();
    setRows((p) => [
      ...p,
      {
        id: messageId,
        body,
        sender_user_id: myLo,
        created_at: new Date().toISOString(),
        out_status: 'sending',
      },
    ]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    setDraft('');
    setSending(true);
    scheduleAckTimeout(messageId);
    console.log('[chat] sending muhabbet_send message_id=', messageId);
    try {
      socket.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
    } catch {
      clearAckWait(messageId);
      Alert.alert('Gönderilemedi', 'Bağlantı hatası.');
      setDraft(body);
      setRows((p) => p.filter((m) => m.id !== messageId));
    } finally {
      setSending(false);
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
    if (!cid || pairRequestBusyRef.current) return;
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) {
      Alert.alert('Oturum', 'Giriş yapın ve tekrar deneyin.');
      return;
    }
    const now = Date.now();
    if (lastLeylekPairRequestAtRef.current + 60_000 > now) {
      const w = Math.ceil((lastLeylekPairRequestAtRef.current + 60_000 - now) / 1000);
      Alert.alert('Çok sık istek', `${Math.max(1, w)} sn sonra tekrar deneyebilirsiniz.`);
      return;
    }
    pairRequestBusyRef.current = true;
    setPairRequestLoading(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pairRequestBusyRef.current = false;
      setPairRequestLoading(false);
    };
    const socket = getOrCreateSocket();
    let tmo: ReturnType<typeof setTimeout> | null = null;
    const onErr = (p: { code?: string; detail?: string }) => {
      if (tmo) {
        clearTimeout(tmo);
        tmo = null;
      }
      socket.off('leylek_pair_error', onErr);
      socket.off('leylek_pair_info', onInfo);
      finish();
      const det = typeof p?.detail === 'string' ? p.detail : '';
      if (p?.code === 'cooldown') {
        Alert.alert('Çok sık istek', det || 'Lütfen kısa bir süre sonra tekrar deneyin.');
        return;
      }
      Alert.alert('İstek gönderilemedi', det || 'Tekrar deneyin.');
    };
    const onInfo = (p: { code?: string; message?: string; request_id?: string }) => {
      if (tmo) {
        clearTimeout(tmo);
        tmo = null;
      }
      socket.off('leylek_pair_error', onErr);
      socket.off('leylek_pair_info', onInfo);
      finish();
      const code = String(p?.code || '');
      if (code === 'pending') {
        Alert.alert('Bekleyen istek', p?.message || 'Zaten bir eşleşme isteğiniz var.');
        return;
      }
      if (code === 'sent') {
        lastLeylekPairRequestAtRef.current = Date.now();
        Alert.alert('Gönderildi', p?.message || 'Karşı taraf onaylarsa eşleşme tamamlanır.');
        return;
      }
      Alert.alert('Bilgi', p?.message || 'İşlem tamam.');
    };
    try {
      if (!socket.connected) {
        socket.connect();
        await new Promise<void>((resolve) => {
          if (socket.connected) {
            resolve();
            return;
          }
          const t = setTimeout(() => resolve(), 10000);
          const onC = () => {
            clearTimeout(t);
            socket.off('connect', onC);
            resolve();
          };
          socket.on('connect', onC);
        });
      }
      socket.off('leylek_pair_error', onErr);
      socket.off('leylek_pair_info', onInfo);
      socket.on('leylek_pair_error', onErr);
      socket.on('leylek_pair_info', onInfo);
      tmo = setTimeout(() => {
        tmo = null;
        socket.off('leylek_pair_error', onErr);
        socket.off('leylek_pair_info', onInfo);
        finish();
        Alert.alert('Zaman aşımı', 'Sunucudan yanıt alınamadı. Bağlantınızı kontrol edin.');
      }, 15000);
      try {
        socket.emit('join_muhabbet_conversation', { conversation_id: cid });
      } catch {
        /* noop */
      }
      socket.emit('leylek_pair_match_request', { conversation_id: cid });
    } catch {
      if (tmo) {
        clearTimeout(tmo);
        tmo = null;
      }
      socket.off('leylek_pair_error', onErr);
      socket.off('leylek_pair_info', onInfo);
      finish();
      Alert.alert('Bağlantı hatası', 'İnternet bağlantınızı kontrol edin.');
    }
  }, [cid]);

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
                <View>
                  {!roomJoined ? (
                    <View style={styles.connectingStrip} accessibilityRole="alert">
                      <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} style={{ marginRight: 8 }} />
                      <Text style={styles.connectingStripTxt}>Sohbet bağlantısı kuruluyor…</Text>
                    </View>
                  ) : null}
                  <View style={styles.privacyBanner}>
                    <Text style={styles.privacyBannerTxt} numberOfLines={4}>
                      Güvenliğiniz bizim önceliğimizdir. Mesaj içerikleri sunucularımızda saklanmaz. Yazışmalar yalnızca
                      görüşme sırasında geçici olarak iletilir.
                    </Text>
                  </View>
                </View>
              }
              renderItem={({ item }) => {
                const { mine, drv } = bubbleForMsg(item);
                const time = formatMessageTimeLabel(item.created_at);
                if (mine) {
                  const g = drv ? DRIVER_BUBBLE_GRAD : PAX_BUBBLE_GRAD;
                  return (
                    <View style={styles.bubbleColMine}>
                      <View style={styles.bubbleRowMine}>
                        <View style={[styles.bubbleShadowWrap, styles.bubbleAlignEnd, styles.bubbleMax]}>
                          <LinearGradient
                            colors={g}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bubblePad}
                          >
                            <Text style={styles.tGrad}>{item.body || ''}</Text>
                          </LinearGradient>
                        </View>
                        <Pressable
                          onPress={() => deleteMessage(item.id)}
                          style={({ pressed }) => [styles.trashHit, pressed && { opacity: 0.65 }]}
                          hitSlop={6}
                          accessibilityLabel="Mesajı kaldır"
                        >
                          <Ionicons name="trash-outline" size={17} color="#6B7280" />
                        </Pressable>
                      </View>
                      <View style={styles.timeRowMine}>
                        {time ? <Text style={styles.tTimeMine}>{time}</Text> : null}
                        {item.out_status ? <DeliveryTicks status={item.out_status} /> : null}
                      </View>
                      {item.out_status === 'failed' ? (
                        <Pressable
                          onPress={() => resendMessage(item)}
                          style={({ pressed }) => [styles.resendRow, pressed && { opacity: 0.75 }]}
                          accessibilityRole="button"
                          accessibilityLabel="Tekrar gönder"
                        >
                          <Text style={styles.resendTxt}>Tekrar gönder</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                }
                const g2 = drv ? DRIVER_BUBBLE_GRAD : PAX_BUBBLE_GRAD;
                return (
                  <View style={styles.bubbleColTheirs}>
                    <View style={styles.bubbleRowTheirs}>
                      <Pressable
                        onPress={() => deleteMessage(item.id)}
                        style={({ pressed }) => [styles.trashHit, pressed && { opacity: 0.65 }]}
                        hitSlop={6}
                        accessibilityLabel="Mesajı kaldır"
                      >
                        <Ionicons name="trash-outline" size={17} color="#6B7280" />
                      </Pressable>
                      <View style={[styles.bubbleShadowWrap, styles.bubbleAlignStart, styles.bubbleMax]}>
                        <LinearGradient
                          colors={g2}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.bubblePad}
                        >
                          <Text style={styles.tGrad}>{item.body || ''}</Text>
                        </LinearGradient>
                      </View>
                    </View>
                    {time ? <Text style={styles.tTimeTheirs}>{time}</Text> : null}
                  </View>
                );
              }}
            />
          )}
          {!ctx?.matched_via_leylek_key ? (
            <View style={styles.keyRow}>
              <Text style={styles.routeSafetyTxt}>
                Önce güzergâh, ücret ve buluşma noktasını netleştirin. Leylek Anahtar ile eşleşmeden yolculuğa
                başlamayın.
              </Text>
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
          ) : null}
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
  connectingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  connectingStripTxt: { fontSize: 13, color: '#1D4ED8', fontWeight: '600' },
  privacyBanner: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  privacyBannerTxt: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#14532D',
    fontWeight: '500',
  },
  bubbleColMine: { alignSelf: 'flex-end', maxWidth: '96%', marginBottom: 8 },
  bubbleColTheirs: { alignSelf: 'flex-start', maxWidth: '96%', marginBottom: 8 },
  bubbleRowMine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bubbleRowTheirs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  trashHit: { padding: 2 },
  bubbleMax: { maxWidth: '88%' },
  bubbleShadowWrap: { ...BUBBLE_SHADOW, borderRadius: 18, maxWidth: '100%' },
  bubbleAlignEnd: { alignSelf: 'flex-end' },
  bubbleAlignStart: { alignSelf: 'flex-start' },
  bubblePad: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  tGrad: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  timeRowMine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  tTimeMine: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right' },
  resendRow: { alignSelf: 'flex-end', marginTop: 4, paddingVertical: 4, paddingHorizontal: 2 },
  resendTxt: { fontSize: 12, fontWeight: '700', color: '#2563EB', textDecorationLine: 'underline' },
  tTimeTheirs: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },
  keyRow: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4, backgroundColor: 'rgba(255,255,255,0.72)' },
  routeSafetyTxt: {
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
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
