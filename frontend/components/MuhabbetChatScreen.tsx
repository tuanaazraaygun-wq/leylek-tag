/**
 * Muhabbet 1:1 sohbet — mesaj metni sunucuda saklanır (REST POST); Socket.IO isteğe bağlı realtime için.
 * Gönderim ana yolu: POST /muhabbet/conversations/{id}/messages (socket zorunlu değil).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  Easing,
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
import { Audio } from 'expo-av';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import type { Socket } from 'socket.io-client';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { handleUnauthorizedAndMaybeRedirect } from '../lib/muhabbetAuthRedirect';
import {
  getLastRegisteredSocketSid,
  getLastRegisteredSocketUserId,
  getOrCreateSocket,
} from '../contexts/SocketContext';
import { ensureSocketRegistered, notifyAuthTokenBecameAvailableForSocket } from '../lib/socketRegisterScheduler';
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
import MuhabbetTripCallScreen from './MuhabbetTripCallScreen';
import type {
  MuhabbetTripCallSocketPayload,
  MuhabbetTripSession,
  MuhabbetTripSessionSocketPayload,
} from '../lib/muhabbetTripTypes';
import { subscribeConversationUpdated, subscribeTripSessionUpdated } from '../lib/muhabbetRealtimeEvents';
import * as FileSystem from 'expo-file-system/legacy';
import { tapButtonHaptic } from '../utils/touchHaptics';

/** Socket sid + JWT kayıt kullanıcısı güncel mi (Muhabbet emit öncesi). */
function isMuhabbetSocketRegisteredForUser(socket: Socket, myUserLo: string): boolean {
  const lo = (myUserLo || '').trim().toLowerCase();
  if (!socket.connected || !lo) return false;
  const sid = socket.id;
  if (!sid || sid !== getLastRegisteredSocketSid()) return false;
  const ru = (getLastRegisteredSocketUserId() || '').trim().toLowerCase();
  return ru === lo;
}

function scheduleTripConvertPullRetries(pull: () => Promise<boolean>): void {
  setTimeout(() => {
    void pull();
  }, 1500);
  setTimeout(() => {
    void pull();
  }, 4000);
}

/** Yolcu modal accept sonrası GET ile doğrulama */
function scheduleTripConvertAcceptPullRetries(pull: () => Promise<unknown>): void {
  setTimeout(() => void pull(), 500);
  setTimeout(() => void pull(), 1500);
  setTimeout(() => void pull(), 4000);
}

const PRIMARY_GRAD = ['#1D4ED8', '#3B82F6', '#60A5FA'] as const;
/** Sürücü / yolcu balon — istenen gradientler */
const DRIVER_BUBBLE_GRAD = ['#2563EB', '#38BDF8'] as const;
const PAX_BUBBLE_GRAD = ['#EA580C', '#FBBF24'] as const;
const SEND_BTN_GRAD = ['#2563EB', '#38BDF8'] as const;
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#64748B';
const THEIRS_BUBBLE_BG = '#FFFFFF';
const THEIRS_BUBBLE_BORDER = 'rgba(15, 23, 42, 0.08)';

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

const MUHABBET_MAX_RECORD_MS = 30000;

const uploadAudio = async (
  apiBase: string,
  conversationId: string,
  localUri: string,
  durationMs: number,
  mimeType: string
): Promise<string> => {
  const base = apiBase.replace(/\/$/, '');
  const cid = String(conversationId || '').trim().toLowerCase();
  const token = (await getPersistedAccessToken())?.trim();
  if (!token) {
    throw new Error('Oturum gerekli');
  }
  const b64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const url = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/audio/upload`;
  console.log('[muhabbet_audio_upload_backend_start]', { cid: cid.slice(0, 13), durationMs, mimeType });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64: b64,
      mime_type: mimeType,
      duration_ms: durationMs,
    }),
  });
  if (handleUnauthorizedAndMaybeRedirect(res)) {
    throw new Error('Oturum süresi doldu');
  }
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    audio_storage_path?: string;
    detail?: unknown;
  };
  if (!res.ok || !data.success || !data.audio_storage_path) {
    const d = data.detail;
    const detail =
      typeof d === 'string'
        ? d
        : d && typeof d === 'object' && d !== null && 'message' in d
          ? String((d as { message?: unknown }).message)
          : res.statusText;
    throw new Error(detail || 'Ses dosyası yüklenemedi');
  }
  return String(data.audio_storage_path);
};

function formatDurationClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export type ChatMessageRow = {
  id: string;
  body?: string | null;
  sender_user_id?: string | null;
  created_at?: string | null;
  /** Giden mesaj: gönderim / okundu bilgisi */
  out_status?: OutMessageStatus;
  /** Cihazda saklanan rol (socket anında ctx’den yazılır) */
  sender_role?: string | null;
  message_type?: 'text' | 'audio';
  /** Kalıcı Storage nesne yolu (bucket içi); oynatma için sunucunun döndürdüğü audio_url (signed) kullanılır */
  audio_storage_path?: string | null;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
  audio_mime_type?: string | null;
  /** Sunucu URL gelene kadar yerel yükleme */
  audio_upload_pending?: boolean;
};

/** GET /muhabbet/conversations/:id/messages context.trip_convert_request */
export type TripConvertRequestContext = {
  id: string;
  status: string;
  requester_user_id: string;
  target_user_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  session_id?: string | null;
  trip_id?: string | null;
  is_requester: boolean;
  is_target: boolean;
  pending: boolean;
  accepted: boolean;
  declined: boolean;
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
  trip_convert_request?: TripConvertRequestContext | null;
  /** Sunucu geçmiş mesaj tutmaz */
  ephemeral_chat?: boolean;
};

type PullMessagesFromApiResult = { ok: boolean; context: ChatContext | null };

type ChatSystemCard = {
  id: string;
  tone: 'blue' | 'green' | 'orange';
  text: string;
};

type PendingMuhabbetAction =
  | {
      kind: 'send_message';
      messageId: string;
      body: string;
      retryCount: number;
      audio?:
        | { audio_storage_path: string; audio_duration_ms: number; audio_mime_type: string }
        | { audio_url: string; audio_duration_ms: number; audio_mime_type: string };
    }
  | { kind: 'trip_convert_request'; retryCount: number }
  | { kind: 'trip_convert_accept'; requestId: string; retryCount: number }
  | { kind: 'trip_convert_decline'; requestId: string; retryCount: number };

function formatTripConvertRestDetail(detail: unknown, statusFallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
    const o = detail as Record<string, unknown>;
    const msg = o.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    const c = o.code;
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg?: string }).msg) : String(x)))
      .join(' ');
  }
  return statusFallback;
}

function normalizeMuhabbetSessionId(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function isMuhabbetTripRestOk(rest: { ok: boolean; json: Record<string, unknown> }): boolean {
  return rest.ok && rest.json.success === true;
}

function muhabbetTripRestDetail(detail: unknown, fallback: string): string {
  if (detail === null || detail === undefined) return fallback;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
    const o = detail as Record<string, unknown>;
    const msg = o.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    const code = o.code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object' && 'msg' in first && typeof (first as { msg?: string }).msg === 'string') {
      return String((first as { msg: string }).msg).trim();
    }
  }
  return fallback;
}

type ChatTripCallState = 'idle' | 'incoming' | 'outgoing' | 'active';

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

function chatRowsFingerprint(items: ChatMessageRow[]): string {
  return items
    .map((m) =>
      [
        rowIdLo(m),
        String(m.body ?? ''),
        String(m.created_at ?? ''),
        String(m.sender_user_id ?? ''),
        String(m.out_status ?? ''),
        String(m.sender_role ?? ''),
        String(m.message_type ?? ''),
        String(m.audio_url ?? ''),
        String(m.audio_storage_path ?? ''),
        String(m.audio_duration_ms ?? ''),
        String(m.audio_upload_pending ?? ''),
      ].join('\u0002')
    )
    .join('\u0003');
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
        message_type: p.message_type ?? r.message_type,
        audio_storage_path: p.audio_storage_path ?? r.audio_storage_path,
        audio_url: p.audio_url ?? r.audio_url,
        audio_duration_ms: p.audio_duration_ms ?? r.audio_duration_ms,
        audio_mime_type: p.audio_mime_type ?? r.audio_mime_type,
        audio_upload_pending: p.audio_upload_pending ?? r.audio_upload_pending,
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
  const wrap = { alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 14 };
  if (status === 'sending') {
    return (
      <View style={wrap}>
        <Ionicons name="time-outline" size={13} color="#94A3B8" />
      </View>
    );
  }
  if (status === 'failed') {
    return (
      <View style={wrap}>
        <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
      </View>
    );
  }
  if (status === 'sent') {
    return (
      <View style={wrap}>
        <Ionicons name="checkmark" size={14} color="#94A3B8" />
      </View>
    );
  }
  if (status === 'delivered') {
    return (
      <View style={wrap}>
        <Ionicons name="checkmark-done-outline" size={14} color="#64748B" />
      </View>
    );
  }
  if (status === 'seen') {
    return (
      <View style={wrap}>
        <Ionicons name="checkmark-done" size={14} color="#2563EB" />
      </View>
    );
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
  const socketMsgPullDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [draft, setDraft] = useState('');
  const [tripConvertInModal, setTripConvertInModal] = useState<{ rid: string } | null>(null);
  const [tripConvertLoading, setTripConvertLoading] = useState(false);
  const [tripConvertModalBusy, setTripConvertModalBusy] = useState(false);
  const [tripConvertState, setTripConvertState] = useState<'idle' | 'pending' | 'confirmed'>('idle');
  /** REST reconcile ile bekleniyor; kullanıcıyı bilgilendir, kilidi zorlamaz */
  const [tripConvertStaleHint, setTripConvertStaleHint] = useState(false);
  const [, setTripLockReason] = useState<string | null>(null);
  const tripConvertStateRef = useRef<'idle' | 'pending' | 'confirmed'>('idle');
  const optimisticTripConvertRef = useRef(false);
  const syncTripFromCtxRef = useRef<(nextCtx: ChatContext | null, myLo: string) => void>(() => {});
  const pendingEnteredTripConvertRef = useRef<number | null>(null);
  const tripSessionNavRef = useRef<string | null>(null);
  /** Üst bilgi şeridi: küçük kartlar, kapatılabilir / dönüşümlü */
  const [infoStripDismissed, setInfoStripDismissed] = useState(false);
  const [infoRotateIx, setInfoRotateIx] = useState(0);
  const [systemCards, setSystemCards] = useState<ChatSystemCard[]>([]);
  const infoFade = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<ChatMessageRow>>(null);
  const scrollEndThrottleRef = useRef(0);
  const scrollToEndThrottled = useCallback((animated = false) => {
    const now = Date.now();
    if (now - scrollEndThrottleRef.current < 320) return;
    scrollEndThrottleRef.current = now;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);
  const ctxRef = useRef<ChatContext | null>(null);
  /** Sohbet odası (joined_muhabbet) — mesaj almak için gerekli */
  const [roomJoined, setRoomJoined] = useState(false);
  const roomJoinedRef = useRef(false);
  /** Ekran mount / unmount: açıkken message_seen gönder */
  const chatSessionActiveRef = useRef(true);
  const pendingActionRef = useRef<PendingMuhabbetAction | null>(null);
  const tripConvertRequestInFlightRef = useRef(false);
  /** GET ctx trip_convert_request imzası — gereksiz modal/state yenidenlemesini keser */
  const lastTripConvertCtxSigRef = useRef<string | null>(null);
  const tripConvertModalActionBusyRef = useRef(false);

  const tripConvertModalBackdropOpacity = useRef(new Animated.Value(0)).current;
  const tripConvertModalCardTranslateY = useRef(new Animated.Value(36)).current;
  const tripConvertModalCardScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!tripConvertInModal) return;
    tripConvertModalBackdropOpacity.setValue(0);
    tripConvertModalCardTranslateY.setValue(36);
    tripConvertModalCardScale.setValue(0.96);
    const entrance = Animated.parallel([
      Animated.timing(tripConvertModalBackdropOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tripConvertModalCardTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tripConvertModalCardScale, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [tripConvertInModal]);

  useEffect(() => {
    ensureSocketRegistered('muhabbet_chat_screen_mount');
  }, [cid]);

  const [linkedTripSession, setLinkedTripSession] = useState<MuhabbetTripSession | null>(null);
  const [chatCallState, setChatCallState] = useState<ChatTripCallState>('idle');
  const [chatCallPayload, setChatCallPayload] = useState<MuhabbetTripCallSocketPayload | null>(null);
  const chatCallStateRef = useRef<ChatTripCallState>('idle');
  const chatCallPayloadRef = useRef<MuhabbetTripCallSocketPayload | null>(null);
  const chatCallStartInFlightRef = useRef(false);
  const latestChatCallActionIdRef = useRef<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef<number>(0);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const audioPlaybackRef = useRef<{ sound: Audio.Sound | null; id: string | null }>({
    sound: null,
    id: null,
  });
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  /** iOS KeyboardAvoidingView: üst bar (~52) + peer kart (~76) + opsiyonel eşleşme şeridi */
  const tripConvertEligibleForKeyboard = !!(ctx?.trip_convert_eligible ?? ctx?.matched_via_leylek_key);
  const keyboardVerticalOffset =
    Platform.OS === 'ios' ? insets.top + 52 + 76 + (tripConvertEligibleForKeyboard ? 48 : 0) : 0;
  const pushSystemCard = useCallback((tone: ChatSystemCard['tone'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSystemCards((prev) => [...prev, { id, tone, text }].slice(-8));
  }, []);

  const sendMessageViaRest = useCallback(
    async (
      messageId: string,
      body: string,
      audio?:
        | { audio_storage_path: string; audio_duration_ms: number; audio_mime_type: string }
        | { audio_url: string; audio_duration_ms: number; audio_mime_type: string }
        | null
    ): Promise<boolean> => {
      const mid = normalizeMuhabbetMessageId(messageId);
      const text = String(body ?? '');
      if (!cid || !mid) return false;
      if (!audio && !text.trim()) return false;
      try {
        const token = (await getPersistedAccessToken())?.trim();
        if (!token) {
          setRows((prev) => markMessageFailedById(prev, mid));
          return false;
        }
        const payload: Record<string, unknown> = { message_id: mid };
        if (audio) {
          payload.message_type = 'audio';
          if ('audio_storage_path' in audio && audio.audio_storage_path) {
            payload.audio_storage_path = audio.audio_storage_path;
          } else if ('audio_url' in audio && audio.audio_url) {
            payload.audio_url = audio.audio_url;
          }
          payload.audio_duration_ms = audio.audio_duration_ms;
          payload.audio_mime_type = audio.audio_mime_type;
          payload.body = text.trim();
        } else {
          payload.body = text.trim();
        }
        const res = await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (handleUnauthorizedAndMaybeRedirect(res)) {
          setRows((prev) => markMessageFailedById(prev, mid));
          return false;
        }
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          message?: {
            id?: string;
            body?: string;
            sender_user_id?: string;
            created_at?: string;
            message_type?: string;
            audio_storage_path?: string | null;
            audio_url?: string | null;
            audio_duration_ms?: number | null;
            audio_mime_type?: string | null;
          };
          detail?: unknown;
        };
        if (!res.ok || !data.success) {
          if (audio) {
            console.log('[muhabbet_audio_send_error]', { http: res.status, detail: data.detail });
          }
          setRows((prev) => markMessageFailedById(prev, mid));
          return false;
        }
        const serverMessage = data.message || {};
        const serverId = normalizeMuhabbetMessageId(serverMessage.id || mid) || mid;
        const srvMt = String(serverMessage.message_type || (audio ? 'audio' : 'text')).toLowerCase();
        const message_type: 'text' | 'audio' | undefined =
          srvMt === 'audio' ? 'audio' : srvMt === 'text' ? 'text' : audio ? 'audio' : 'text';
        if (pendingActionRef.current?.kind === 'send_message' && pendingActionRef.current.messageId === mid) {
          pendingActionRef.current = null;
        }
        setRows((prev) =>
          prev.map((m) =>
            rowIdLo(m) === mid
              ? {
                  ...m,
                  id: serverId,
                  body:
                    serverMessage.body != null && String(serverMessage.body).trim() !== ''
                      ? String(serverMessage.body)
                      : String(m.body ?? '').trim() !== ''
                        ? String(m.body)
                        : String(serverMessage.body ?? ''),
                  sender_user_id:
                    serverMessage.sender_user_id != null
                      ? String(serverMessage.sender_user_id).trim().toLowerCase()
                      : m.sender_user_id,
                  created_at: coerceMessageCreatedAt(serverMessage.created_at || m.created_at),
                  out_status: 'sent' as const,
                  message_type,
                  audio_storage_path:
                    message_type === 'audio'
                      ? serverMessage.audio_storage_path != null && String(serverMessage.audio_storage_path).trim() !== ''
                        ? String(serverMessage.audio_storage_path)
                        : m.audio_storage_path
                      : undefined,
                  audio_url:
                    message_type === 'audio'
                      ? serverMessage.audio_url != null
                        ? String(serverMessage.audio_url)
                        : m.audio_url
                      : undefined,
                  audio_duration_ms:
                    message_type === 'audio'
                      ? serverMessage.audio_duration_ms != null
                        ? Number(serverMessage.audio_duration_ms)
                        : m.audio_duration_ms
                      : undefined,
                  audio_mime_type:
                    message_type === 'audio'
                      ? serverMessage.audio_mime_type != null
                        ? String(serverMessage.audio_mime_type)
                        : m.audio_mime_type
                      : undefined,
                  audio_upload_pending: false,
                }
              : m
          )
        );
        const emitPreview =
          message_type === 'audio'
            ? text.trim() || 'Sesli mesaj'
            : text.trim();
        DeviceEventEmitter.emit(MUHABBET_NEW_LOCAL_MESSAGE, {
          type: 'muhabbet_message',
          conversation_id: cid,
          text: emitPreview,
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

  const stopPlaybackIfAny = useCallback(async () => {
    try {
      if (audioPlaybackRef.current.sound) {
        await audioPlaybackRef.current.sound.stopAsync();
        await audioPlaybackRef.current.sound.unloadAsync();
      }
    } catch {
      /* noop */
    }
    audioPlaybackRef.current = { sound: null, id: null };
    setPlayingAudioId(null);
  }, []);

  const togglePlayAudioForRow = useCallback(
    async (item: ChatMessageRow) => {
      const url = item.audio_url ? String(item.audio_url).trim() : '';
      if (!url) return;
      if (playingAudioId === item.id && audioPlaybackRef.current.sound) {
        await stopPlaybackIfAny();
        return;
      }
      await stopPlaybackIfAny();
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync({ uri: url });
        audioPlaybackRef.current = { sound, id: item.id };
        setPlayingAudioId(item.id);
        sound.setOnPlaybackStatusUpdate((st) => {
          if (st.isLoaded && 'didJustFinish' in st && st.didJustFinish) {
            void sound.unloadAsync().catch(() => {});
            if (audioPlaybackRef.current.id === item.id) {
              audioPlaybackRef.current = { sound: null, id: null };
              setPlayingAudioId(null);
            }
          }
        });
        await sound.playAsync();
      } catch {
        Alert.alert('Ses', 'Ses çalınamadı.');
      }
    },
    [playingAudioId, stopPlaybackIfAny]
  );

  const cancelRecording = useCallback(async () => {
    console.log('[muhabbet_audio_record_stop]', { cancelled: true });
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    try {
      await recordingRef.current?.stopAndUnloadAsync();
    } catch {
      /* noop */
    }
    recordingRef.current = null;
    setRecordingActive(false);
    setRecordingElapsedMs(0);
  }, []);

  const finalizeRecordingAndSend = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || !cid) return;
    recordingRef.current = null;
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    let localUri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      localUri = rec.getURI() ?? null;
    } catch {
      localUri = null;
    }
    setRecordingActive(false);
    const elapsedRaw = Date.now() - recordStartedAtRef.current;
    const durMs = Math.min(MUHABBET_MAX_RECORD_MS, Math.max(300, elapsedRaw));
    setRecordingElapsedMs(0);
    console.log('[muhabbet_audio_record_stop]', { ms: durMs });
    if (!localUri) {
      Alert.alert('Sesli mesaj', 'Kayıt alınamadı.');
      return;
    }
    const myLo = (myIdRef.current || myId || '').trim().toLowerCase();
    if (!myLo) {
      Alert.alert('Sohbet', 'Kullanıcı bilgisi yüklenemedi.');
      return;
    }
    const messageId = normalizeMuhabbetMessageId(newClientMessageUuid());
    const roleMine = (ctxRef.current?.my_role || '').trim().toLowerCase();
    const createdIso = coerceMessageCreatedAt(undefined);
    const mime =
      Platform.OS === 'ios'
        ? 'audio/m4a'
        : localUri.toLowerCase().endsWith('.m4a')
          ? 'audio/m4a'
          : 'audio/mp4';

    setRows((p) =>
      sortRowsByCreatedAtAsc([
        ...p,
        {
          id: messageId,
          body: '',
          sender_user_id: myLo,
          created_at: createdIso,
          out_status: 'sending',
          sender_role: roleMine || null,
          message_type: 'audio',
          audio_duration_ms: durMs,
          audio_mime_type: mime,
          audio_upload_pending: true,
        },
      ])
    );
    scrollToEndThrottled(true);

    let uploadedPath: string;

    try {
      uploadedPath = await uploadAudio(base, cid, localUri, durMs, mime);
    } catch (e: unknown) {
      const detail =
        e !== null &&
        typeof e === 'object' &&
        'message' in e &&
        typeof (e as { message?: unknown }).message === 'string'
          ? String((e as { message: string }).message)
          : e instanceof Error
            ? e.message
            : String(e);
      console.warn('[muhabbet_audio_upload_error]', e);
      setRows((prev) => markMessageFailedById(prev, messageId));
      Alert.alert('Depolama', `Ses dosyası yüklenemedi.\n\n${detail}`);
      return;
    }

    setRows((prev) =>
      prev.map((m) =>
        rowIdLo(m) === messageId
          ? { ...m, audio_storage_path: uploadedPath, audio_upload_pending: true }
          : m
      )
    );

    pendingActionRef.current = {
      kind: 'send_message',
      messageId,
      body: '',
      retryCount: 0,
      audio: {
        audio_storage_path: uploadedPath,
        audio_duration_ms: durMs,
        audio_mime_type: mime,
      },
    };

    const ok = await sendMessageViaRest(messageId, '', {
      audio_storage_path: uploadedPath,
      audio_duration_ms: durMs,
      audio_mime_type: mime,
    });
    if (!ok) {
      console.log('[muhabbet_audio_send_error]', { rest: false });
      pendingActionRef.current = null;
      Alert.alert('Sesli mesaj', 'Sesli mesaj gönderilemedi.');
      return;
    }
    console.log('[muhabbet_audio_send_done]', { messageId });
    pendingActionRef.current = null;
    try {
      const sock = getOrCreateSocket();
      if (sock.connected) {
        sock.emit('muhabbet_send', {
          conversation_id: cid,
          message_type: 'audio',
          text: '',
          body: '',
          audio_storage_path: uploadedPath,
          audio_duration_ms: durMs,
          audio_mime_type: mime,
          message_id: messageId,
        });
      }
    } catch {
      /* noop */
    }
    scrollToEndThrottled(true);
  }, [base, cid, myId, scrollToEndThrottled, sendMessageViaRest]);

  const startRecording = useCallback(async () => {
    if (!cid || recordingActive) return;
    console.log('[muhabbet_audio_record_start]');
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Mikrofon', 'Sesli mesaj için mikrofon izni gerekli.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      recordStartedAtRef.current = Date.now();
      setRecordingActive(true);
      setRecordingElapsedMs(0);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        const e = Date.now() - recordStartedAtRef.current;
        const capped = Math.min(e, MUHABBET_MAX_RECORD_MS);
        setRecordingElapsedMs(capped);
        if (e >= MUHABBET_MAX_RECORD_MS) {
          if (recordIntervalRef.current) {
            clearInterval(recordIntervalRef.current);
            recordIntervalRef.current = null;
          }
          void finalizeRecordingAndSend();
        }
      }, 200);
    } catch {
      Alert.alert('Sesli mesaj', 'Kayıt başlatılamadı.');
    }
  }, [cid, recordingActive, finalizeRecordingAndSend]);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      void recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      void audioPlaybackRef.current.sound?.unloadAsync().catch(() => {});
    };
  }, []);

  /** GET mesajlar + yerel birleştirme (periyodik çekim ve ilk yükleme sonrası sync). */
  const pullMessagesFromApi = useCallback(async (): Promise<PullMessagesFromApiResult> => {
    if (!cid) return { ok: false, context: null };
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        setCtx(null);
        return { ok: false, context: null };
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
        return { ok: false, context: null };
      }
      const d = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        context?: ChatContext;
        messages?: {
          id?: string;
          body?: string;
          sender_user_id?: string;
          created_at?: string;
          message_type?: string;
          audio_storage_path?: string | null;
          audio_url?: string | null;
          audio_duration_ms?: number | null;
          audio_mime_type?: string | null;
        }[];
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
            message_type: m.message_type,
            audio_storage_path: m.audio_storage_path ?? undefined,
            audio_url: m.audio_url ?? undefined,
            audio_duration_ms: m.audio_duration_ms ?? undefined,
            audio_mime_type: m.audio_mime_type ?? undefined,
          }))
        );
        const nextFp = chatRowsFingerprint(displayRows);
        const prevFp = chatRowsFingerprint(rowsRef.current);
        if (nextFp !== prevFp) {
          setRows(displayRows);
        }
        const nextCtx = d.context || null;
        setCtx(nextCtx);
        syncTripFromCtxRef.current(nextCtx, myLo);
        return { ok: true, context: nextCtx };
      }
      setCtx(null);
      return { ok: false, context: null };
    } catch {
      setCtx(null);
      return { ok: false, context: null };
    }
  }, [base, cid]);

  const navigateToLeylekTripSession = useCallback(
    async (payload?: MuhabbetTripSessionSocketPayload | null) => {
      const sessionId = String(payload?.session_id || payload?.sessionId || payload?.session?.id || '')
        .trim()
        .toLowerCase();
      if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
        Alert.alert(
          'Yolculuk',
          'Yolculuk oturumu hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin.'
        );
        return;
      }
      const token = (await getPersistedAccessToken())?.trim();
      if (token) {
        try {
          const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(sessionId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const body = (await res.json().catch(() => ({}))) as {
            success?: boolean;
            session?: { status?: string };
          };
          const st = String(body.session?.status || '').trim().toLowerCase();
          if (body.success && st && ['expired', 'cancelled', 'finished'].includes(st)) {
            Alert.alert(
              'Yolculuk',
              st === 'finished'
                ? 'Bu yolculuk tamamlanmış.'
                : st === 'cancelled'
                  ? 'Bu yolculuk iptal edilmiş.'
                  : 'Bu yolculuk süresi dolmuş.'
            );
            return;
          }
        } catch {
          /* ağ hatası — yine de rotaya git */
        }
      }
      if (tripSessionNavRef.current === sessionId) return;
      setTripLockReason('route /leylek-trip/[sessionId] is about to open');
      tripSessionNavRef.current = sessionId;
      router.push(`/leylek-trip/${encodeURIComponent(sessionId)}` as Href);
    },
    [base, router]
  );

  const refreshLinkedTripSession = useCallback(async () => {
    const eligible = !!(
      ctxRef.current?.trip_convert_eligible ?? ctxRef.current?.matched_via_leylek_key
    );
    if (!eligible || !cid) {
      setLinkedTripSession(null);
      return;
    }
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return;
    const cidLo = cid.trim().toLowerCase();

    const tcr = ctxRef.current?.trip_convert_request;
    const sidFromConvert =
      tcr?.accepted && tcr?.session_id ? normalizeMuhabbetSessionId(tcr.session_id) : '';

    const fetchSessionById = async (sid: string): Promise<MuhabbetTripSession | null> => {
      if (!sid) return null;
      try {
        const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          session?: MuhabbetTripSession;
        };
        if (!res.ok || !j.success || !j.session) return null;
        const conv = String(j.session.conversation_id || '').trim().toLowerCase();
        if (conv && conv !== cidLo) return null;
        return j.session;
      } catch {
        return null;
      }
    };

    if (sidFromConvert) {
      const s = await fetchSessionById(sidFromConvert);
      if (s) {
        setLinkedTripSession(s);
        return;
      }
    }

    try {
      const res = await fetch(`${base}/muhabbet/trip-sessions/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        session?: MuhabbetTripSession | null;
      };
      if (!res.ok || !j.success || !j.session) {
        setLinkedTripSession(null);
        return;
      }
      const conv = String(j.session.conversation_id || '').trim().toLowerCase();
      if (conv && conv === cidLo) {
        setLinkedTripSession(j.session);
        return;
      }
    } catch {
      /* noop */
    }
    setLinkedTripSession(null);
  }, [base, cid]);

  useEffect(() => {
    chatCallStateRef.current = chatCallState;
  }, [chatCallState]);
  useEffect(() => {
    chatCallPayloadRef.current = chatCallPayload;
  }, [chatCallPayload]);

  useEffect(() => {
    void refreshLinkedTripSession();
  }, [ctx, refreshLinkedTripSession]);

  useEffect(() => {
    const unsub = subscribeTripSessionUpdated(() => {
      const eligible = !!(
        ctxRef.current?.trip_convert_eligible ?? ctxRef.current?.matched_via_leylek_key
      );
      if (!eligible) return;
      void refreshLinkedTripSession();
    });
    return unsub;
  }, [refreshLinkedTripSession]);

  const retryPendingActionAfterNotRegistered = useCallback(async () => {
    const pending = pendingActionRef.current;
    if (!pending) return false;
    if (pending.retryCount >= 1) return false;
    if (pending.kind === 'send_message') {
      pendingActionRef.current = { ...pending, retryCount: pending.retryCount + 1 } as PendingMuhabbetAction;
      await sendMessageViaRest(pending.messageId, pending.body, pending.audio ?? null);
      return true;
    }
    if (
      pending.kind !== 'trip_convert_request' &&
      pending.kind !== 'trip_convert_accept' &&
      pending.kind !== 'trip_convert_decline'
    ) {
      return false;
    }

    pendingActionRef.current = { ...pending, retryCount: pending.retryCount + 1 } as PendingMuhabbetAction;
    const token = (await getPersistedAccessToken())?.trim();
    if (!token || !cid) {
      pendingActionRef.current = null;
      optimisticTripConvertRef.current = false;
      setTripConvertLoading(false);
      Alert.alert('Yolculuğa çevir', 'Oturum bulunamadı.');
      await pullMessagesFromApi();
      return true;
    }

    let url: string;
    let fetchBody: string | undefined;
    if (pending.kind === 'trip_convert_request') {
      url = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/trip-convert/request`;
    } else if (pending.kind === 'trip_convert_accept') {
      url = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/trip-convert/accept`;
      fetchBody = JSON.stringify({ request_id: pending.requestId });
    } else {
      url = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/trip-convert/decline`;
      fetchBody = JSON.stringify({ request_id: pending.requestId });
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(fetchBody ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(fetchBody ? { body: fetchBody } : {}),
      });
      const restBody = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        session?: { id?: string; session_id?: string };
        detail?: unknown;
      };
      const ok = res.ok && restBody.success === true;
      if (ok) {
        pendingActionRef.current = null;
        await pullMessagesFromApi();
        if (pending.kind === 'trip_convert_accept') {
          const sid = String(restBody.session?.id || restBody.session?.session_id || '')
            .trim()
            .toLowerCase();
          if (sid && sid !== 'undefined' && sid !== 'null') {
            navigateToLeylekTripSession({ session_id: sid });
          }
          scheduleTripConvertAcceptPullRetries(() => pullMessagesFromApi());
        } else if (pending.kind === 'trip_convert_decline') {
          scheduleTripConvertPullRetries(pullMessagesFromApi);
        } else {
          scheduleTripConvertPullRetries(pullMessagesFromApi);
        }
        return true;
      }

      const msg = formatTripConvertRestDetail(restBody.detail, `İşlem başarısız (${res.status})`);
      Alert.alert('Yolculuğa çevir', msg || 'İşlem başarısız.');
      pendingActionRef.current = null;
      optimisticTripConvertRef.current = false;
      setTripConvertLoading(false);
      await pullMessagesFromApi();
      return true;
    } catch {
      Alert.alert('Yolculuğa çevir', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      pendingActionRef.current = null;
      optimisticTripConvertRef.current = false;
      setTripConvertLoading(false);
      await pullMessagesFromApi();
      return true;
    }
  }, [base, cid, navigateToLeylekTripSession, pullMessagesFromApi, sendMessageViaRest]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  useEffect(() => {
    tripConvertStateRef.current = tripConvertState;
  }, [tripConvertState]);

  syncTripFromCtxRef.current = (nextCtx, myLo) => {
    const lo = (myLo || '').trim().toLowerCase();
    const raw = nextCtx?.trip_convert_request;
    if (!lo) return;

    if (!raw || typeof raw !== 'object') {
      lastTripConvertCtxSigRef.current = null;
      setTripConvertStaleHint(false);
      setTripConvertLoading(false);
      setTripConvertInModal(null);
      if (!optimisticTripConvertRef.current) {
        setTripConvertState('idle');
        setTripLockReason((r) => (r && String(r).startsWith('muhabbet_trip_convert') ? null : r));
      }
      return;
    }

    const tcr = raw as TripConvertRequestContext;
    const ridLo = String(tcr.id || '').trim().toLowerCase();
    const stLo = String(tcr.status || '').trim().toLowerCase();
    const sig = `${ridLo}|${stLo}|${tcr.pending}|${tcr.accepted}|${tcr.declined}|${tcr.is_requester}|${tcr.is_target}`;
    if (lastTripConvertCtxSigRef.current === sig && !optimisticTripConvertRef.current) {
      return;
    }
    lastTripConvertCtxSigRef.current = sig;

    optimisticTripConvertRef.current = false;

    if (tcr.pending) {
      setTripConvertStaleHint(false);
      if (tcr.is_requester) {
        setTripConvertState('pending');
        setTripConvertLoading(false);
        setTripConvertInModal(null);
        setTripLockReason('muhabbet_trip_convert_request_sent');
      } else if (tcr.is_target) {
        const rid = ridLo;
        if (rid && !tripConvertModalActionBusyRef.current) {
          setTripConvertInModal((prev) => (prev?.rid === rid ? prev : { rid }));
        }
        setTripConvertLoading(false);
      }
      return;
    }

    setTripConvertStaleHint(false);

    if (tcr.accepted) {
      setTripConvertState('confirmed');
      setTripConvertInModal(null);
      setTripConvertLoading(false);
      setTripLockReason('muhabbet_trip_convert_confirmed');
      const sid = String(tcr.session_id || tcr.trip_id || '')
        .trim()
        .toLowerCase();
      if (sid && sid !== 'undefined' && sid !== 'null') {
        navigateToLeylekTripSession({ session_id: sid });
      }
      return;
    }

    if (tcr.declined) {
      setTripConvertState('idle');
      setTripConvertInModal(null);
      setTripConvertLoading(false);
      setTripLockReason((r) => (r && String(r).startsWith('muhabbet_trip_convert') ? null : r));
      return;
    }

    setTripConvertState('idle');
    setTripConvertInModal(null);
    setTripConvertLoading(false);
    setTripLockReason((r) => (r && String(r).startsWith('muhabbet_trip_convert') ? null : r));
  };

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
          message_type: m.message_type,
          audio_storage_path: m.audio_storage_path ?? undefined,
          audio_url: m.audio_url ?? undefined,
          audio_duration_ms: m.audio_duration_ms ?? undefined,
          audio_mime_type: m.audio_mime_type ?? undefined,
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
    if (!cid) return;
    const cidLo = cid.trim().toLowerCase();
    const unsub = subscribeConversationUpdated((p) => {
      const conv = (p.conversation_id || '').trim().toLowerCase();
      if (conv && conv === cidLo) void pullMessagesFromApi();
    });
    return unsub;
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

  /** Trip convert: bekleyen sürücü — REST ile reconcile (socket kaçırılsa bile). */
  useEffect(() => {
    if (tripConvertState !== 'pending') {
      pendingEnteredTripConvertRef.current = null;
      setTripConvertStaleHint(false);
      return;
    }
    if (pendingEnteredTripConvertRef.current == null) {
      pendingEnteredTripConvertRef.current = Date.now();
    }
    const t5 = setTimeout(() => {
      void pullMessagesFromApi();
    }, 5000);
    const t10 = setTimeout(() => {
      void pullMessagesFromApi();
      if (
        pendingEnteredTripConvertRef.current != null &&
        Date.now() - pendingEnteredTripConvertRef.current >= 10000 &&
        tripConvertStateRef.current === 'pending'
      ) {
        setTripConvertStaleHint(true);
      }
    }, 10500);
    return () => {
      clearTimeout(t5);
      clearTimeout(t10);
    };
  }, [tripConvertState, pullMessagesFromApi]);

  useEffect(() => {
    if (!cid || bootstrapPhase !== 'ready') return;
    DeviceEventEmitter.emit(MUHABBET_CONVERSATION_READ, { conversation_id: cid });
    void (async () => {
      try {
        const token = (await getPersistedAccessToken())?.trim();
        if (!token) return;
        await fetch(`${base}/muhabbet/conversations/${encodeURIComponent(cid)}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* noop */
      }
    })();
  }, [cid, bootstrapPhase, base]);

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
      let myJoinLo = (myIdRef.current || '').trim().toLowerCase();
      if (!myJoinLo) {
        try {
          const rawJoin = await getPersistedUserRaw();
          if (rawJoin) {
            const uj = JSON.parse(rawJoin) as { id?: string };
            if (uj?.id) myJoinLo = String(uj.id).trim().toLowerCase();
          }
        } catch {
          /* noop */
        }
      }
      if (!myJoinLo) {
        console.warn('[chat] missing user id — join atlanıyor');
        return;
      }
      if (!isMuhabbetSocketRegisteredForUser(socket, myJoinLo)) {
        notifyAuthTokenBecameAvailableForSocket();
        let regOk = await waitForNextRegisterSuccess(socket, 15000);
        if (cancelled) return;
        if (!regOk && !isMuhabbetSocketRegisteredForUser(socket, myJoinLo)) {
          notifyAuthTokenBecameAvailableForSocket();
          regOk = await waitForNextRegisterSuccess(socket, 12000);
        }
        if (cancelled) return;
        if (!regOk && !isMuhabbetSocketRegisteredForUser(socket, myJoinLo)) {
          console.warn('[chat] register ack timeout — join atlanıyor; tekrar denenecek');
          return;
        }
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

    const scheduleBackgroundPullFromSocket = () => {
      if (socketMsgPullDebounceRef.current) clearTimeout(socketMsgPullDebounceRef.current);
      socketMsgPullDebounceRef.current = setTimeout(() => {
        socketMsgPullDebounceRef.current = null;
        console.log('[leylek_fast_path]', JSON.stringify({ chat: 'message_socket_pull_reconcile' }));
        void pullMessagesFromApi();
      }, 120);
    };

    const onMsg = (msg: {
      conversation_id?: string;
      message_id?: string;
      text?: string;
      sender_id?: string;
      created_at?: string;
      message_type?: string;
      audio_url?: string | null;
      audio_duration_ms?: number | null;
      audio_mime_type?: string | null;
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
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      const isMine = Boolean(myLo && senderLo === myLo);
      const text = msg?.text != null ? String(msg.text) : '';
      const mtRaw = String(msg?.message_type ?? '').trim().toLowerCase();
      const isAudio = mtRaw === 'audio';
      const audioUrlIncoming =
        isAudio && msg?.audio_url != null ? String(msg.audio_url).trim() : undefined;
      const audioDurIncoming =
        isAudio && msg?.audio_duration_ms != null ? Number(msg.audio_duration_ms) : undefined;
      const audioMimeIncoming =
        isAudio && msg?.audio_mime_type != null ? String(msg.audio_mime_type).trim().toLowerCase() : undefined;
      const created = coerceMessageCreatedAt(msg?.created_at);
      const myR = (ctxRef.current?.my_role || '').trim().toLowerCase();
      const oR = (ctxRef.current?.other_role || '').trim().toLowerCase();
      const roleFor = (isMine ? myR : oR) || null;

      console.log('[leylek_ui_instant]', JSON.stringify({ chat: 'message_socket_append', id }));
      setRows((prev) => {
        const ix = prev.findIndex((m) => rowIdLo(m) === id);
        if (ix >= 0) {
          const cur = prev[ix];
          const mergedBody =
            text.trim() !== '' ? text : String(cur.body ?? '').trim() !== '' ? String(cur.body) : text;
          const next = [...prev];
          next[ix] = {
            ...cur,
            body: mergedBody,
            sender_user_id: senderLo || cur.sender_user_id,
            created_at: created,
            sender_role: roleFor ?? cur.sender_role ?? undefined,
            message_type: isAudio ? 'audio' : mtRaw === 'text' ? 'text' : cur.message_type,
            audio_url: isAudio ? audioUrlIncoming ?? cur.audio_url : cur.audio_url,
            audio_duration_ms: isAudio ? audioDurIncoming ?? cur.audio_duration_ms : cur.audio_duration_ms,
            audio_mime_type: isAudio ? audioMimeIncoming ?? cur.audio_mime_type : cur.audio_mime_type,
            audio_upload_pending: isAudio ? false : cur.audio_upload_pending,
          };
          return sortRowsByCreatedAtAsc(next);
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
            ...(isAudio
              ? {
                  message_type: 'audio' as const,
                  audio_url: audioUrlIncoming ?? null,
                  audio_duration_ms: Number.isFinite(audioDurIncoming as number) ? audioDurIncoming : null,
                  audio_mime_type: audioMimeIncoming ?? null,
                }
              : {}),
          },
        ]);
      });
      scrollToEndThrottled(true);
      scheduleBackgroundPullFromSocket();

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

    const onAck = (p: {
      conversation_id?: string;
      message_id?: string;
      status?: string;
      message_type?: string;
      audio_url?: string | null;
      audio_duration_ms?: number | null;
      audio_mime_type?: string | null;
    }) => {
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
      const mtAck = String(p?.message_type ?? '').trim().toLowerCase();
      const isAudAck = mtAck === 'audio';
      setRows((prev) =>
        prev.map((m) => {
          if (rowIdLo(m) !== mid) return m;
          if (!myLo || String(m.sender_user_id || '').trim().toLowerCase() !== myLo) return m;
          return {
            ...m,
            out_status: 'sent',
            ...(isAudAck
              ? {
                  message_type: 'audio' as const,
                  audio_url: p.audio_url != null ? String(p.audio_url) : m.audio_url,
                  audio_duration_ms:
                    p.audio_duration_ms != null ? Number(p.audio_duration_ms) : m.audio_duration_ms,
                  audio_mime_type:
                    p.audio_mime_type != null ? String(p.audio_mime_type) : m.audio_mime_type,
                  audio_upload_pending: false,
                }
              : {}),
          };
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
      if (socketMsgPullDebounceRef.current) {
        clearTimeout(socketMsgPullDebounceRef.current);
        socketMsgPullDebounceRef.current = null;
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
  }, [cid, bootstrapPhase, pullMessagesFromApi, scrollToEndThrottled]);

  useEffect(() => {
    if (!cid || bootstrapPhase !== 'ready') return;
    const socket = getOrCreateSocket();
    const cidLo = cid.trim().toLowerCase();

    const matchesConv = (p: { conversation_id?: string | null }) => {
      const c = String(p?.conversation_id || '').trim().toLowerCase();
      return !!c && c === cidLo;
    };

    const onIncoming = (p: MuhabbetTripCallSocketPayload) => {
      const callId = p?.call_id != null ? String(p.call_id) : null;
      const sessionId = p?.session_id != null ? String(p.session_id) : p?.sessionId != null ? String(p.sessionId) : null;
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      console.log(
        '[muhabbet_chat_call_incoming]',
        JSON.stringify({ session_id: p.session_id, conversation_id: p.conversation_id })
      );
      console.log('CALL_RECEIVE', JSON.stringify({
        call_id: callId,
        session_id: sessionId,
        receiver_user: myLo || null,
        source: 'chat',
        ts: new Date().toISOString(),
      }));
      if (!matchesConv(p)) {
        console.log('CALL_IGNORED_REASON', JSON.stringify({
          call_id: callId,
          session_id: sessionId,
          reason: 'conversation_mismatch',
          ts: new Date().toISOString(),
        }));
        return;
      }
      const sid = normalizeMuhabbetSessionId(p.session_id || p.sessionId);
      setChatCallPayload((prev) => ({
        ...(prev || {}),
        ...p,
        session_id: sid,
      }));
      setChatCallState('incoming');
      console.log('CALL_UI_OPENED', JSON.stringify({
        call_id: callId,
        session_id: sid || sessionId,
        screen: 'MuhabbetChatScreen',
        opened_via: 'chat_listener',
        ts: new Date().toISOString(),
      }));
      void refreshLinkedTripSession();
    };

    const onAccept = (p: MuhabbetTripCallSocketPayload) => {
      console.log('[muhabbet_chat_call_accept]', JSON.stringify({ session_id: p.session_id }));
      if (!matchesConv(p)) return;
      const sid = normalizeMuhabbetSessionId(p.session_id || p.sessionId || chatCallPayloadRef.current?.session_id);
      setChatCallPayload((prev) => ({
        ...(prev || {}),
        ...p,
        session_id: sid || prev?.session_id,
      }));
      setChatCallState('active');
      void refreshLinkedTripSession();
    };

    const onDecline = (p: MuhabbetTripCallSocketPayload & { declined_by_user_id?: string }) => {
      console.log('[muhabbet_chat_call_decline]', JSON.stringify({ session_id: p.session_id }));
      if (!matchesConv(p)) return;
      const myLo = (myIdRef.current || '').trim().toLowerCase();
      const declinedBy = String(p.declined_by_user_id || '').trim().toLowerCase();
      const callerLo = String(chatCallPayloadRef.current?.caller_id || p.caller_id || '')
        .trim()
        .toLowerCase();
      if (myLo && declinedBy && callerLo && myLo === callerLo && declinedBy !== myLo) {
        Alert.alert('Muhabbet', 'Arama reddedildi');
      }
      setChatCallState('idle');
      setChatCallPayload(null);
      void refreshLinkedTripSession();
    };

    const onEnd = (p: MuhabbetTripCallSocketPayload) => {
      console.log('[muhabbet_chat_call_end]', JSON.stringify({ session_id: p.session_id }));
      if (!matchesConv(p)) return;
      setChatCallState('idle');
      setChatCallPayload(null);
      void refreshLinkedTripSession();
    };

    socket.on('muhabbet_trip_call_incoming', onIncoming);
    socket.on('muhabbet_trip_call_accept', onAccept);
    socket.on('muhabbet_trip_call_decline', onDecline);
    socket.on('muhabbet_trip_call_end', onEnd);

    return () => {
      socket.off('muhabbet_trip_call_incoming', onIncoming);
      socket.off('muhabbet_trip_call_accept', onAccept);
      socket.off('muhabbet_trip_call_decline', onDecline);
      socket.off('muhabbet_trip_call_end', onEnd);
    };
  }, [cid, bootstrapPhase, refreshLinkedTripSession]);

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
        const ix = prev.findIndex((m) => rowIdLo(m) === id);
        if (ix >= 0) {
          const cur = prev[ix];
          const mergedBody =
            text.trim() !== '' ? text : String(cur.body ?? '').trim() !== '' ? String(cur.body) : text;
          const next = [...prev];
          next[ix] = {
            ...cur,
            body: mergedBody,
            sender_user_id: senderLo || cur.sender_user_id,
            created_at: created,
            sender_role: roleFor ?? cur.sender_role ?? undefined,
          };
          return sortRowsByCreatedAtAsc(next);
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
      scrollToEndThrottled(true);
    });
    return () => sub.remove();
  }, [cid, scrollToEndThrottled]);

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
              message_type: m.message_type,
              audio_storage_path: m.audio_storage_path ?? undefined,
              audio_url: m.audio_url ?? undefined,
              audio_duration_ms: m.audio_duration_ms ?? undefined,
              audio_mime_type: m.audio_mime_type ?? undefined,
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
    const onMuErr = (p: {
      code?: string;
      detail?: string | { message?: string };
      message?: string;
      message_id?: string;
      conversation_id?: string;
      max?: number;
    }) => {
      const conv = p?.conversation_id != null ? String(p.conversation_id).toLowerCase() : '';
      if (conv && conv !== cid.toLowerCase()) return;
      const det =
        typeof p?.detail === 'string'
          ? p.detail
          : typeof p?.detail === 'object' && p?.detail && 'message' in p.detail
            ? String((p.detail as { message?: string }).message || '')
            : '';
      const msg = typeof p?.message === 'string' ? p.message : '';
      const errMid = normalizeMuhabbetMessageId(p?.message_id);
            if (p?.code === 'text_too_long') {
        Alert.alert('Mesaj çok uzun', det || `En fazla ${p?.max ?? 2000} karakter.`);
        return;
      }
      if (p?.code === 'not_registered') {
        notifyAuthTokenBecameAvailableForSocket();
        void (async () => {
          const retried = await retryPendingActionAfterNotRegistered();
          if (retried) return;
          const pending = pendingActionRef.current;
          if (pending?.kind === 'send_message') {
            pendingActionRef.current = null;
            await sendMessageViaRest(pending.messageId, pending.body, pending.audio ?? null);
            return;
          }
          pendingActionRef.current = null;
          if (errMid) {
            const row = rowsRef.current.find((m) => rowIdLo(m) === errMid);
            const aspRetry = (row?.audio_storage_path || '').trim();
            if (row?.message_type === 'audio' && aspRetry) {
              await sendMessageViaRest(errMid, row.body || '', {
                audio_storage_path: aspRetry,
                audio_duration_ms: Math.min(
                  30000,
                  Math.max(1, Number(row.audio_duration_ms || 1))
                ),
                audio_mime_type: String(row.audio_mime_type || 'audio/m4a'),
              });
              return;
            }
            if (row?.message_type === 'audio' && row.audio_url) {
              await sendMessageViaRest(errMid, row.body || '', {
                audio_url: String(row.audio_url),
                audio_duration_ms: Math.min(
                  30000,
                  Math.max(1, Number(row.audio_duration_ms || 1))
                ),
                audio_mime_type: String(row.audio_mime_type || 'audio/m4a'),
              });
              return;
            }
            if (row?.body) {
              await sendMessageViaRest(errMid, row.body);
              return;
            }
          }
          setRows((prev) => (errMid ? markMessageFailedById(prev, errMid) : markLatestSendingFailed(prev)));
        })();
        return;
      }
      if (p?.code === 'audio_invalid' || p?.code === 'bad_message_type') {
        setRows((prev) => (errMid ? markMessageFailedById(prev, errMid) : markLatestSendingFailed(prev)));
        Alert.alert('Sesli mesaj', msg || det || 'Sesli mesaj gönderilemedi.');
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
      if (!cid || !messageId) return;
      const asp = (row.audio_storage_path || '').trim();
      const legacyUrl = (row.audio_url || '').trim();
      const isAudio = row.message_type === 'audio' && (Boolean(asp) || Boolean(legacyUrl));
      if (!isAudio && !body) return;
      if (isAudio && !asp && !legacyUrl) return;

      setRows((prev) =>
        prev.map((m) => (rowIdLo(m) === rowIdLo({ id: messageId }) ? { ...m, out_status: 'sending' as const } : m))
      );
      const audioPayload =
        isAudio && asp
          ? {
              audio_storage_path: asp,
              audio_duration_ms: Math.min(30000, Math.max(1, Number(row.audio_duration_ms || 1))),
              audio_mime_type: String(row.audio_mime_type || 'audio/m4a'),
            }
          : isAudio && legacyUrl
            ? {
                audio_url: legacyUrl,
                audio_duration_ms: Math.min(30000, Math.max(1, Number(row.audio_duration_ms || 1))),
                audio_mime_type: String(row.audio_mime_type || 'audio/m4a'),
              }
            : null;
      pendingActionRef.current = {
        kind: 'send_message',
        messageId,
        body,
        retryCount: 0,
        ...(audioPayload ? { audio: audioPayload } : {}),
      };
      const ok = await sendMessageViaRest(messageId, body, audioPayload);
      if (!ok) {
        pendingActionRef.current = null;
        return;
      }
      scrollToEndThrottled(true);
      requestAnimationFrame(() => scrollToEndThrottled(true));
      try {
        const sock = getOrCreateSocket();
        if (sock.connected) {
          if (audioPayload) {
            sock.emit('muhabbet_send', {
              conversation_id: cid,
              message_type: 'audio',
              text: body,
              body,
              ...('audio_storage_path' in audioPayload
                ? { audio_storage_path: audioPayload.audio_storage_path }
                : { audio_url: audioPayload.audio_url }),
              audio_duration_ms: audioPayload.audio_duration_ms,
              audio_mime_type: audioPayload.audio_mime_type,
              message_id: messageId,
            });
          } else {
            sock.emit('muhabbet_send', { conversation_id: cid, text: body, message_id: messageId });
          }
        }
      } catch {
        /* noop — REST başarılı; socket opsiyonel */
      }
    },
    [cid, sendMessageViaRest, scrollToEndThrottled]
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
    scrollToEndThrottled(true);
    setDraft('');
    pendingActionRef.current = { kind: 'send_message', messageId, body, retryCount: 0 };
    const ok = await sendMessageViaRest(messageId, body);
    if (!ok) {
      pendingActionRef.current = null;
      return;
    }
    scrollToEndThrottled(true);
    requestAnimationFrame(() => scrollToEndThrottled(true));
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

  const muhabbetTripRestPostForSession = useCallback(
    async (
      sessionId: string,
      opts: { action: string; pathSuffix: string; body?: Record<string, unknown> }
    ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> => {
      const sid = normalizeMuhabbetSessionId(sessionId);
      const token = (await getPersistedAccessToken())?.trim() || '';
      if (!sid || !token) {
        return { ok: false, status: 0, json: {} };
      }
      const url = `${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}/${opts.pathSuffix}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(opts.body ?? {}),
        });
        let json: Record<string, unknown> = {};
        try {
          json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        } catch {
          json = {};
        }
        return { ok: res.ok, status: res.status, json };
      } catch {
        return { ok: false, status: -1, json: {} };
      }
    },
    [base]
  );

  const showSesliAraButton = useMemo(() => {
    if (!tripConvertEligible || !linkedTripSession) return false;
    const st = String(linkedTripSession.status || '').trim().toLowerCase();
    if (!['ready', 'started', 'active'].includes(st)) return false;
    if (String(linkedTripSession.boarding_qr_confirmed_at || '').trim()) return false;
    return true;
  }, [tripConvertEligible, linkedTripSession]);

  const startChatTripCall = useCallback(() => {
    const sid = normalizeMuhabbetSessionId(linkedTripSession?.id);
    const myLo = (myId || '').trim().toLowerCase();
    console.log('[muhabbet_chat_call_start]', JSON.stringify({ sessionId: sid, hasSession: !!linkedTripSession }));
    if (!sid || !linkedTripSession || !myLo) {
      Alert.alert('Muhabbet', 'Yolculuk bilgisi hazırlanıyor.');
      return;
    }
    if (chatCallStartInFlightRef.current) return;
    if (chatCallStateRef.current !== 'idle') return;
    const st = String(linkedTripSession.status || '').trim().toLowerCase();
    if (!['ready', 'started', 'active'].includes(st)) return;
    if (String(linkedTripSession.boarding_qr_confirmed_at || '').trim()) return;

    void (async () => {
      const passengerLo = String(linkedTripSession.passenger_id || '').trim().toLowerCase();
      const driverLo = String(linkedTripSession.driver_id || '').trim().toLowerCase();
      const targetLo = myLo === passengerLo ? driverLo : passengerLo;
      const callActionId = `chat_call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      latestChatCallActionIdRef.current = callActionId;
      chatCallStartInFlightRef.current = true;
      setChatCallState('outgoing');
      const nowIso = new Date().toISOString();
      setChatCallPayload({
        session_id: sid,
        conversation_id: linkedTripSession.conversation_id ?? undefined,
        channel_name: `muhabbet_trip_${sid}`,
        caller_id: myLo,
        target_user_id: targetLo,
        started_at: nowIso,
      });

      const token = (await getPersistedAccessToken())?.trim() || '';
      const url = `${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}/call/start`;
      try {
        if (!token) {
          if (latestChatCallActionIdRef.current !== callActionId) return;
          setChatCallState('idle');
          setChatCallPayload(null);
          chatCallStartInFlightRef.current = false;
          Alert.alert('Muhabbet', 'Arama başlatılamadı: Oturum anahtarı bulunamadı.');
          return;
        }
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        let parsedBody: Record<string, unknown> = {};
        try {
          parsedBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        } catch {
          parsedBody = {};
        }
        if (latestChatCallActionIdRef.current !== callActionId) return;
        if (res.ok && parsedBody.success === true) {
          latestChatCallActionIdRef.current = null;
          chatCallStartInFlightRef.current = false;
          const callObj = parsedBody.call as MuhabbetTripCallSocketPayload | undefined;
          const sessRaw = parsedBody.session;
          const sess =
            sessRaw && typeof sessRaw === 'object' ? (sessRaw as MuhabbetTripSession) : null;
          if (callObj && typeof callObj === 'object') {
            setChatCallPayload(callObj);
          } else if (sess) {
            const sidN = normalizeMuhabbetSessionId(sess.id);
            const passengerLoR = String(sess.passenger_id || '').trim().toLowerCase();
            const driverLoR = String(sess.driver_id || '').trim().toLowerCase();
            const callerLo = String(sess.caller_id || myLo).trim().toLowerCase();
            const targetLoR = callerLo === passengerLoR ? driverLoR : passengerLoR;
            setChatCallPayload({
              session_id: sidN,
              conversation_id: sess.conversation_id ?? undefined,
              channel_name: String(sess.call_channel_name || `muhabbet_trip_${sidN}`),
              caller_id: callerLo,
              target_user_id: targetLoR,
              started_at: sess.call_started_at ?? undefined,
            });
          }
          if (sess) {
            setLinkedTripSession(sess);
          }
          setChatCallState('outgoing');
          void refreshLinkedTripSession();
          return;
        }
        setChatCallState('idle');
        setChatCallPayload(null);
        const detailMsg = muhabbetTripRestDetail(parsedBody.detail, '');
        Alert.alert(
          'Muhabbet',
          detailMsg ? `Arama başlatılamadı: ${detailMsg}` : 'Arama başlatılamadı.'
        );
        void refreshLinkedTripSession();
      } catch (e) {
        if (latestChatCallActionIdRef.current !== callActionId) return;
        setChatCallState('idle');
        setChatCallPayload(null);
        Alert.alert('Muhabbet', `Arama başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (latestChatCallActionIdRef.current === callActionId) {
          chatCallStartInFlightRef.current = false;
        }
      }
    })();
  }, [base, linkedTripSession, myId, refreshLinkedTripSession]);

  const acceptChatTripCall = useCallback(() => {
    const sid = normalizeMuhabbetSessionId(
      linkedTripSession?.id || chatCallPayload?.session_id || chatCallPayload?.sessionId
    );
    if (!sid) return;
    void (async () => {
      const snapPayload = chatCallPayload;
      const snapState = chatCallState;
      setChatCallState('active');
      setChatCallPayload((prev) => ({ ...(prev || {}), session_id: sid }));
      try {
        const rest = await muhabbetTripRestPostForSession(sid, {
          action: 'call_accept',
          pathSuffix: 'call/accept',
        });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setLinkedTripSession(sess as MuhabbetTripSession);
          }
          void refreshLinkedTripSession();
          return;
        }
        setChatCallState(snapState);
        setChatCallPayload(snapPayload);
        const msg = muhabbetTripRestDetail(rest.json.detail, 'Çağrı kabul edilemedi.');
        if (msg) Alert.alert('Muhabbet', msg);
        void refreshLinkedTripSession();
      } catch {
        setChatCallState(snapState);
        setChatCallPayload(snapPayload);
      }
    })();
  }, [
    chatCallPayload,
    chatCallState,
    linkedTripSession?.id,
    muhabbetTripRestPostForSession,
    refreshLinkedTripSession,
  ]);

  const declineChatTripCall = useCallback(() => {
    const sid = normalizeMuhabbetSessionId(
      linkedTripSession?.id || chatCallPayload?.session_id || chatCallPayload?.sessionId
    );
    if (!sid) return;
    void (async () => {
      try {
        const rest = await muhabbetTripRestPostForSession(sid, {
          action: 'call_decline',
          pathSuffix: 'call/decline',
        });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setLinkedTripSession(sess as MuhabbetTripSession);
          }
        }
      } finally {
        setChatCallState('idle');
        setChatCallPayload(null);
        void refreshLinkedTripSession();
      }
    })();
  }, [chatCallPayload, linkedTripSession?.id, muhabbetTripRestPostForSession, refreshLinkedTripSession]);

  const endChatTripCall = useCallback(() => {
    const sid = normalizeMuhabbetSessionId(
      linkedTripSession?.id || chatCallPayload?.session_id || chatCallPayload?.sessionId
    );
    if (!sid) {
      setChatCallState('idle');
      setChatCallPayload(null);
      return;
    }
    void (async () => {
      try {
        const rest = await muhabbetTripRestPostForSession(sid, {
          action: 'call_end',
          pathSuffix: 'call/end',
        });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setLinkedTripSession(sess as MuhabbetTripSession);
          }
        }
      } finally {
        setChatCallState('idle');
        setChatCallPayload(null);
        void refreshLinkedTripSession();
      }
    })();
  }, [chatCallPayload, linkedTripSession?.id, muhabbetTripRestPostForSession, refreshLinkedTripSession]);

  const bubbleForMsg = (item: ChatMessageRow) => {
    const mine = myId && String(item.sender_user_id || '').toLowerCase() === myId;
    const srStored = (item.sender_role && String(item.sender_role).trim()) || '';
    const sr = srStored || (mine ? myR : oR);
    const drv = isDriverAppRole(sr);
    return { mine, drv };
  };

  const sendTripConvertRequest = useCallback(async () => {
    console.log('TRIP_CONVERT_PRESS', JSON.stringify({
      conversation_id: cid || null,
      trip_convert_state: tripConvertState,
      loading: tripConvertLoading,
      ts: new Date().toISOString(),
    }));
    if (!cid) {
      console.log('TRIP_CONVERT_DUPLICATE_PRESS_IGNORED', JSON.stringify({
        reason: 'missing_conversation_id',
        ts: new Date().toISOString(),
      }));
      return;
    }
    if (tripConvertRequestInFlightRef.current) {
      console.log('TRIP_CONVERT_DUPLICATE_PRESS_IGNORED', JSON.stringify({
        reason: 'inflight_ref_lock',
        conversation_id: cid,
        ts: new Date().toISOString(),
      }));
      return;
    }
    if (tripConvertLoading || tripConvertState !== 'idle') {
      console.log('TRIP_CONVERT_DUPLICATE_PRESS_IGNORED', JSON.stringify({
        reason: tripConvertLoading ? 'loading_state' : 'trip_convert_state_not_idle',
        conversation_id: cid,
        trip_convert_state: tripConvertState,
        loading: tripConvertLoading,
        ts: new Date().toISOString(),
      }));
      return;
    }
    tripConvertRequestInFlightRef.current = true;
    setTripConvertLoading(true);
    let requestOutcome: 'success' | 'guarded' | 'error' = 'guarded';
    try {
      console.log('TRIP_CONVERT_REQUEST_START', JSON.stringify({
        conversation_id: cid,
        ts: new Date().toISOString(),
      }));
      console.log('[trip_convert] 1 before initial pullMessagesFromApi');
      const pulled = await pullMessagesFromApi();
      console.log('[trip_convert] 2 after initial pullMessagesFromApi', {
        ok: pulled.ok,
        trip_convert_request: pulled.context?.trip_convert_request ?? null,
      });
      if (!pulled.ok) {
        console.log('TRIP_CONVERT_REQUEST_ERROR', JSON.stringify({
          conversation_id: cid,
          reason: 'preflight_pull_failed',
          ts: new Date().toISOString(),
        }));
        Alert.alert(
          'Yolculuğa çevir',
          'Sohbet güncellenemedi. Bağlantınızı kontrol edip tekrar deneyin.'
        );
        await pullMessagesFromApi();
        return;
      }
      const tcr = pulled.context?.trip_convert_request;
      if (tcr?.pending === true && tcr.is_requester === true) {
        pendingActionRef.current = null;
        requestOutcome = 'guarded';
        return;
      }

      console.log('[trip_convert] 3 before REST POST trip-convert/request');
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        console.log('TRIP_CONVERT_REQUEST_ERROR', JSON.stringify({
          conversation_id: cid,
          reason: 'missing_token',
          ts: new Date().toISOString(),
        }));
        Alert.alert('Yolculuğa çevir', 'Oturum bulunamadı.');
        return;
      }
      const restUrl = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/trip-convert/request`;
      const res = await fetch(restUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const restBody = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        reused?: boolean;
        trip_convert_request?: unknown;
        detail?: unknown;
      };
      console.log('[trip_convert] 4 after REST POST', {
        httpOk: res.ok,
        status: res.status,
        success: restBody.success,
        reused: restBody.reused,
        trip_convert_request: restBody.trip_convert_request ?? null,
      });
      if (!res.ok) {
        console.log('TRIP_CONVERT_REQUEST_ERROR', JSON.stringify({
          conversation_id: cid,
          reason: 'request_failed',
          status: res.status,
          ts: new Date().toISOString(),
        }));
        pendingActionRef.current = null;
        const msg = formatTripConvertRestDetail(
          restBody.detail,
          `İstek gönderilemedi (${res.status})`
        );
        Alert.alert('Yolculuğa çevir', msg || 'İstek gönderilemedi.');
        return;
      }

      pendingActionRef.current = null;
      requestOutcome = 'success';
      console.log('[trip_convert] 5 client: no socket.emit (server notifies passenger via REST handler)');
      console.log('[trip_convert] 6 (skipped) no client socket.emit before/after');
      const pulledAfter = await pullMessagesFromApi();
      console.log('[trip_convert] 7 after pullMessagesFromApi post-REST', {
        ok: pulledAfter.ok,
        trip_convert_request: pulledAfter.context?.trip_convert_request ?? null,
      });
      scheduleTripConvertPullRetries(pullMessagesFromApi);
    } catch (e) {
      console.log('TRIP_CONVERT_REQUEST_ERROR', JSON.stringify({
        conversation_id: cid,
        reason: 'unexpected_exception',
        error: e instanceof Error ? e.message : String(e),
        ts: new Date().toISOString(),
      }));
      requestOutcome = 'error';
      throw e;
    } finally {
      tripConvertRequestInFlightRef.current = false;
      console.log('TRIP_CONVERT_REQUEST_DONE', JSON.stringify({
        conversation_id: cid,
        outcome: requestOutcome,
        ts: new Date().toISOString(),
      }));
      console.log('[trip_convert] 8 finally setTripConvertLoading(false)');
      setTripConvertLoading(false);
    }
  }, [base, cid, tripConvertLoading, tripConvertState, pullMessagesFromApi]);

  const acceptTripConvertFromModal = useCallback(async () => {
    if (!cid || !tripConvertInModal) return;
    if (tripConvertModalActionBusyRef.current) return;
    const requestId = tripConvertInModal.rid;
    tripConvertModalActionBusyRef.current = true;
    console.log(`[trip_convert_modal] action=accept requestId=${requestId} cid=${cid}`);
    setTripConvertModalBusy(true);

    optimisticTripConvertRef.current = true;
    lastTripConvertCtxSigRef.current = null;
    setTripConvertInModal(null);

    pendingActionRef.current = { kind: 'trip_convert_accept', requestId, retryCount: 0 };

    const finishPullRetries = () => {
      scheduleTripConvertAcceptPullRetries(() => pullMessagesFromApi());
    };

    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        optimisticTripConvertRef.current = false;
        pendingActionRef.current = null;
        setTripConvertInModal({ rid: requestId });
        Alert.alert('Yolculuğa çevir', 'Oturum bulunamadı.');
        await pullMessagesFromApi();
        return;
      }

      const restUrl = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/trip-convert/accept`;
      let httpStatus = -1;
      let restBody: {
        success?: boolean;
        session?: { id?: string; session_id?: string };
        trip_convert_request?: unknown;
        detail?: unknown;
      } = {};
      try {
        const res = await fetch(restUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ request_id: requestId }),
        });
        httpStatus = res.status;
        restBody = (await res.json().catch(() => ({}))) as typeof restBody;
      } catch (netErr) {
        httpStatus = 0;
        restBody = { detail: String(netErr) };
      }
      console.log(
        '[trip_convert_rest]',
        JSON.stringify({
          action: 'accept',
          cid,
          requestId,
          status: httpStatus,
          body: restBody,
        })
      );

      const restOk = httpStatus >= 200 && httpStatus < 300 && restBody.success === true;
      if (restOk) {
        pendingActionRef.current = null;
        await pullMessagesFromApi();
        finishPullRetries();
        const sid = String(restBody.session?.id || restBody.session?.session_id || '')
          .trim()
          .toLowerCase();
        if (sid && sid !== 'undefined' && sid !== 'null') {
          navigateToLeylekTripSession({ session_id: sid });
        }
        return;
      }

      const failMsg = formatTripConvertRestDetail(
        restBody.detail,
        httpStatus > 0 ? `Kabul edilemedi (${httpStatus})` : 'Bağlantı hatası. Lütfen tekrar deneyin.'
      );
      optimisticTripConvertRef.current = false;
      pendingActionRef.current = null;
      setTripConvertInModal({ rid: requestId });
      Alert.alert('Yolculuğa çevir', failMsg || 'Kabul edilemedi.');
      await pullMessagesFromApi();
    } catch (e) {
      console.warn('[trip_convert_modal] accept error', { requestId, cid, err: String(e) });
      optimisticTripConvertRef.current = false;
      pendingActionRef.current = null;
      setTripConvertInModal({ rid: requestId });
      Alert.alert('Yolculuğa çevir', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      await pullMessagesFromApi();
    } finally {
      tripConvertModalActionBusyRef.current = false;
      setTripConvertModalBusy(false);
    }
  }, [base, cid, navigateToLeylekTripSession, tripConvertInModal, pullMessagesFromApi]);

  const declineTripConvertFromModal = useCallback(async () => {
    if (!cid || !tripConvertInModal) return;
    if (tripConvertModalActionBusyRef.current) return;
    const requestId = tripConvertInModal.rid;
    tripConvertModalActionBusyRef.current = true;
    console.log(`[trip_convert_modal] action=decline requestId=${requestId} cid=${cid}`);
    setTripConvertModalBusy(true);
    pendingActionRef.current = { kind: 'trip_convert_decline', requestId, retryCount: 0 };

    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        pendingActionRef.current = null;
        Alert.alert('Yolculuğa çevir', 'Oturum bulunamadı.');
        await pullMessagesFromApi();
        return;
      }

      const restUrl = `${base}/muhabbet/conversations/${encodeURIComponent(cid)}/trip-convert/decline`;
      let httpStatus = -1;
      let restBody: { success?: boolean; trip_convert_request?: unknown; detail?: unknown } = {};
      try {
        const res = await fetch(restUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ request_id: requestId }),
        });
        httpStatus = res.status;
        restBody = (await res.json().catch(() => ({}))) as typeof restBody;
      } catch (netErr) {
        httpStatus = 0;
        restBody = { detail: String(netErr) };
      }
      console.log(
        '[trip_convert_rest]',
        JSON.stringify({
          action: 'decline',
          cid,
          requestId,
          status: httpStatus,
          body: restBody,
        })
      );

      const restOk = httpStatus >= 200 && httpStatus < 300 && restBody.success === true;
      if (restOk) {
        pendingActionRef.current = null;
        await pullMessagesFromApi();
        scheduleTripConvertPullRetries(pullMessagesFromApi);
        return;
      }

      const failMsg = formatTripConvertRestDetail(
        restBody.detail,
        httpStatus > 0 ? `Reddetme başarısız (${httpStatus})` : 'Bağlantı hatası. Lütfen tekrar deneyin.'
      );
      pendingActionRef.current = null;
      Alert.alert('Yolculuğa çevir', failMsg || 'Reddetme başarısız.');
      await pullMessagesFromApi();
    } catch (e) {
      console.warn('[trip_convert_modal] decline error', { requestId, cid, err: String(e) });
      pendingActionRef.current = null;
      Alert.alert('Yolculuğa çevir', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      await pullMessagesFromApi();
    } finally {
      tripConvertModalActionBusyRef.current = false;
      setTripConvertModalBusy(false);
    }
  }, [base, cid, tripConvertInModal, pullMessagesFromApi]);

  const activeTripCallSessionId = normalizeMuhabbetSessionId(
    linkedTripSession?.id || chatCallPayload?.session_id || chatCallPayload?.sessionId
  );
  const tripCallScreenVisible = chatCallState !== 'idle' && !!activeTripCallSessionId;
  const tripCallScreenMode: 'outgoing' | 'incoming' | 'active' =
    chatCallState === 'active' ? 'active' : chatCallState === 'incoming' ? 'incoming' : 'outgoing';

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <LinearGradient
        colors={['#F8FAFC', '#EFF6FF', '#FFFDFB']}
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
        {showSesliAraButton ? (
          <View style={styles.voiceCallStrip} accessibilityRole="toolbar">
            <Pressable
              onPress={startChatTripCall}
              style={styles.voiceCallBtn}
              accessibilityRole="button"
              accessibilityLabel="Sesli ara"
            >
              <Ionicons name="call" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.voiceCallBtnTxt}>Sesli Ara</Text>
            </Pressable>
          </View>
        ) : null}
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          enabled
        >
          <View style={styles.kavInner}>
          {bootstrapPhase === 'loading' ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY_GRAD[0]} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={styles.listFlex}
              data={rows}
              extraData={{ playingAudioId, recordingActive }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onContentSizeChange={() => scrollToEndThrottled(false)}
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
                const isAud =
                  item.message_type === 'audio' ||
                  (item.audio_url != null && String(item.audio_url).trim() !== '') ||
                  (item.audio_storage_path != null && String(item.audio_storage_path).trim() !== '');
                const uploading = Boolean(item.audio_upload_pending && item.out_status === 'sending');
                const durLabel = formatDurationClock(
                  Math.min(30000, Math.max(0, Number(item.audio_duration_ms || 0)))
                );
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
                            style={[styles.bubblePad, styles.bubbleRadiusMine]}
                          >
                            {!isAud ? (
                              <Text
                                style={styles.tBubbleMine}
                                selectable
                                {...(Platform.OS === 'android' ? { textBreakStrategy: 'highQuality' as const } : {})}
                              >
                                {item.body || ''}
                              </Text>
                            ) : (
                              <View style={styles.audioBubbleContentMine}>
                                {uploading || !item.audio_url ? (
                                  <>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={[styles.tBubbleMine, styles.audioPrimaryLabelMine]}>
                                      Sesli mesaj gönderiliyor...
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    <Pressable
                                      onPress={() => void togglePlayAudioForRow(item)}
                                      hitSlop={8}
                                      accessibilityRole="button"
                                      accessibilityLabel={playingAudioId === item.id ? 'Duraklat' : 'Oynat'}
                                    >
                                      <Ionicons
                                        name={playingAudioId === item.id ? 'pause' : 'play'}
                                        size={22}
                                        color="#fff"
                                      />
                                    </Pressable>
                                    <Text style={styles.tBubbleMine}>{durLabel}</Text>
                                  </>
                                )}
                                {item.body?.trim() ? (
                                  <Text
                                    style={[styles.tBubbleMine, styles.audioCaptionMine]}
                                    selectable
                                    {...(Platform.OS === 'android'
                                      ? { textBreakStrategy: 'highQuality' as const }
                                      : {})}
                                  >
                                    {item.body}
                                  </Text>
                                ) : null}
                              </View>
                            )}
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
                        <View
                          style={[
                            styles.bubblePadTheirs,
                            styles.bubbleRadiusTheirs,
                            drv ? styles.theirsStripeDriver : styles.theirsStripePax,
                          ]}
                        >
                          {!isAud ? (
                            <Text
                              style={styles.tBubbleTheirs}
                              selectable
                              {...(Platform.OS === 'android' ? { textBreakStrategy: 'highQuality' as const } : {})}
                            >
                              {item.body || ''}
                            </Text>
                          ) : (
                            <View style={styles.audioBubbleContentTheirs}>
                              {item.audio_url ? (
                                <>
                                  <Pressable
                                    onPress={() => void togglePlayAudioForRow(item)}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel={playingAudioId === item.id ? 'Duraklat' : 'Oynat'}
                                  >
                                    <Ionicons
                                      name={playingAudioId === item.id ? 'pause' : 'play'}
                                      size={22}
                                      color={PRIMARY_GRAD[0]}
                                    />
                                  </Pressable>
                                  <Text style={styles.tAudioDurTheirs}>{durLabel}</Text>
                                </>
                              ) : (
                                <Text style={styles.tBubbleTheirs}>Sesli mesaj</Text>
                              )}
                              {item.body?.trim() ? (
                                <Text
                                  style={[styles.tBubbleTheirs, styles.audioCaptionTheirs]}
                                  selectable
                                  {...(Platform.OS === 'android'
                                    ? { textBreakStrategy: 'highQuality' as const }
                                    : {})}
                                >
                                  {item.body}
                                </Text>
                              ) : null}
                            </View>
                          )}
                        </View>
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
                    onPressIn={() => {
                      if (tripConvertLoading || tripConvertState === 'pending') return;
                      void tapButtonHaptic();
                    }}
                    disabled={tripConvertLoading || tripConvertState === 'pending'}
                    style={({ pressed }) => [
                      styles.convertPlanButton,
                      {
                        transform: [
                          {
                            scale:
                              pressed && !tripConvertLoading && tripConvertState !== 'pending' ? 0.97 : 1,
                          },
                        ],
                      },
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
                  {tripConvertStaleHint && tripConvertState === 'pending' ? (
                    <Text style={styles.tripConvertStaleTxt}>Yanıt bekleniyor, bağlantı yenileniyor...</Text>
                  ) : null}
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
          <View
            style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 10) }]}
          >
            {recordingActive ? (
              <View style={styles.recordBar}>
                <Text style={styles.recordBarTitle}>
                  Kaydediliyor {formatDurationClock(recordingElapsedMs)}
                </Text>
                <View style={styles.recordBarActions}>
                  <Pressable onPress={() => void cancelRecording()} style={styles.recordBtnSec} accessibilityRole="button">
                    <Text style={styles.recordBtnSecTxt}>İptal</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void finalizeRecordingAndSend()}
                    style={styles.recordBtnPri}
                    accessibilityRole="button"
                  >
                    <Text style={styles.recordBtnPriTxt}>Durdur</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => void startRecording()}
                  disabled={!cid}
                  style={({ pressed }) => [styles.micBtn, !cid && { opacity: 0.4 }, pressed && cid && { opacity: 0.88 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Sesli mesaj kaydet"
                >
                  <Ionicons name="mic" size={22} color={PRIMARY_GRAD[0]} />
                </Pressable>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => {
                    scrollToEndThrottled(true);
                    requestAnimationFrame(() => scrollToEndThrottled(true));
                  }}
                  placeholder="Mesaj yaz…"
                  placeholderTextColor={TEXT_SECONDARY}
                  multiline
                  maxLength={1000}
                  textAlignVertical={Platform.OS === 'android' ? 'top' : undefined}
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
              </>
            )}
          </View>
          </View>
        </KeyboardAvoidingView>
        <Modal
          visible={!!tripConvertInModal}
          transparent
          animationType="none"
          onRequestClose={() => {
            if (tripConvertModalBusy) return;
            void declineTripConvertFromModal();
          }}
        >
          <View style={[styles.pairModalRoot, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                styles.pairModalBackdropTint,
                { opacity: tripConvertModalBackdropOpacity },
              ]}
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              disabled={tripConvertModalBusy}
              onPress={() => {
                if (tripConvertModalBusy) return;
                void declineTripConvertFromModal();
              }}
            />
            <Animated.View
              style={[
                styles.pairModalCard,
                {
                  transform: [{ translateY: tripConvertModalCardTranslateY }, { scale: tripConvertModalCardScale }],
                },
              ]}
            >
              <View style={styles.pairModalIconWrap}>
                <Ionicons name="shield-checkmark" size={22} color="#1D4ED8" />
              </View>
              <Text style={styles.pairModalTitle}>Yolculuğa çevirme isteği</Text>
              <Text style={styles.pairModalBody}>
                Sürücü yolculuğu başlatmak istiyor. Kabul ediyor musun?
              </Text>
              <Pressable
                onPress={() => void acceptTripConvertFromModal()}
                onPressIn={() => {
                  if (tripConvertModalBusy) return;
                  void tapButtonHaptic();
                }}
                disabled={tripConvertModalBusy}
                style={({ pressed }) => [
                  styles.pairModalPri,
                  {
                    transform: [{ scale: pressed && !tripConvertModalBusy ? 0.97 : 1 }],
                  },
                  pressed && !tripConvertModalBusy && { opacity: 0.92 },
                  tripConvertModalBusy && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Evet"
              >
                <Text style={styles.pairModalPriTxt}>{tripConvertModalBusy ? 'İşleniyor…' : 'Evet'}</Text>
              </Pressable>
              <Pressable
                onPress={() => void declineTripConvertFromModal()}
                onPressIn={() => {
                  if (tripConvertModalBusy) return;
                  void tapButtonHaptic();
                }}
                disabled={tripConvertModalBusy}
                style={({ pressed }) => [
                  styles.pairModalSec,
                  {
                    transform: [{ scale: pressed && !tripConvertModalBusy ? 0.97 : 1 }],
                  },
                  pressed && !tripConvertModalBusy && { opacity: 0.88 },
                  tripConvertModalBusy && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Hayır"
              >
                <Text style={styles.pairModalSecTxt}>Hayır</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
        <MuhabbetTripCallScreen
          visible={tripCallScreenVisible}
          mode={tripCallScreenMode}
          apiBaseUrl={base}
          sessionId={activeTripCallSessionId}
          peerName={chatHeaderTitle}
          peerRoleLabel={chatHeaderRole}
          onAccept={acceptChatTripCall}
          onDecline={declineChatTripCall}
          onCancel={endChatTripCall}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ECEFF4' },
  wmWrap: { ...StyleSheet.absoluteFillObject, opacity: 0.28, zIndex: 0 },
  layer: { flex: 1, zIndex: 1 },
  kav: { flex: 1 },
  kavInner: { flex: 1 },
  listFlex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  peerHeaderCard: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  peerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
  peerAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  peerAvatarInitials: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
  peerName: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, letterSpacing: -0.2 },
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
  voiceCallStrip: {
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: 'stretch',
  },
  voiceCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  voiceCallBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  list: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, flexGrow: 1 },
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
  bubbleColMine: { alignSelf: 'flex-end', maxWidth: '88%', marginBottom: 10 },
  bubbleColTheirs: { alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 10 },
  bubbleRowMine: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 6 },
  bubbleRowTheirs: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start', gap: 6 },
  trashHit: { padding: 4, opacity: 0.5 },
  bubbleMax: { maxWidth: '100%', flexShrink: 1 },
  bubbleShadowWrap: {
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
    borderRadius: 22,
    maxWidth: '100%',
  },
  bubbleAlignEnd: { alignSelf: 'flex-end' },
  bubbleAlignStart: { alignSelf: 'flex-start' },
  bubblePad: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexShrink: 1,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  bubbleRadiusMine: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 5,
  },
  bubblePadTheirs: {
    backgroundColor: THEIRS_BUBBLE_BG,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexShrink: 1,
    maxWidth: '100%',
  },
  bubbleRadiusTheirs: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 5,
  },
  theirsStripeDriver: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderTopColor: THEIRS_BUBBLE_BORDER,
    borderRightColor: THEIRS_BUBBLE_BORDER,
    borderBottomColor: THEIRS_BUBBLE_BORDER,
    borderLeftColor: 'rgba(37, 99, 235, 0.72)',
  },
  theirsStripePax: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderTopColor: THEIRS_BUBBLE_BORDER,
    borderRightColor: THEIRS_BUBBLE_BORDER,
    borderBottomColor: THEIRS_BUBBLE_BORDER,
    borderLeftColor: 'rgba(234, 88, 12, 0.65)',
  },
  tBubbleMine: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    flexShrink: 1,
    alignSelf: 'stretch',
    maxWidth: '100%',
    letterSpacing: 0.15,
  },
  tBubbleTheirs: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    flexShrink: 1,
    alignSelf: 'stretch',
    maxWidth: '100%',
    letterSpacing: 0.1,
  },
  timeRowMine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5,
    gap: 6,
    paddingRight: 2,
  },
  tTimeMine: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'right',
    fontWeight: '500',
    letterSpacing: 0.35,
  },
  resendRow: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  resendTxt: { fontSize: 12, fontWeight: '600', color: '#1D4ED8' },
  tTimeTheirs: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 5,
    marginLeft: 4,
    fontWeight: '500',
    letterSpacing: 0.35,
  },
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
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(22,163,74,0.16)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
      default: {},
    }),
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
  convertPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#16A34A',
    ...Platform.select({
      ios: {
        shadowColor: '#15803d',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  convertPlanButtonTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  tripConvertStaleTxt: {
    marginTop: 8,
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
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
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  pairModalBackdropTint: {
    backgroundColor: 'rgba(15,23,42,0.52)',
  },
  pairModalCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    zIndex: 2,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  pairModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(37,99,235,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.18)',
  },
  pairModalTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center', letterSpacing: -0.3 },
  pairModalBody: { marginTop: 8, fontSize: 15, color: TEXT_SECONDARY, lineHeight: 22, textAlign: 'center' },
  pairModalPri: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#15803d',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  pairModalPriTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  pairModalSec: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(60,60,67,0.1)',
    alignItems: 'center',
  },
  pairModalSecTxt: { fontSize: 16, fontWeight: '600', color: '#374151' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.07)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.09)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 10,
    fontSize: 15,
    color: TEXT_PRIMARY,
    backgroundColor: '#F8FAFC',
    fontWeight: '400',
  },
  sendBtnWrap: { borderRadius: 23, overflow: 'hidden', ...BUBBLE_SHADOW },
  sendBtnGrad: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.09)',
  },
  recordBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    gap: 12,
  },
  recordBarTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  recordBarActions: { flexDirection: 'row', gap: 8 },
  recordBtnSec: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  recordBtnSecTxt: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  recordBtnPri: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: PRIMARY_GRAD[0] },
  recordBtnPriTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  audioBubbleContentMine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  audioPrimaryLabelMine: { flex: 1, minWidth: 120 },
  audioCaptionMine: { width: '100%', marginTop: 8, opacity: 0.92, fontSize: 14 },
  audioBubbleContentTheirs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  audioCaptionTheirs: { width: '100%', marginTop: 8, fontSize: 14 },
  tAudioDurTheirs: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
});
