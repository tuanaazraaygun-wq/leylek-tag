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
  DeviceEventEmitter,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { publishSocketSessionRefresh, subscribeSocketSessionRefresh } from '../lib/socketSessionRefresh';
import { MUHABBET_CONVERSATION_READ, MUHABBET_NEW_LOCAL_MESSAGE } from '../lib/muhabbetLocalMessageEvents';
import {
  coerceMessageCreatedAt,
  loadMuhabbetMessagesLocal,
  mergeMuhabbetLocalWithServer,
  normalizeMuhabbetMessageId,
  persistMuhabbetChatRowsLocal,
  saveMuhabbetMessagesLocal,
  storedMessagesFromConversationApi,
  storedMessagesToDisplayRows,
} from '../lib/muhabbetMessagesStorage';
import MuhabbetWatermark from './MuhabbetWatermark';

const PRIMARY_GRAD = ['#3B82F6', '#60A5FA'] as const;
/** Sürücü / yolcu balon — istenen gradientler */
const DRIVER_BUBBLE_GRAD = ['#4facfe', '#00f2fe'] as const;
const PAX_BUBBLE_GRAD = ['#f7971e', '#ffd200'] as const;
const SEND_BTN_GRAD = ['#4facfe', '#00f2fe'] as const;
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';

const INFO_PRIVACY =
  'Mesajlar güvenlik ve destek amacıyla en fazla 90 gün saklanır; ardından otomatik silinir.';
const INFO_SAFETY =
  'Güzergâh, ücret ve buluşma noktasını netleştirmeden yolculuğa başlamayın. Taraflar arası anlaşma kullanıcıların sorumluluğundadır.';

/** Muhabbet mesaj satırı — id istemci UUID veya sunucu message_id; metin 90 güne kadar sunucuda. */
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
  /** Cihazda saklanan rol (socket anında ctx’den yazılır) */
  sender_role?: string | null;
};

export type ChatContext = {
  other_user_id?: string;
  other_user_public_name?: string;
  other_user_profile_photo_url?: string;
  other_user_role_label?: string;
  public_name?: string;
  name?: string;
  my_role?: string | null;
  other_role?: string | null;
  matched_via_leylek_key?: boolean;
  matched_at?: string | null;
  match_source?: string | null;
  pending_pair_request_id?: string | null;
  pending_pair_request_direction?: 'incoming' | 'outgoing' | null;
  pending_pair_request_requester_id?: string | null;
  pending_pair_request_target_id?: string | null;
  /** Sunucu geçmiş mesaj tutmaz */
  ephemeral_chat?: boolean;
};

type ChatSystemCard = {
  id: string;
  tone: 'blue' | 'green' | 'orange';
  text: string;
};

function chatInitials(nameRaw: string): string {
  const parts = String(nameRaw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

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

function sortRowsByCreatedAtAsc(items: ChatMessageRow[]): ChatMessageRow[] {
  return [...items].sort(
    (a, b) =>
      new Date(String(a.created_at || 0)).getTime() - new Date(String(b.created_at || 0)).getTime()
  );
}

function rowIdLo(m: Pick<ChatMessageRow, 'id'>): string {
  return normalizeMuhabbetMessageId(m.id);
}

function markMessageFailedById(rows: ChatMessageRow[], messageId: string): ChatMessageRow[] {
  const mid = normalizeMuhabbetMessageId(messageId);
  if (!mid) return rows;
  return rows.map((m) => (rowIdLo(m) === mid && m.out_status === 'sending' ? { ...m, out_status: 'failed' } : m));
}

function markLatestSendingFailed(rows: ChatMessageRow[]): ChatMessageRow[] {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].out_status === 'sending') {
      const next = [...rows];
      next[i] = { ...next[i], out_status: 'failed' };
      return next;
    }
  }
  return rows;
}

/** AppState / disk yenilemesinde önceki state (ör. sending) kaybolmasın */
function mergeChatRowsFromDiskWithPrev(fromDisk: ChatMessageRow[], prev: ChatMessageRow[]): ChatMessageRow[] {
  const byId = new Map<string, ChatMessageRow>();
  for (const r of prev) {
    const id = rowIdLo(r);
    if (id) byId.set(id, r);
  }
  for (const r of fromDisk) {
    const id = rowIdLo(r);
    if (!id) continue;
    const p = byId.get(id);
    if (!p) {
      byId.set(id, r);
      continue;
    }
    if (p.out_status === 'sending') {
      byId.set(id, {
        ...r,
        body: (p.body != null && String(p.body) !== '' ? p.body : r.body) ?? r.body,
        created_at: p.created_at ?? r.created_at,
        out_status: 'sending',
        sender_role: p.sender_role ?? r.sender_role,
      });
      continue;
    }
    byId.set(id, {
      ...p,
      ...r,
      sender_role: p.sender_role ?? r.sender_role,
      out_status: (r.out_status ?? p.out_status) as OutMessageStatus | undefined,
    });
  }
  return sortRowsByCreatedAtAsc([...byId.values()]);
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
  /**
   * loading: ilk okuma
   * local: yerel liste gösterilir, API ile birleştirme sürer
   * ready: birleştirme bitti; socket join açılır
   */
  const [bootstrapPhase, setBootstrapPhase] = useState<'loading' | 'local' | 'ready'>('loading');
  const [rows, setRows] = useState<ChatMessageRow[]>([]);
  const rowsRef = useRef<ChatMessageRow[]>([]);
  rowsRef.current = rows;
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pairRequestLoading, setPairRequestLoading] = useState(false);
  const [systemCards, setSystemCards] = useState<ChatSystemCard[]>([]);
  /** Karşı taraftan gelen Leylek Anahtar eşleşme isteği (modal) */
  const [pairInModal, setPairInModal] = useState<{ rid: string; fromLo: string } | null>(null);
  /** Üst bilgi şeridi: küçük kartlar, kapatılabilir / dönüşümlü */
  const [infoStripDismissed, setInfoStripDismissed] = useState(false);
  const [infoRotateIx, setInfoRotateIx] = useState(0);
  const infoFade = useRef(new Animated.Value(1)).current;
  const pairRequestBusyRef = useRef(false);
  /** İstemci tarafı 60 sn eşleşme isteği aralığı (sunucu cooldown ile uyumlu) */
  const lastLeylekPairRequestAtRef = useRef(0);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const ctxRef = useRef<ChatContext | null>(null);
  const ctaPulse = useRef(new Animated.Value(1)).current;
  /** Sohbet odası (joined_muhabbet) — mesaj almak için gerekli */
  const [roomJoined, setRoomJoined] = useState(false);
  const roomJoinedRef = useRef(false);
  /** Ekran mount / unmount: açıkken message_seen gönder */
  const chatSessionActiveRef = useRef(true);
  /** message_id -> 8 sn ack bekleme (timeout iptali onAck’te) */
  const ackTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const pendingPairRequestId = String(ctx?.pending_pair_request_id || '').trim().toLowerCase();
  const pendingPairDirection = ctx?.pending_pair_request_direction || null;
  const hasOutgoingPendingPairRequest =
    !ctx?.matched_via_leylek_key &&
    !!pendingPairRequestId &&
    pendingPairDirection === 'outgoing';

  const keyboardOffset = insets.top + (Platform.OS === 'ios' ? 52 : 12);
  const pushSystemCard = useCallback((tone: ChatSystemCard['tone'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSystemCards((prev) => [...prev, { id, tone, text }].slice(-8));
  }, []);

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

  const ensureSocketReadyForSend = useCallback(async (): Promise<boolean> => {
    if (!cid) return false;
    const socket = getOrCreateSocket();
    notifyAuthTokenBecameAvailableForSocket();
    if (!socket.connected) {
      try {
        socket.connect();
      } catch {
        return false;
      }
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
    if (!socket.connected) return false;
    const regOk = await waitForNextRegisterSuccess(socket, 12000);
    if (!regOk) {
      console.log('[chat-send] blocked reason=register_timeout (emit yine denenecek)');
    }
    roomJoinedRef.current = false;
    setRoomJoined(false);
    emitJoinForChat();
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        socket.off('joined_muhabbet', onJoined);
        resolve();
      };
      const t = setTimeout(finish, 1500);
      const onJoined = (p: { conversation_id?: string }) => {
        const conv = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
        if (!conv || conv !== cid.toLowerCase()) return;
        finish();
      };
      socket.on('joined_muhabbet', onJoined);
    });
    return true;
  }, [cid, emitJoinForChat]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  useEffect(() => {
    if (!cid || ctx?.matched_via_leylek_key) return;
    const rid = String(ctx?.pending_pair_request_id || '').trim().toLowerCase();
    if (!rid || ctx?.pending_pair_request_direction !== 'incoming') return;
    const fromLo = String(ctx.pending_pair_request_requester_id || '').trim().toLowerCase();
    // Leylek Teklif Sende only: restore missed in-chat match requests from Muhabbet context.
    // This must not call normal ride creation, tags, dispatch, route, QR, Guven Al, or Agora.
    setPairInModal((prev) => (prev?.rid === rid ? prev : { rid, fromLo }));
  }, [
    cid,
    ctx?.matched_via_leylek_key,
    ctx?.pending_pair_request_direction,
    ctx?.pending_pair_request_id,
    ctx?.pending_pair_request_requester_id,
  ]);

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

  /** Yerel → API son 200 (birleştir, kaydet) → ctx. Socket join `bootstrapPhase === 'ready'`. */
  const loadContext = useCallback(async () => {
    if (!cid) {
      setBootstrapPhase('ready');
      setLoading(false);
      return;
    }
    setLoading(true);
    setBootstrapPhase('loading');
    let localItems = await loadMuhabbetMessagesLocal(cid);
    try {
      const mapped: ChatMessageRow[] = sortRowsByCreatedAtAsc(
        storedMessagesToDisplayRows(localItems).map((m) => ({
          id: normalizeMuhabbetMessageId(m.id),
          body: m.body,
          sender_user_id: m.sender_user_id,
          created_at: coerceMessageCreatedAt(m.created_at),
          out_status: (m.out_status as OutMessageStatus | undefined) || undefined,
          sender_role: m.sender_role,
        }))
      );
      console.log('[chat] local load conversation=', cid, 'count=', mapped.length);
      setRows(mapped);
    } catch {
      localItems = [];
      setRows([]);
    }
    setBootstrapPhase('local');

    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setCtx(null);
        return;
      }
      let myLo = (myIdRef.current || '').trim().toLowerCase();
      if (!myLo) {
        try {
          const raw = await getPersistedUserRaw();
          if (raw) {
            const u = JSON.parse(raw) as { id?: string };
            if (u?.id) myLo = String(u.id).trim().toLowerCase();
          }
        } catch {
          /* noop */
        }
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
        context?: ChatContext;
        messages?: Array<{ id?: string; body?: string; sender_user_id?: string; created_at?: string }>;
      };
      if (res.ok && d.success) {
        const latestLocal = await loadMuhabbetMessagesLocal(cid);
        const serverStored = storedMessagesFromConversationApi(cid, d.messages || []);
        const merged = mergeMuhabbetLocalWithServer(latestLocal, serverStored, myLo);
        await saveMuhabbetMessagesLocal(cid, merged);
        const displayRows: ChatMessageRow[] = sortRowsByCreatedAtAsc(
          storedMessagesToDisplayRows(merged).map((m) => ({
            id: normalizeMuhabbetMessageId(m.id),
            body: m.body,
            sender_user_id: m.sender_user_id,
            created_at: coerceMessageCreatedAt(m.created_at),
            out_status: (m.out_status as OutMessageStatus | undefined) || undefined,
            sender_role: m.sender_role,
          }))
        );
        console.log('[chat] merged server messages conversation=', cid, 'count=', (d.messages || []).length);
        setRows(displayRows);
        setCtx(d.context || null);
      } else {
        setCtx(null);
      }
    } catch {
      setCtx(null);
    } finally {
      setBootstrapPhase('ready');
      setLoading(false);
    }
  }, [base, cid]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (cid) console.log('[chat] route conversation_id=', cid);
  }, [cid]);

  useEffect(() => {
    if (!cid) return;
    DeviceEventEmitter.emit(MUHABBET_CONVERSATION_READ, { conversation_id: cid });
  }, [cid]);

  useEffect(() => {
    if (infoStripDismissed) return;
    const id = setInterval(() => {
      setInfoRotateIx((v) => (v + 1) % 2);
    }, 5000);
    return () => clearInterval(id);
  }, [infoStripDismissed]);

  useEffect(() => {
    if (infoStripDismissed) return;
    infoFade.setValue(0.65);
    Animated.timing(infoFade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [infoRotateIx, infoFade, infoStripDismissed]);

  useEffect(() => {
    if (!cid) return;
    const s = getOrCreateSocket();
    const onMatch = (data: { conversation_id?: string }) => {
      const m = data?.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
      if (m && m === cid.toLowerCase()) {
        pushSystemCard('green', 'Leylek Anahtar ile eşleşme tamamlandı.');
        void loadContext();
      }
    };
    s.on('leylek_key_match_completed', onMatch);
    s.on('leylek_pair_match_completed', onMatch);
    return () => {
      s.off('leylek_key_match_completed', onMatch);
      s.off('leylek_pair_match_completed', onMatch);
    };
  }, [cid, loadContext, pushSystemCard]);

  /** Karşı taraftan Leylek Anahtar isteği — sunucu emit_socket_event_to_user ile (oda join şart değil). */
  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const cidLo = cid.toLowerCase();
    const onReq = (data: {
      conversation_id?: string;
      request_id?: string;
      requester_user_id?: string;
      from_user_id?: string;
      initiator_user_id?: string;
    }) => {
      console.log('[chat] received leylek_pair_match_request data=', data);
      const conv = data?.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
      if (conv !== cidLo) return;
      const rid = data?.request_id != null ? String(data.request_id).trim().toLowerCase() : '';
      if (!rid) return;
      const fromLo = String(
        data?.requester_user_id != null
          ? data.requester_user_id
          : data?.from_user_id != null
            ? data.from_user_id
            : data?.initiator_user_id != null
              ? data.initiator_user_id
              : ''
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
        setPairInModal((prev) => (prev?.rid === rid ? prev : { rid, fromLo }));
      })();
    };
    socket.on('leylek_pair_match_request', onReq);
    return () => {
      socket.off('leylek_pair_match_request', onReq);
    };
  }, [cid, myId]);

  useEffect(() => {
    if (!cid || bootstrapPhase !== 'ready') return;
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
      const id = normalizeMuhabbetMessageId(msg?.message_id);
      if (!id) return;
      console.log('[chat] socket message received id=', id);
      const senderLo = String(msg?.sender_id || '')
        .trim()
        .toLowerCase();
      const text = String(msg?.text ?? '');
      const created = coerceMessageCreatedAt(msg?.created_at);
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      const isMine = Boolean(myLo && senderLo === myLo);
      const myR = (ctxRef.current?.my_role || '').trim().toLowerCase();
      const oR = (ctxRef.current?.other_role || '').trim().toLowerCase();
      const roleFor = (isMine ? myR : oR) || null;

      setRows((prev) => {
        if (prev.some((m) => rowIdLo(m) === id)) {
          console.log('[chat] dedupe skip id=', id);
          return prev;
        }
        return sortRowsByCreatedAtAsc([
          ...prev,
          {
            id,
            body: text,
            sender_user_id: senderLo,
            created_at: created,
            sender_role: roleFor,
            ...(isMine ? { out_status: 'sent' as const } : {}),
          },
        ]);
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

      if (!isMine && myLo) {
        try {
          socket.emit('message_delivered', {
            conversation_id: cid,
            message_id: id,
            sender_id: senderLo,
          });
        } catch {
          /* noop */
        }
        if (AppState.currentState === 'active' && chatSessionActiveRef.current) {
          try {
            socket.emit('message_seen', {
              conversation_id: cid,
              message_id: id,
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
      const mid = normalizeMuhabbetMessageId(p?.message_id);
      if (!mid) return;
      const st = String(p?.status || 'sent').toLowerCase();
      if (st !== 'sent' && p?.status != null) return;
      clearAckWait(mid);
      console.log('[chat] current socket id =', socket.id);
      console.log('[chat] received ack message_id=', mid, p);
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      setRows((prev) =>
        prev.map((m) => {
          if (rowIdLo(m) !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          return { ...m, out_status: 'sent' };
        })
      );
    };

    const onDelivered = (p: { conversation_id?: string; message_id?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c && c !== cidLo) return;
      const mid = normalizeMuhabbetMessageId(p?.message_id);
      if (!mid) return;
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      setRows((prev) =>
        prev.map((m) => {
          if (rowIdLo(m) !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          if (m.out_status === 'seen') return m;
          return { ...m, out_status: 'delivered' };
        })
      );
    };

    const onSeenEvt = (p: { conversation_id?: string; message_id?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c && c !== cidLo) return;
      const mid = normalizeMuhabbetMessageId(p?.message_id);
      if (!mid) return;
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      setRows((prev) =>
        prev.map((m) => {
          if (rowIdLo(m) !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          return { ...m, out_status: 'seen' };
        })
      );
    };

    const onDel = (payload: { message_id?: string; conversation_id?: string }) => {
      const conv = payload?.conversation_id != null ? String(payload.conversation_id).toLowerCase() : '';
      if (conv && conv !== cidLo) return;
      const mid = normalizeMuhabbetMessageId(payload?.message_id);
      if (!mid) return;
      setRows((prev) => prev.filter((m) => rowIdLo(m) !== mid));
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
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
      }
      void persistMuhabbetChatRowsLocal(cid, rowsRef.current);
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
  }, [cid, clearAckWait, bootstrapPhase]);

  useEffect(() => {
    if (!cid || bootstrapPhase === 'loading') return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      void persistMuhabbetChatRowsLocal(cid, rowsRef.current);
    }, 300);
    return () => {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
      }
      if (bootstrapPhase !== 'loading' && cid) {
        void persistMuhabbetChatRowsLocal(cid, rowsRef.current);
      }
    };
  }, [cid, rows, bootstrapPhase]);

  useEffect(() => {
    if (!cid) return;
    const cidLo = cid.trim().toLowerCase();
    const sub = DeviceEventEmitter.addListener(MUHABBET_NEW_LOCAL_MESSAGE, (payload: Record<string, unknown>) => {
      const pcid = payload?.conversation_id != null ? String(payload.conversation_id).trim().toLowerCase() : '';
      if (pcid !== cidLo) return;
      const id = normalizeMuhabbetMessageId(payload?.message_id);
      if (!id) return;
      const senderLo = payload?.sender_id != null ? String(payload.sender_id).trim().toLowerCase() : '';
      const text = payload?.text != null ? String(payload.text) : '';
      const created = coerceMessageCreatedAt(payload?.created_at);
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      const isMine = Boolean(myLo && senderLo && senderLo === myLo);
      const myR = (ctxRef.current?.my_role || '').trim().toLowerCase();
      const oR = (ctxRef.current?.other_role || '').trim().toLowerCase();
      const roleFor = (isMine ? myR : oR) || null;
      setRows((prev) => {
        if (prev.some((m) => rowIdLo(m) === id)) {
          console.log('[chat] dedupe skip id=', id);
          return prev;
        }
        return sortRowsByCreatedAtAsc([
          ...prev,
          {
            id,
            body: text,
            sender_user_id: senderLo,
            created_at: created,
            sender_role: roleFor,
            ...(isMine ? { out_status: 'sent' as const } : {}),
          },
        ]);
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, [cid]);

  useEffect(() => {
    if (!cid || bootstrapPhase !== 'ready') return;
    const cidNorm = cid.trim().toLowerCase();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      publishSocketSessionRefresh('app_active');
      void (async () => {
        try {
          const localItems = await loadMuhabbetMessagesLocal(cidNorm);
          const fromDisk: ChatMessageRow[] = sortRowsByCreatedAtAsc(
            storedMessagesToDisplayRows(localItems).map((m) => ({
              id: normalizeMuhabbetMessageId(m.id),
              body: m.body,
              sender_user_id: m.sender_user_id,
              created_at: coerceMessageCreatedAt(m.created_at),
              out_status: (m.out_status as OutMessageStatus | undefined) || undefined,
              sender_role: m.sender_role,
            }))
          );
          setRows((prev) => mergeChatRowsFromDiskWithPrev(fromDisk, prev));
        } catch {
          /* noop */
        }
      })();
    });
    return () => sub.remove();
  }, [cid, bootstrapPhase]);

  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const cidLo = cid.trim().toLowerCase();
    const onDeclined = (p: { conversation_id?: string }) => {
      const c = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
      if (c && c !== cidLo) return;
      pushSystemCard('orange', 'Karşı taraf şu an müsait değil.');
      Alert.alert('Eşleşme', 'Karşı taraf şu an eşleşmeyi kabul etmedi.');
    };
    socket.on('leylek_pair_declined', onDeclined);
    return () => {
      socket.off('leylek_pair_declined', onDeclined);
    };
  }, [cid, pushSystemCard]);

  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const onMuErr = (p: { code?: string; detail?: string; message?: string; message_id?: string; conversation_id?: string; max?: number }) => {
      const conv = p?.conversation_id != null ? String(p.conversation_id).toLowerCase() : '';
      if (conv && conv !== cid.toLowerCase()) return;
      const det = typeof p?.detail === 'string' ? p.detail : '';
      const msg = typeof p?.message === 'string' ? p.message : '';
      const errMid = normalizeMuhabbetMessageId(p?.message_id);
      console.log('[chat] muhabbet_error', p);
      if (p?.code === 'text_too_long') {
        Alert.alert('Mesaj çok uzun', det || `En fazla ${p?.max ?? 2000} karakter.`);
        return;
      }
      if (p?.code === 'not_registered') {
        notifyAuthTokenBecameAvailableForSocket();
        setRows((prev) => (errMid ? markMessageFailedById(prev, errMid) : markLatestSendingFailed(prev)));
        if (conv && conv === cid.toLowerCase()) {
          Alert.alert('Bağlantı', det || 'Oturum doğrulanıyor. Bir saniye sonra tekrar deneyin.');
        }
        return;
      }
      if (p?.code === 'bad_message_id') {
        setRows((prev) => (errMid ? markMessageFailedById(prev, errMid) : markLatestSendingFailed(prev)));
        Alert.alert('Mesaj', det || 'Geçersiz mesaj kimliği.');
        return;
      }
      if (p?.code === 'message_db_insert_failed' || p?.code === 'forbidden') {
        setRows((prev) => (errMid ? markMessageFailedById(prev, errMid) : markLatestSendingFailed(prev)));
        Alert.alert('Gönderilemedi', msg || det || 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
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
      Alert.alert(
        'Mesajı kaldır',
        'Bu mesaj yalnızca sizin görünümünüzden kaldırılır; karşı taraf görmeye devam eder.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Kaldır',
            style: 'destructive',
            onPress: () =>
              void (async () => {
                const token = (await getPersistedAccessToken())?.trim();
                if (!token) {
                  Alert.alert('Oturum', 'Giriş yapın.');
                  return;
                }
                const mid = normalizeMuhabbetMessageId(messageId);
                const res = await fetch(
                  `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages/${encodeURIComponent(mid)}/delete-for-me`,
                  { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
                );
                if (handleUnauthorizedAndMaybeRedirect(res)) return;
                if (!res.ok) {
                  Alert.alert('Hata', 'Mesaj kaldırılamadı.');
                  return;
                }
                setRows((p) => {
                  const next = p.filter((m) => rowIdLo(m) !== rowIdLo({ id: mid }));
                  void persistMuhabbetChatRowsLocal(cid, next);
                  return next;
                });
              })(),
          },
        ]
      );
    },
    [cid, base]
  );

  const scheduleAckTimeout = useCallback(
    (messageId: string) => {
      clearAckWait(messageId);
      const tmo = setTimeout(() => {
        ackTimeoutsRef.current.delete(messageId);
      setRows((prev) =>
        prev.map((m) =>
          rowIdLo(m) === rowIdLo({ id: messageId }) && m.out_status === 'sending'
            ? { ...m, out_status: 'failed' as const }
            : m
        )
      );
        console.log('[chat] ack timeout message_id=', messageId);
      }, 8000);
      ackTimeoutsRef.current.set(messageId, tmo);
    },
    [clearAckWait]
  );

  const resendMessage = useCallback(
    async (row: ChatMessageRow) => {
      console.log('[chat-send] pressed');
      const body = (row.body || '').trim();
      const messageId = row.id;
      if (!body) {
        console.log('[chat-send] blocked reason=empty_body');
        return;
      }
      if (!cid) {
        console.log('[chat-send] blocked reason=missing_conversation_id');
        return;
      }
      if (!messageId) {
        console.log('[chat-send] blocked reason=missing_message_id');
        return;
      }
      const socket = getOrCreateSocket();
      console.log('[chat-send] socket_exists=', Boolean(socket));
      console.log('[chat-send] socket_connected=', socket.connected);
      console.log('[chat-send] socket_id=', socket.id || null);
      console.log('[chat-send] roomJoined=', roomJoinedRef.current);
      console.log('[chat-send] conversation_id=', cid);
      console.log('[chat-send] message_id=', messageId);

      setRows((prev) =>
        prev.map((m) => (rowIdLo(m) === rowIdLo({ id: messageId }) ? { ...m, out_status: 'sending' as const } : m))
      );
      scheduleAckTimeout(messageId);
      const ready = await ensureSocketReadyForSend();
      if (!ready) {
        console.log('[chat-send] blocked reason=socket_not_connected_after_ensure');
        setRows((prev) => markMessageFailedById(prev, messageId));
        Alert.alert('Sohbet', 'Sohbet bağlantısı kuruluyor, mesaj birazdan tekrar denenebilir.');
        return;
      }
      try {
        console.log('[chat-send] emit muhabbet_send');
        socket.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
      } catch {
        clearAckWait(messageId);
        setRows((prev) =>
          prev.map((m) =>
            rowIdLo(m) === rowIdLo({ id: messageId }) ? { ...m, out_status: 'failed' as const } : m
          )
        );
      }
    },
    [cid, clearAckWait, emitJoinForChat, scheduleAckTimeout, ensureSocketReadyForSend]
  );

  const send = async () => {
    console.log('[chat-send] pressed');
    const body = draft.trim();
    if (!body) {
      console.log('[chat-send] blocked reason=empty_body');
      return;
    }
    if (!cid) {
      console.log('[chat-send] blocked reason=missing_conversation_id');
      return;
    }
    const socket = getOrCreateSocket();
    console.log('[chat-send] socket_exists=', Boolean(socket));
    console.log('[chat-send] socket_connected=', socket.connected);
    console.log('[chat-send] socket_id=', socket.id || null);
    console.log('[chat-send] roomJoined=', roomJoinedRef.current);
    console.log('[chat-send] conversation_id=', cid);
    const myLo = (myIdRef.current || myId || '').trim().toLowerCase();
    if (!myLo) {
      console.log('[chat-send] blocked reason=missing_user_id');
      Alert.alert('Sohbet', 'Kullanıcı bilgisi yüklenemedi.');
      return;
    }
    const messageId = normalizeMuhabbetMessageId(newClientMessageUuid());
    const roleMine = (ctx?.my_role || '').trim().toLowerCase();
    const createdIso = coerceMessageCreatedAt(undefined);
    setRows((p) =>
      sortRowsByCreatedAtAsc([
        ...p,
        {
          id: messageId,
          body,
          sender_user_id: myLo,
          created_at: createdIso,
          out_status: 'sending',
          sender_role: roleMine || null,
        },
      ])
    );
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    setDraft('');
    setSending(true);
    scheduleAckTimeout(messageId);
    console.log('[chat-send] message_id=', messageId);
    const ready = await ensureSocketReadyForSend();
    if (!ready) {
      console.log('[chat-send] blocked reason=socket_not_connected_after_ensure');
      clearAckWait(messageId);
      setRows((prev) => markMessageFailedById(prev, messageId));
      setSending(false);
      Alert.alert('Sohbet', 'Sohbet bağlantısı kuruluyor, mesaj birazdan tekrar denenebilir.');
      return;
    }
    try {
      console.log('[chat-send] emit muhabbet_send');
      socket.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
    } catch {
      clearAckWait(messageId);
      Alert.alert('Gönderilemedi', 'Bağlantı hatası.');
      setDraft(body);
      setRows((p) => p.filter((m) => rowIdLo(m) !== rowIdLo({ id: messageId })));
    } finally {
      setSending(false);
    }
  };

  const openOtherProfile = useCallback(() => {
    const ou = (otherUserId || ctx?.other_user_id || '').trim();
    if (!ou) return;
    router.push(`/muhabbet-profile/${encodeURIComponent(ou)}` as Href);
  }, [otherUserId, ctx, router]);

  const sendLeylekPairRequest = useCallback(async () => {
    const socket = getOrCreateSocket();
    console.log("[leylek-pair] pressed", {
      cid,
      busyRef: pairRequestBusyRef.current,
      pairRequestLoading,
      socketConnected: socket?.connected,
      socketId: socket?.id,
    });
    if (!cid) return;
    if (pairRequestBusyRef.current) {
      if (pairRequestLoading) return;
      pairRequestBusyRef.current = false;
    }
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
    setTimeout(() => {
      if (pairRequestBusyRef.current) {
        pairRequestBusyRef.current = false;
        setPairRequestLoading(false);
        console.warn("[leylek-pair] busy safety reset");
      }
    }, 15000);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pairRequestBusyRef.current = false;
      setPairRequestLoading(false);
    };
    let tmo: ReturnType<typeof setTimeout> | null = null;
    const offPair = () => {
      socket.off('leylek_pair_error', onErr);
      socket.off('leylek_pair_info', onInfo);
      socket.off('leylek_pair_request_sent', onSent);
    };
    const onSent = () => {
      if (tmo) {
        clearTimeout(tmo);
        tmo = null;
      }
      offPair();
      finish();
      lastLeylekPairRequestAtRef.current = Date.now();
      pushSystemCard('blue', 'Eşleşme isteği gönderildi.');
      Alert.alert('Eşleşme isteği gönderildi.', 'Karşı taraf onaylarsa eşleşme tamamlanır.');
    };
    const onErr = (p: { code?: string; detail?: string }) => {
      if (tmo) {
        clearTimeout(tmo);
        tmo = null;
      }
      offPair();
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
      offPair();
      finish();
      const code = String(p?.code || '');
      if (code === 'pending') {
        pushSystemCard('orange', p?.message || 'Karşı tarafta bekleyen bir eşleşme isteği var.');
        Alert.alert('Bekleyen istek', p?.message || 'Zaten bir eşleşme isteğiniz var.');
        return;
      }
      Alert.alert('Bilgi', p?.message || 'İşlem tamam.');
    };
    try {
      const ready = await ensureSocketReadyForSend();
      if (!ready) {
        finish();
        Alert.alert('Sohbet', 'Sohbet bağlantısı kuruluyor, lütfen birazdan tekrar deneyin.');
        return;
      }
      offPair();
      socket.on('leylek_pair_error', onErr);
      socket.on('leylek_pair_info', onInfo);
      socket.on('leylek_pair_request_sent', onSent);
      tmo = setTimeout(() => {
        tmo = null;
        offPair();
        finish();
        Alert.alert('Zaman aşımı', 'Sunucudan yanıt alınamadı. Bağlantınızı kontrol edin.');
      }, 15000);
      try {
        socket.emit('join_muhabbet_conversation', { conversation_id: cid });
      } catch {
        /* noop */
      }
      console.log('[chat] send leylek pair request conversation=', cid);
      const payload = { conversation_id: cid };
      console.log("[leylek-pair] emit payload", payload);
      socket.emit('leylek_pair_match_request', payload);
    } catch {
      if (tmo) {
        clearTimeout(tmo);
        tmo = null;
      }
      offPair();
      finish();
      Alert.alert('Bağlantı hatası', 'İnternet bağlantınızı kontrol edin.');
    }
  }, [cid, ensureSocketReadyForSend, pairRequestLoading, pushSystemCard]);

  const profileTarget = (otherUserId || ctx?.other_user_id || '').trim();
  const headerRight = profileTarget ? (
    <Pressable onPress={openOtherProfile} style={styles.headerIcon} accessibilityRole="button">
      <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
    </Pressable>
  ) : null;

  const myR = (ctx?.my_role || '').toLowerCase();
  const oR = (ctx?.other_role || '').toLowerCase();
  const chatHeaderTitle =
    (ctx?.other_user_public_name && String(ctx.other_user_public_name).trim()) ||
    (ctx?.public_name && String(ctx.public_name).trim()) ||
    'Leylek kullanıcısı';
  const chatHeaderRole = (ctx?.other_user_role_label && String(ctx.other_user_role_label).trim()) || (isDriverAppRole(oR) ? 'Sürücü' : 'Yolcu');
  const chatHeaderPhoto = (ctx?.other_user_profile_photo_url || '').trim();

  const bubbleForMsg = (item: ChatMessageRow) => {
    const mine = myId && String(item.sender_user_id || '').toLowerCase() === myId;
    const srStored = (item.sender_role && String(item.sender_role).trim()) || '';
    const sr = srStored || (mine ? myR : oR);
    const drv = isDriverAppRole(sr);
    return { mine, drv };
  };

  const closePairModalDecline = useCallback(() => {
    if (!cid || !pairInModal) return;
    const socket = getOrCreateSocket();
    try {
      socket.emit('leylek_pair_decline', { conversation_id: cid, request_id: pairInModal.rid });
    } catch {
      /* noop */
    }
    setPairInModal(null);
  }, [cid, pairInModal]);

  const acceptPairFromModal = useCallback(() => {
    if (!cid || !pairInModal) return;
    const socket = getOrCreateSocket();
    try {
      socket.emit('join_muhabbet_conversation', { conversation_id: cid });
    } catch {
      /* noop */
    }
    try {
      socket.emit('leylek_pair_accept', { conversation_id: cid, request_id: pairInModal.rid });
    } catch {
      /* noop */
    }
    pushSystemCard('green', 'Karşı taraf kabul etti. Eşleşme tamamlanıyor...');
    setPairInModal(null);
  }, [cid, pairInModal, pushSystemCard]);

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
          title={chatHeaderTitle}
          onBack={onBack ?? (() => router.back())}
          gradientColors={PRIMARY_GRAD}
          right={headerRight}
        />
        <Pressable onPress={openOtherProfile} style={styles.peerHeaderCard}>
          {chatHeaderPhoto ? (
            <Image source={{ uri: chatHeaderPhoto }} style={styles.peerAvatar} />
          ) : (
            <View style={styles.peerAvatarFallback}>
              <Text style={styles.peerAvatarInitials}>{chatInitials(chatHeaderTitle)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.peerName} numberOfLines={1}>{chatHeaderTitle}</Text>
            <View style={styles.peerBadgesRow}>
              <Text style={[styles.peerRolePill, chatHeaderRole === 'Sürücü' ? styles.peerRoleDriver : styles.peerRolePax]}>{chatHeaderRole}</Text>
              {ctx?.matched_via_leylek_key ? (
                <Text style={styles.peerMatchedPill}>Leylek Anahtar eşleşti</Text>
              ) : (
                <Text style={styles.peerPreviewPill}>Ön görüşme</Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>
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
          {bootstrapPhase === 'loading' ? (
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
                  {ctx?.matched_at ? (
                    <View style={styles.systemPermanentOk}>
                      <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                      <Text style={styles.systemPermanentOkTxt}>Leylek Anahtar ile eşleşme tamamlandı</Text>
                    </View>
                  ) : null}
                  {ctx?.matched_via_leylek_key ? (
                    <View style={styles.secureMatchCard}>
                      <View style={styles.secureMatchHeader}>
                        <View style={styles.secureMatchIcon}>
                          <Ionicons name="shield-checkmark" size={20} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.secureMatchTitle}>
                            Leylek Anahtarı ile güvenli bağlantı kuruldu
                          </Text>
                          <Text style={styles.secureMatchSub}>
                            Bu eşleşme Leylek Teklif Sende içinde doğrulandı. Sohbete devam edebilir, anlaşma detaylarını netleştirebilirsiniz.
                          </Text>
                        </View>
                      </View>
                      <View style={styles.secureStatusList}>
                        <View style={styles.secureStatusItem}>
                          <Ionicons name="person-circle-outline" size={15} color="#15803D" />
                          <Text style={styles.secureStatusTxt}>Kimlik: Leylek profili</Text>
                        </View>
                        <View style={styles.secureStatusItem}>
                          <Ionicons name="checkmark-circle-outline" size={15} color="#15803D" />
                          <Text style={styles.secureStatusTxt}>Durum: Eşleşme doğrulandı</Text>
                        </View>
                        <View style={styles.secureStatusItem}>
                          <Ionicons name="car-sport-outline" size={15} color="#15803D" />
                          <Text style={styles.secureStatusTxt}>Sonraki adım: Anlaşmayı yolculuğa çevir</Text>
                        </View>
                      </View>
                      {/* Leylek Teklif Sende only: UI-only plan, no backend or normal ride call. */}
                      <Pressable
                        disabled
                        style={styles.convertPlanButton}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: true }}
                        accessibilityLabel="Bu anlaşmayı yolculuğa çevir"
                      >
                        <Ionicons name="car-sport-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                        <Text style={styles.convertPlanButtonTxt}>Bu anlaşmayı yolculuğa çevir</Text>
                      </Pressable>
                      <Text style={styles.convertPlanSub}>
                        Yakında: Bu sohbet anlaşmasını güvenli yolculuğa dönüştürebileceksiniz.
                      </Text>
                    </View>
                  ) : null}
                  {hasOutgoingPendingPairRequest ? (
                    <View style={styles.systemPermanentPending}>
                      <Ionicons name="time-outline" size={15} color="#1D4ED8" />
                      <Text style={styles.systemPermanentPendingTxt}>
                        Leylek Anahtarı eşleşme isteği gönderildi, yanıt bekleniyor.
                      </Text>
                    </View>
                  ) : null}
                  {systemCards.map((s) => (
                    <View
                      key={s.id}
                      style={[
                        styles.systemCard,
                        s.tone === 'green' ? styles.systemCardGreen : s.tone === 'orange' ? styles.systemCardOrange : styles.systemCardBlue,
                      ]}
                    >
                      <Text style={styles.systemCardTxt}>{s.text}</Text>
                    </View>
                  ))}
                  {!roomJoined ? (
                    <View style={styles.connectingStrip} accessibilityRole="alert">
                      <ActivityIndicator size="small" color={PRIMARY_GRAD[0]} style={{ marginRight: 8 }} />
                      <Text style={styles.connectingStripTxt}>Sohbet bağlantısı kuruluyor…</Text>
                    </View>
                  ) : null}
                  {!infoStripDismissed ? (
                    <Animated.View style={[styles.compactInfoOuter, { opacity: infoFade }]}>
                      <View
                        style={[
                          styles.compactInfoCard,
                          infoRotateIx === 0 ? styles.compactInfoPrivacy : styles.compactInfoSafety,
                        ]}
                      >
                        <Pressable
                          accessibilityLabel="Bilgi kartını kapat"
                          onPress={() => setInfoStripDismissed(true)}
                          style={styles.compactInfoClose}
                          hitSlop={10}
                        >
                          <Ionicons name="close-circle" size={18} color="rgba(100,116,139,0.95)" />
                        </Pressable>
                        <Text style={styles.compactInfoTxt}>
                          {infoRotateIx === 0 ? INFO_PRIVACY : INFO_SAFETY}
                        </Text>
                      </View>
                    </Animated.View>
                  ) : null}
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
                            <Text
                              style={styles.tGrad}
                              selectable
                              {...(Platform.OS === 'android' ? { textBreakStrategy: 'highQuality' as const } : {})}
                            >
                              {item.body || ''}
                            </Text>
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
                          <Text
                            style={styles.tGrad}
                            selectable
                            {...(Platform.OS === 'android' ? { textBreakStrategy: 'highQuality' as const } : {})}
                          >
                            {item.body || ''}
                          </Text>
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
        <Modal
          visible={!!pairInModal}
          transparent
          animationType="fade"
          onRequestClose={closePairModalDecline}
        >
          <View style={styles.pairModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closePairModalDecline} />
            <View style={styles.pairModalCard}>
              <Text style={styles.pairModalTitle}>Leylek Anahtar eşleşme isteği</Text>
              <Text style={styles.pairModalBody}>
                {chatHeaderTitle} ile güzergâh, ücret ve buluşma bilgilerini onayladıysanız eşleşebilirsiniz.
              </Text>
              <Pressable
                onPress={acceptPairFromModal}
                style={({ pressed }) => [styles.pairModalPri, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Eşleş"
              >
                <Text style={styles.pairModalPriTxt}>Eşleş</Text>
              </Pressable>
              <Pressable
                onPress={closePairModalDecline}
                style={({ pressed }) => [styles.pairModalSec, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel="Müsait değilim"
              >
                <Text style={styles.pairModalSecTxt}>Müsait değilim</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
  peerHeaderCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...BUBBLE_SHADOW,
  },
  peerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E5E7EB' },
  peerAvatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  peerAvatarInitials: { color: '#1D4ED8', fontSize: 13, fontWeight: '800' },
  peerName: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY },
  peerBadgesRow: { marginTop: 4, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  peerRolePill: { fontSize: 10, fontWeight: '800', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 7, overflow: 'hidden' },
  peerRoleDriver: { color: '#1D4ED8', backgroundColor: 'rgba(37,99,235,0.14)' },
  peerRolePax: { color: '#C2410C', backgroundColor: 'rgba(249,115,22,0.18)' },
  peerMatchedPill: { fontSize: 10, fontWeight: '800', color: '#15803D', backgroundColor: 'rgba(22,163,74,0.14)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 7, overflow: 'hidden' },
  peerPreviewPill: { fontSize: 10, fontWeight: '800', color: '#B45309', backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 7, overflow: 'hidden' },
  systemPermanentOk: { marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(22,163,74,0.14)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  systemPermanentOkTxt: { color: '#166534', fontSize: 12, fontWeight: '700' },
  systemPermanentPending: { marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(37,99,235,0.12)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  systemPermanentPendingTxt: { color: '#1D4ED8', fontSize: 12, fontWeight: '700', flex: 1 },
  systemCard: { marginHorizontal: 14, marginBottom: 6, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10 },
  systemCardBlue: { backgroundColor: 'rgba(37,99,235,0.12)' },
  systemCardGreen: { backgroundColor: 'rgba(22,163,74,0.12)' },
  systemCardOrange: { backgroundColor: 'rgba(245,158,11,0.16)' },
  systemCardTxt: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
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
  compactInfoOuter: { marginBottom: 8, paddingHorizontal: 2 },
  compactInfoCard: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '96%',
    alignSelf: 'center',
  },
  compactInfoPrivacy: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderColor: 'rgba(22, 163, 74, 0.22)',
  },
  compactInfoSafety: {
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    borderColor: 'rgba(234, 88, 12, 0.28)',
  },
  compactInfoClose: { position: 'absolute', right: 6, top: 6, zIndex: 2, padding: 2 },
  compactInfoTxt: {
    fontSize: 11,
    lineHeight: 15,
    color: '#334155',
    fontWeight: '600',
  },
  bubbleColMine: { alignSelf: 'flex-end', maxWidth: '78%', marginBottom: 8, flexShrink: 1 },
  bubbleColTheirs: { alignSelf: 'flex-start', maxWidth: '78%', marginBottom: 8, flexShrink: 1 },
  bubbleRowMine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bubbleRowTheirs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  trashHit: { padding: 2 },
  bubbleMax: { maxWidth: '78%' },
  bubbleShadowWrap: { ...BUBBLE_SHADOW, borderRadius: 18, maxWidth: '100%' },
  bubbleAlignEnd: { alignSelf: 'flex-end' },
  bubbleAlignStart: { alignSelf: 'flex-start' },
  bubblePad: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, flexShrink: 1, maxWidth: '100%' },
  tGrad: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '100%',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
  secureMatchCard: { marginHorizontal: 14, marginBottom: 10, borderRadius: 18, padding: 14, backgroundColor: '#F0FDF4', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(22,163,74,0.28)' },
  secureMatchHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  secureMatchIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A' },
  secureMatchTitle: { color: '#14532D', fontSize: 16, fontWeight: '900', lineHeight: 21 },
  secureMatchSub: { marginTop: 6, color: '#166534', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  secureStatusList: { marginTop: 12, gap: 7 },
  secureStatusItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secureStatusTxt: { color: '#14532D', fontSize: 12, fontWeight: '800', flex: 1 },
  convertPlanButton: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(148,163,184,0.18)' },
  convertPlanButtonTxt: { color: '#475569', fontSize: 15, fontWeight: '800' },
  convertPlanSub: { marginTop: 8, color: '#64748B', fontSize: 12, fontWeight: '600', lineHeight: 17, textAlign: 'center' },
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
  pairModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pairModalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    zIndex: 2,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  pairModalTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  pairModalBody: { marginTop: 10, fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22 },
  pairModalPri: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
  },
  pairModalPriTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  pairModalSec: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(60,60,67,0.1)',
    alignItems: 'center',
  },
  pairModalSecTxt: { fontSize: 16, fontWeight: '600', color: '#374151' },
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
