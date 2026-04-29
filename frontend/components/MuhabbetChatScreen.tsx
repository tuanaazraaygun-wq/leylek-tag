/**
 * Muhabbet 1:1 sohbet — mesaj metni sunucuda saklanır (REST POST); Socket.IO isteğe bağlı realtime için.
 * Gönderim ana yolu: POST /muhabbet/conversations/{id}/messages (socket zorunlu değil).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  FlatList,
  Image,
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
import { getLastRegisteredSocketSid, getOrCreateSocket } from '../contexts/SocketContext';
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
import type { MuhabbetTripSessionSocketPayload } from '../lib/muhabbetTripTypes';

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
  /** Teklif kabulü veya Leylek anahtar sonrası Yolculuğa çevir için uygun */
  trip_convert_eligible?: boolean;
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

type PendingMuhabbetAction =
  | { kind: 'send_message'; messageId: string; body: string; retryCount: number }
  | { kind: 'trip_convert_request'; retryCount: number }
  | { kind: 'trip_convert_accept'; requestId: string; retryCount: number }
  | { kind: 'trip_convert_decline'; requestId: string; retryCount: number };

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
  /**
   * bootstrapPhase `loading`: ilk okuma
   * `local`: yerel liste gösterilir, API ile birleştirme sürer
   * `ready`: birleştirme bitti; socket join açılır
   */
  const [bootstrapPhase, setBootstrapPhase] = useState<'loading' | 'local' | 'ready'>('loading');
  const [rows, setRows] = useState<ChatMessageRow[]>([]);
  const rowsRef = useRef<ChatMessageRow[]>([]);
  rowsRef.current = rows;
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [draft, setDraft] = useState('');
  const [tripConvertInModal, setTripConvertInModal] = useState<{ rid: string } | null>(null);
  const [tripConvertLoading, setTripConvertLoading] = useState(false);
  const [tripConvertState, setTripConvertState] = useState<'idle' | 'pending' | 'confirmed'>('idle');
  const [tripLockReason, setTripLockReason] = useState<string | null>(null);
  const tripConvertStateRef = useRef<'idle' | 'pending' | 'confirmed'>('idle');
  const tripSessionNavRef = useRef<string | null>(null);
  /** Üst bilgi şeridi: küçük kartlar, kapatılabilir / dönüşümlü */
  const [infoStripDismissed, setInfoStripDismissed] = useState(false);
  const [infoRotateIx, setInfoRotateIx] = useState(0);
  const [systemCards, setSystemCards] = useState<ChatSystemCard[]>([]);
  const infoFade = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const ctxRef = useRef<ChatContext | null>(null);
  /** Sohbet odası (joined_muhabbet) — mesaj almak için gerekli */
  const [roomJoined, setRoomJoined] = useState(false);
  const roomJoinedRef = useRef(false);
  /** Ekran mount / unmount: açıkken message_seen gönder */
  const chatSessionActiveRef = useRef(true);
  const pendingActionRef = useRef<PendingMuhabbetAction | null>(null);
  const readinessInFlightRef = useRef(false);

  const tripLockActive = !!tripLockReason || tripConvertState === 'pending' || tripConvertState === 'confirmed';

  const keyboardOffset = insets.top + (Platform.OS === 'ios' ? 52 : 12);
  const pushSystemCard = useCallback((tone: ChatSystemCard['tone'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSystemCards((prev) => [...prev, { id, tone, text }].slice(-8));
  }, []);

  const sendMessageViaRest = useCallback(
    async (messageId: string, body: string): Promise<boolean> => {
      const mid = normalizeMuhabbetMessageId(messageId);
      const text = String(body || '').trim();
      if (!cid || !mid || !text) return false;
      try {
        const token = (await getPersistedAccessToken())?.trim();
        if (!token) {
          setRows((prev) => markMessageFailedById(prev, mid));
          return false;
        }
        const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: text, message_id: mid }),
        });
        if (handleUnauthorizedAndMaybeRedirect(res)) {
          setRows((prev) => markMessageFailedById(prev, mid));
          return false;
        }
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          message?: { id?: string; body?: string; sender_user_id?: string; created_at?: string };
          detail?: string;
        };
        if (!res.ok || !data.success) {
          setRows((prev) => markMessageFailedById(prev, mid));
          return false;
        }
        const serverMessage = data.message || {};
        const serverId = normalizeMuhabbetMessageId(serverMessage.id || mid) || mid;
        if (pendingActionRef.current?.kind === 'send_message' && pendingActionRef.current.messageId === mid) {
          pendingActionRef.current = null;
        }
        setRows((prev) =>
          prev.map((m) =>
            rowIdLo(m) === mid
              ? {
                  ...m,
                  id: serverId,
                  body: serverMessage.body != null ? String(serverMessage.body) : m.body,
                  sender_user_id: serverMessage.sender_user_id != null ? String(serverMessage.sender_user_id).trim().toLowerCase() : m.sender_user_id,
                  created_at: coerceMessageCreatedAt(serverMessage.created_at || m.created_at),
                  out_status: 'sent' as const,
                }
              : m
          )
        );
        DeviceEventEmitter.emit(MUHABBET_NEW_LOCAL_MESSAGE, {
          type: 'muhabbet_message',
          conversation_id: cid,
          text,
          sender_id: myIdRef.current,
          created_at: serverMessage.created_at || new Date().toISOString(),
        });
        return true;
      } catch {
        setRows((prev) => markMessageFailedById(prev, mid));
        return false;
      }
    },
    [base, cid]
  );

  /** GET mesajlar + yerel birleştirme (periyodik çekim ve ilk yükleme sonrası sync). */
  const pullMessagesFromApi = useCallback(async (): Promise<boolean> => {
    if (!cid) return false;
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setCtx(null);
        return false;
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
        return false;
      }
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        context?: ChatContext;
        messages?: { id?: string; body?: string; sender_user_id?: string; created_at?: string }[];
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
        setRows(displayRows);
        setCtx(d.context || null);
        return true;
      }
      setCtx(null);
      return false;
    } catch {
      setCtx(null);
      return false;
    }
  }, [base, cid]);

  const waitForMuhabbetJoin = useCallback(
    (socket: Socket, timeoutMs: number): Promise<'joined' | 'not_registered' | 'forbidden' | 'timeout'> => {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (status: 'joined' | 'not_registered' | 'forbidden' | 'timeout') => {
          if (settled) return;
          settled = true;
          clearTimeout(tid);
          socket.off('joined_muhabbet', onJoined);
          socket.off('muhabbet_error', onErr);
          resolve(status);
        };
        const tid = setTimeout(() => finish('timeout'), timeoutMs);
        const onJoined = (p: { conversation_id?: string }) => {
          const conv = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
          if (!conv || conv !== cid.toLowerCase()) return;
          roomJoinedRef.current = true;
          setRoomJoined(true);
          finish('joined');
        };
        const onErr = (p: { code?: string; conversation_id?: string }) => {
          const conv = p?.conversation_id != null ? String(p.conversation_id).trim().toLowerCase() : '';
          if (conv && conv !== cid.toLowerCase()) return;
          if (p?.code === 'not_registered') finish('not_registered');
          else if (p?.code === 'forbidden') finish('forbidden');
        };
        socket.on('joined_muhabbet', onJoined);
        socket.on('muhabbet_error', onErr);
        socket.emit('join_muhabbet_conversation', { conversation_id: cid });
      });
    },
    [cid]
  );

  const ensureMuhabbetSocketReady = useCallback(async (): Promise<boolean> => {
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
    const currentSid = socket.id || null;
    const lastRegisteredSid = getLastRegisteredSocketSid();
    if (currentSid && lastRegisteredSid && currentSid !== lastRegisteredSid) {
      notifyAuthTokenBecameAvailableForSocket();
    }
    readinessInFlightRef.current = true;
    try {
      let joinStatus = await waitForMuhabbetJoin(socket, 5000);
      if (joinStatus === 'joined') return true;
      if (joinStatus === 'forbidden') return false;

      notifyAuthTokenBecameAvailableForSocket();
      await waitForNextRegisterSuccess(socket, 16000);
      joinStatus = await waitForMuhabbetJoin(socket, 7000);
      return joinStatus === 'joined';
    } finally {
      readinessInFlightRef.current = false;
    }
  }, [cid, waitForMuhabbetJoin]);

  const retryPendingActionAfterNotRegistered = useCallback(async () => {
    const pending = pendingActionRef.current;
    if (!pending) return false;
    if (pending.retryCount >= 1) return false;
    if (pending.kind === 'send_message') {
      pendingActionRef.current = { ...pending, retryCount: pending.retryCount + 1 } as PendingMuhabbetAction;
      await sendMessageViaRest(pending.messageId, pending.body);
      return true;
    }
    const ready = await ensureMuhabbetSocketReady();
    if (!ready) return false;
    const socket = getOrCreateSocket();
    if (!socket.connected) return false;
    pendingActionRef.current = { ...pending, retryCount: pending.retryCount + 1 } as PendingMuhabbetAction;
    if (pending.kind === 'trip_convert_request') {
      socket.emit('muhabbet_trip_convert_request', { conversation_id: cid });
      return true;
    }
    if (pending.kind === 'trip_convert_accept') {
      socket.emit('muhabbet_trip_convert_accept', { conversation_id: cid, request_id: pending.requestId });
      return true;
    }
    if (pending.kind === 'trip_convert_decline') {
      socket.emit('muhabbet_trip_convert_decline', { conversation_id: cid, request_id: pending.requestId });
      return true;
    }
    return false;
  }, [cid, ensureMuhabbetSocketReady, sendMessageViaRest]);

  const retryPendingActionAfterReconnect = useCallback(
    (messageId?: string) => {
      setTimeout(() => {
        void (async () => {
          const retried = await retryPendingActionAfterNotRegistered();
          if (retried) return;
          const pending = pendingActionRef.current;
          if (messageId && pending?.kind === 'send_message' && pending.messageId === messageId) {
            pendingActionRef.current = null;
            void sendMessageViaRest(messageId, pending.body);
            return;
          }
          if (pending && pending.kind !== 'send_message') {
            pendingActionRef.current = null;
          }
        })();
      }, 1500);
    },
    [retryPendingActionAfterNotRegistered, sendMessageViaRest]
  );

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  useEffect(() => {
    tripConvertStateRef.current = tripConvertState;
  }, [tripConvertState]);

  const navigateToLeylekTripSession = useCallback((payload?: MuhabbetTripSessionSocketPayload | null) => {
    const sessionId = String(payload?.session_id || payload?.sessionId || payload?.session?.id || '').trim().toLowerCase();
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      Alert.alert(
        'Yolculuk',
        'Yolculuk oturumu hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin.'
      );
      return;
    }
    if (tripSessionNavRef.current === sessionId) return;
    setTripLockReason('route /leylek-trip/[sessionId] is about to open');
    tripSessionNavRef.current = sessionId;
    router.push(`/leylek-trip/${encodeURIComponent(sessionId)}` as Href);
  }, [router]);

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
      return;
    }
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
      setRows(mapped);
    } catch {
      localItems = [];
      setRows([]);
    }
    setBootstrapPhase('local');

    try {
      await pullMessagesFromApi();
    } catch {
      setCtx(null);
    } finally {
      setBootstrapPhase('ready');
    }
  }, [cid, pullMessagesFromApi]);

  const fetchMessages = useCallback(async () => {
    if (!cid) return;
    await pullMessagesFromApi();
  }, [cid, pullMessagesFromApi]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!cid || bootstrapPhase !== 'ready') return;
    const pollId = setInterval(() => {
      void fetchMessages();
    }, 12000);
    return () => clearInterval(pollId);
  }, [cid, bootstrapPhase, fetchMessages]);

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
        pushSystemCard('green', 'Eşleşme tamamlandı.');
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

  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const cidLo = cid.toLowerCase();
    const convMatches = (data: { conversation_id?: string }) => {
      const conv = data?.conversation_id != null ? String(data.conversation_id).trim().toLowerCase() : '';
      return !!conv && conv === cidLo;
    };
    const onConvertRequest = (data: { conversation_id?: string; request_id?: string }) => {
            if (!convMatches(data)) return;
      const rid = data?.request_id != null ? String(data.request_id).trim().toLowerCase() : '';
      if (!rid) return;
      const myRole = String(ctxRef.current?.my_role || '').trim().toLowerCase();
      if (isDriverAppRole(myRole)) return;
      setTripConvertState('pending');
      setTripLockReason('muhabbet_trip_convert_request pending');
      setTripConvertInModal({ rid });
    };
    const onConvertSent = (data: { conversation_id?: string }) => {
            if (!convMatches(data)) return;
      if (pendingActionRef.current?.kind === 'trip_convert_request') pendingActionRef.current = null;
      setTripConvertLoading(false);
      setTripConvertState('pending');
      setTripLockReason('muhabbet_trip_convert_request_sent');
    };
    const onConvertConfirmed = (data: MuhabbetTripSessionSocketPayload) => {
            if (!convMatches(data)) return;
      if (
        pendingActionRef.current?.kind === 'trip_convert_request' ||
        pendingActionRef.current?.kind === 'trip_convert_accept'
      ) {
        pendingActionRef.current = null;
      }
      setTripConvertLoading(false);
      setTripConvertInModal(null);
      setTripConvertState('confirmed');
      setTripLockReason('muhabbet_trip_convert_confirmed');
      if (tripConvertStateRef.current !== 'confirmed') {
        pushSystemCard('green', 'Yolculuk başlatma isteği kabul edildi.');
      }
      navigateToLeylekTripSession(data);
    };
    const onSessionReady = (data: MuhabbetTripSessionSocketPayload) => {
                  if (!convMatches(data)) return;
      if (
        pendingActionRef.current?.kind === 'trip_convert_request' ||
        pendingActionRef.current?.kind === 'trip_convert_accept'
      ) {
        pendingActionRef.current = null;
      }
      setTripConvertState('confirmed');
      setTripLockReason('muhabbet_trip_session_ready');
      navigateToLeylekTripSession(data);
    };
    const onConvertDeclined = (data: { conversation_id?: string }) => {
            if (!convMatches(data)) return;
      if (
        pendingActionRef.current?.kind === 'trip_convert_request' ||
        pendingActionRef.current?.kind === 'trip_convert_decline'
      ) {
        pendingActionRef.current = null;
      }
      setTripConvertLoading(false);
      setTripConvertState('idle');
      setTripLockReason(null);
      pushSystemCard('orange', 'Yolculuğa çevirme isteği reddedildi.');
      Alert.alert('Yolculuğa çevir', 'Karşı taraf şu an kabul etmedi.');
    };
    const onConvertError = (data: { code?: string; detail?: string; message?: string }) => {
            if (data?.code === 'not_registered') {
        void (async () => {
          const retried = await retryPendingActionAfterNotRegistered();
          if (retried) return;
          pendingActionRef.current = null;
          setTripConvertLoading(false);
          setTripConvertState('idle');
          setTripLockReason(null);
          Alert.alert('Yolculuğa çevir', data?.detail || data?.message || 'Bağlantı hazırlanıyor. Lütfen tekrar deneyin.');
        })();
        return;
      }
      pendingActionRef.current = null;
      setTripConvertLoading(false);
      setTripConvertState('idle');
      setTripLockReason(null);
      if (data?.code === 'driver_required') {
        Alert.alert('Yolculuğa çevir', 'Bu isteği yalnızca sürücü başlatabilir.');
        return;
      }
      Alert.alert('Yolculuğa çevir', data?.detail || data?.message || 'İstek gönderilemedi.');
    };
    socket.on('muhabbet_trip_convert_request', onConvertRequest);
    socket.on('muhabbet_trip_convert_request_sent', onConvertSent);
    socket.on('muhabbet_trip_convert_confirmed', onConvertConfirmed);
    socket.on('muhabbet_trip_session_ready', onSessionReady);
    socket.on('muhabbet_trip_convert_declined', onConvertDeclined);
    socket.on('muhabbet_trip_convert_error', onConvertError);
    return () => {
      socket.off('muhabbet_trip_convert_request', onConvertRequest);
      socket.off('muhabbet_trip_convert_request_sent', onConvertSent);
      socket.off('muhabbet_trip_convert_confirmed', onConvertConfirmed);
      socket.off('muhabbet_trip_session_ready', onSessionReady);
      socket.off('muhabbet_trip_convert_declined', onConvertDeclined);
      socket.off('muhabbet_trip_convert_error', onConvertError);
    };
  }, [cid, navigateToLeylekTripSession, pushSystemCard, retryPendingActionAfterNotRegistered]);

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
      const regOk = await waitForNextRegisterSuccess(socket, 15000);
      if (cancelled) return;
      if (!regOk) {
        console.warn('[chat] register ack timeout — join atlanıyor; tekrar denenecek');
        return;
      }
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
      if (pendingActionRef.current?.kind === 'send_message' && pendingActionRef.current.messageId === mid) {
        pendingActionRef.current = null;
      }
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

    const refreshChatSocketSession = (_reason: string) => {
      if (cancelled) return;
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
    };
  }, [cid, bootstrapPhase]);

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
      void fetchMessages();
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
  }, [cid, bootstrapPhase, fetchMessages]);

  useEffect(() => {
    if (!cid) return;
    const socket = getOrCreateSocket();
    const onMuErr = (p: { code?: string; detail?: string; message?: string; message_id?: string; conversation_id?: string; max?: number }) => {
      const conv = p?.conversation_id != null ? String(p.conversation_id).toLowerCase() : '';
      if (conv && conv !== cid.toLowerCase()) return;
      const det = typeof p?.detail === 'string' ? p.detail : '';
      const msg = typeof p?.message === 'string' ? p.message : '';
      const errMid = normalizeMuhabbetMessageId(p?.message_id);
            if (p?.code === 'text_too_long') {
        Alert.alert('Mesaj çok uzun', det || `En fazla ${p?.max ?? 2000} karakter.`);
        return;
      }
      if (p?.code === 'not_registered') {
        notifyAuthTokenBecameAvailableForSocket();
        if (readinessInFlightRef.current && !errMid) {
          return;
        }
        void (async () => {
          const retried = await retryPendingActionAfterNotRegistered();
          if (retried) return;
          const pending = pendingActionRef.current;
          if (pending?.kind === 'send_message') {
            pendingActionRef.current = null;
            await sendMessageViaRest(pending.messageId, pending.body);
            return;
          }
          pendingActionRef.current = null;
          if (errMid) {
            const row = rowsRef.current.find((m) => rowIdLo(m) === errMid);
            if (row?.body) {
              await sendMessageViaRest(errMid, row.body);
              return;
            }
          }
          setRows((prev) => (errMid ? markMessageFailedById(prev, errMid) : markLatestSendingFailed(prev)));
        })();
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
  }, [cid, retryPendingActionAfterNotRegistered, sendMessageViaRest]);

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

  const resendMessage = useCallback(
    async (row: ChatMessageRow) => {
      const body = (row.body || '').trim();
      const messageId = row.id;
      if (!body || !cid || !messageId) return;

      setRows((prev) =>
        prev.map((m) => (rowIdLo(m) === rowIdLo({ id: messageId }) ? { ...m, out_status: 'sending' as const } : m))
      );
      pendingActionRef.current = { kind: 'send_message', messageId, body, retryCount: 0 };
      const ok = await sendMessageViaRest(messageId, body);
      if (!ok) {
        pendingActionRef.current = null;
        return;
      }
      try {
        const sock = getOrCreateSocket();
        if (sock.connected) {
          sock.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
        }
      } catch {
        /* noop — REST başarılı; socket opsiyonel */
      }
    },
    [cid, sendMessageViaRest]
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || !cid) return;
    const myLo = (myIdRef.current || myId || '').trim().toLowerCase();
    if (!myLo) {
      Alert.alert('Sohbet', 'Kullanıcı bilgisi yüklenemedi.');
      return;
    }
    const messageId = normalizeMuhabbetMessageId(newClientMessageUuid());
    const roleMine = (ctx?.my_role || '').trim().toLowerCase();
    const createdIso = coerceMessageCreatedAt(undefined);
    setRows((p) => {
      if (p.some((m) => rowIdLo(m) === messageId)) return p;
      return sortRowsByCreatedAtAsc([
        ...p,
        {
          id: messageId,
          body,
          sender_user_id: myLo,
          created_at: createdIso,
          out_status: 'sending',
          sender_role: roleMine || null,
        },
      ]);
    });
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    setDraft('');
    pendingActionRef.current = { kind: 'send_message', messageId, body, retryCount: 0 };
    const ok = await sendMessageViaRest(messageId, body);
    if (!ok) {
      pendingActionRef.current = null;
      return;
    }
    try {
      const sock = getOrCreateSocket();
      if (sock.connected) {
        sock.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
      }
    } catch {
      /* noop */
    }
  };

  const openOtherProfile = useCallback(() => {
    const ou = (otherUserId || ctx?.other_user_id || '').trim();
    if (!ou) return;
    router.push(`/muhabbet-profile/${encodeURIComponent(ou)}` as Href);
  }, [otherUserId, ctx, router]);

  const profileTarget = (otherUserId || ctx?.other_user_id || '').trim();
  const headerRight = profileTarget ? (
    <Pressable onPress={openOtherProfile} style={styles.headerIcon} accessibilityRole="button">
      <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
    </Pressable>
  ) : null;

  const myR = (ctx?.my_role || '').toLowerCase();
  const oR = (ctx?.other_role || '').toLowerCase();
  const currentUserIsDriver = isDriverAppRole(myR);
  const chatHeaderTitle =
    (ctx?.other_user_public_name && String(ctx.other_user_public_name).trim()) ||
    (ctx?.public_name && String(ctx.public_name).trim()) ||
    'Leylek kullanıcısı';
  const chatHeaderRole = (ctx?.other_user_role_label && String(ctx.other_user_role_label).trim()) || (isDriverAppRole(oR) ? 'Sürücü' : 'Yolcu');
  const chatHeaderPhoto = (ctx?.other_user_profile_photo_url || '').trim();
  const tripConvertEligible = !!(ctx?.trip_convert_eligible ?? ctx?.matched_via_leylek_key);

  const bubbleForMsg = (item: ChatMessageRow) => {
    const mine = myId && String(item.sender_user_id || '').toLowerCase() === myId;
    const srStored = (item.sender_role && String(item.sender_role).trim()) || '';
    const sr = srStored || (mine ? myR : oR);
    const drv = isDriverAppRole(sr);
    return { mine, drv };
  };

  const sendTripConvertRequest = useCallback(async () => {
    if (!cid || tripConvertLoading || tripConvertState !== 'idle') return;
    setTripConvertLoading(true);
    pendingActionRef.current = { kind: 'trip_convert_request', retryCount: 0 };
    const ready = await ensureMuhabbetSocketReady();
    if (!ready) {
      setTripConvertLoading(false);
      retryPendingActionAfterReconnect();
      return;
    }
    const socket = getOrCreateSocket();
    if (!socket.connected) {
      setTripConvertLoading(false);
      retryPendingActionAfterReconnect();
      return;
    }
    setTripConvertState('pending');
    setTripLockReason('muhabbet_trip_convert_request pending');
    socket.emit('muhabbet_trip_convert_request', { conversation_id: cid });
    setTimeout(() => setTripConvertLoading(false), 15000);
  }, [cid, ensureMuhabbetSocketReady, retryPendingActionAfterReconnect, tripConvertLoading, tripConvertState]);

  const acceptTripConvertFromModal = useCallback(async () => {
    if (!cid || !tripConvertInModal) return;
    const requestId = tripConvertInModal.rid;
    pendingActionRef.current = { kind: 'trip_convert_accept', requestId, retryCount: 0 };
    const ready = await ensureMuhabbetSocketReady();
    if (!ready) {
      pendingActionRef.current = null;
      Alert.alert('Yolculuğa çevir', 'Sohbet bağlantısı kuruluyor, lütfen birazdan tekrar deneyin.');
      return;
    }
    const socket = getOrCreateSocket();
    socket.emit('muhabbet_trip_convert_accept', {
      conversation_id: cid,
      request_id: requestId,
    });
    setTripConvertInModal(null);
  }, [cid, ensureMuhabbetSocketReady, tripConvertInModal]);

  const declineTripConvertFromModal = useCallback(async () => {
    if (!cid || !tripConvertInModal) return;
    const requestId = tripConvertInModal.rid;
    pendingActionRef.current = { kind: 'trip_convert_decline', requestId, retryCount: 0 };
    const ready = await ensureMuhabbetSocketReady();
    if (!ready) {
      pendingActionRef.current = null;
      Alert.alert('Yolculuğa çevir', 'Sohbet bağlantısı kuruluyor, lütfen birazdan tekrar deneyin.');
      return;
    }
    const socket = getOrCreateSocket();
    socket.emit('muhabbet_trip_convert_decline', {
      conversation_id: cid,
      request_id: requestId,
    });
    setTripConvertInModal(null);
  }, [cid, ensureMuhabbetSocketReady, tripConvertInModal]);

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
              {tripConvertEligible ? (
                <Text style={styles.peerMatchedPill}>
                  {ctx?.matched_via_leylek_key ? 'Leylek Anahtar eşleşti' : 'Eşleşme tamam'}
                </Text>
              ) : (
                <Text style={styles.peerPreviewPill}>Ön görüşme</Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>
        {tripConvertEligible && ctx?.matched_via_leylek_key ? (
          <View style={styles.matchStrip}>
            <View style={styles.matchBadge}>
              <Ionicons name="shield-checkmark" size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.matchBadgeTxt} numberOfLines={2}>
                Leylek Anahtar ile eşleşme tamamlandı
              </Text>
            </View>
          </View>
        ) : tripConvertEligible ? (
          <View style={styles.matchStrip}>
            <View style={styles.matchBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.matchBadgeTxt} numberOfLines={2}>
                Teklif eşleşmesi tamam — güzergâh ve ücreti sohbette netleştirin
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
              data={tripLockActive ? [] : rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={
                <View>
                  {tripConvertEligible ? (
                    <View style={styles.systemPermanentOk}>
                      <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                      <Text style={styles.systemPermanentOkTxt}>
                        {ctx?.matched_via_leylek_key
                          ? 'Leylek Anahtar ile eşleşme tamamlandı'
                          : 'Teklif eşleşmesi tamamlandı'}
                      </Text>
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
                    </View>
                  ) : null}
                  {tripLockActive ? (
                    <View style={styles.tripModeOnlyCard}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#2563EB" />
                      <Text style={styles.tripModeOnlyText}>
                        Ön görüşme mesajları gizlendi. Bu ekranda yalnızca eşleşme, yolculuğa çevirme ve canlı trip durumu gösterilir.
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
          {tripConvertEligible && (currentUserIsDriver || tripConvertState !== 'idle' || !!tripConvertInModal) ? (
            <View style={[styles.tripConvertSticky, tripConvertState === 'confirmed' && styles.tripConvertStickyConfirmed]}>
              {tripConvertState === 'confirmed' ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                  <Text style={styles.tripConvertConfirmedTxt}>Yolculuk başlatma isteği kabul edildi.</Text>
                </>
              ) : currentUserIsDriver ? (
                <>
                  <Pressable
                    onPress={sendTripConvertRequest}
                    disabled={tripConvertLoading || tripConvertState === 'pending'}
                    style={({ pressed }) => [
                      styles.convertPlanButton,
                      (pressed || tripConvertLoading || tripConvertState === 'pending') && { opacity: 0.86 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: tripConvertLoading || tripConvertState === 'pending' }}
                    accessibilityLabel="Eşleşmeyi yolculuğa çevir"
                  >
                    <Ionicons name="car-sport-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.convertPlanButtonTxt}>
                      {tripConvertLoading
                        ? 'İstek gönderiliyor...'
                        : tripConvertState === 'pending'
                          ? 'Yolcunun yanıtı bekleniyor'
                          : 'Eşleşmeyi yolculuğa çevir'}
                    </Text>
                  </Pressable>
                  <Text style={styles.convertPlanSub}>Teklif Sende içinde niyet alınır; normal ride ekranına geçilmez.</Text>
                </>
              ) : (
                <>
                  <View style={styles.tripConvertWaitingRow}>
                    <Ionicons name="time-outline" size={17} color="#64748B" />
                    <Text style={styles.tripConvertWaitingTxt}>Sürücünün yolculuk başlatmasını bekliyor</Text>
                  </View>
                  <Text style={styles.convertPlanSub}>Sürücü istek gönderdiğinde buradan kabul veya reddedebilirsiniz.</Text>
                </>
              )}
            </View>
          ) : null}
          {!tripLockActive ? (
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
                disabled={!draft.trim()}
                style={({ pressed }) => [
                  styles.sendBtnWrap,
                  !draft.trim() && { opacity: 0.4 },
                  pressed && draft.trim() && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                ]}
              >
                <LinearGradient
                  colors={SEND_BTN_GRAD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtnGrad}
                >
                  <Ionicons name="arrow-up" size={22} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
        <Modal
          visible={!!tripConvertInModal}
          transparent
          animationType="fade"
          onRequestClose={declineTripConvertFromModal}
        >
          <View style={styles.pairModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={declineTripConvertFromModal} />
            <View style={styles.pairModalCard}>
              <Text style={styles.pairModalTitle}>Yolculuğa çevirme isteği</Text>
              <Text style={styles.pairModalBody}>
                Sürücü yolculuğu başlatmak istiyor. Kabul ediyor musun?
              </Text>
              <Pressable
                onPress={acceptTripConvertFromModal}
                style={({ pressed }) => [styles.pairModalPri, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Evet"
              >
                <Text style={styles.pairModalPriTxt}>Evet</Text>
              </Pressable>
              <Pressable
                onPress={declineTripConvertFromModal}
                style={({ pressed }) => [styles.pairModalSec, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel="Hayır"
              >
                <Text style={styles.pairModalSecTxt}>Hayır</Text>
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
  tripModeOnlyCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.24)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tripModeOnlyText: { flex: 1, color: '#1D4ED8', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  secureStatusList: { marginTop: 12, gap: 7 },
  secureStatusItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secureStatusTxt: { color: '#14532D', fontSize: 12, fontWeight: '800', flex: 1 },
  tripConvertSticky: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(22,163,74,0.16)',
  },
  tripConvertStickyConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,252,231,0.95)',
  },
  tripConvertConfirmedTxt: { color: '#166534', fontSize: 13, fontWeight: '800', flex: 1 },
  tripConvertWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  tripConvertWaitingTxt: { color: '#475569', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  convertPlanButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#16A34A' },
  convertPlanButtonTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
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
