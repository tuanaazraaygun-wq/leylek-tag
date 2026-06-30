/**
 * Güven AL — state, API, socket ve yeniden bağlanma (index.tsx ile aynı davranış, taşınmış kod).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { appAlert } from '../contexts/AppAlertContext';
import { displayFirstName } from '../lib/displayName';
import {
  postTrustRequest,
  postTrustRespond,
  getTrustActive,
  type TrustActiveSessionRow,
} from '../lib/trustApi';
import { BOARDING_COMMS_CLOSED_USER_MSG, BOARDING_COMM_CLOSED_CODE } from '../lib/boardingCommsClosed';
import { playVideoTrustCallSoundRepeatTick, stopVideoTrustCachedPlayback } from '../utils/sound';
import {
  startRepeatingAlertSound,
  stopAllRepeatingAlertSounds,
  stopRepeatingAlertSound,
} from '../lib/repeatingAlertSoundController';
import { offerSoundController } from '../lib/offerSoundController';
import { perfLog } from '../utils/perfDiagLog';

/** P0-E4 — Güven Al call setup latency marks (tag_id / request_id keyed). */
const trustCallPerfMarks = new Map<string, number>();

function maskTrustIdForPerf(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.length <= 8) return `***${s.slice(-2)}`;
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

function trustCallPerfKey(tagId?: string | null, requestId?: string | null): string {
  const r = String(requestId ?? '').trim();
  if (r) return `req:${r.toLowerCase()}`;
  const t = String(tagId ?? '').trim();
  if (t) return `tag:${t.toLowerCase()}`;
  return '';
}

function linkTrustCallPerfMark(tagId: string, requestId: string): void {
  const tagKey = trustCallPerfKey(tagId, null);
  const reqKey = trustCallPerfKey(null, requestId);
  const t0 = tagKey ? trustCallPerfMarks.get(tagKey) : undefined;
  if (t0 != null && reqKey) {
    trustCallPerfMarks.set(reqKey, t0);
  }
}

export function markTrustCallTap(tagId: string): void {
  const tid = String(tagId ?? '').trim();
  if (!tid) return;
  const key = trustCallPerfKey(tid, null);
  if (key) trustCallPerfMarks.set(key, Date.now());
}

type TrustCallPerfPayload = {
  role?: 'passenger' | 'driver' | null;
  tag_id?: string | null;
  request_id?: string | null;
  source?: string;
  reason?: string;
  platform?: string;
  elapsed_ms?: number;
};

export function trustCallPerf(step: string, payload: TrustCallPerfPayload = {}): void {
  try {
    const tagIdMasked = payload.tag_id != null ? maskTrustIdForPerf(payload.tag_id) : null;
    const requestIdMasked = payload.request_id != null ? maskTrustIdForPerf(payload.request_id) : null;
    const key = trustCallPerfKey(payload.tag_id, payload.request_id);
    const t0 = key ? trustCallPerfMarks.get(key) : undefined;
    const elapsed_ms =
      payload.elapsed_ms != null
        ? payload.elapsed_ms
        : t0 != null
          ? Date.now() - t0
          : undefined;
    perfLog(
      step,
      JSON.stringify({
        step,
        platform: payload.platform ?? Platform.OS,
        role: payload.role ?? null,
        tag_id: tagIdMasked,
        request_id: requestIdMasked,
        ...(payload.source != null ? { source: payload.source } : {}),
        ...(payload.reason != null ? { reason: payload.reason } : {}),
        ...(elapsed_ms != null ? { elapsed_ms } : {}),
      }),
    );
  } catch {
    /* noop */
  }
}

export type TrustGuvenBlockReason =
  | 'boarding_confirmed'
  | 'trust_pending'
  | 'incoming_modal_open'
  | 'trust_video_active'
  | 'trust_modal_loading'
  | 'call_screen_active'
  | 'no_active_tag';

export const TRUST_GUVEN_BLOCK_MESSAGES: Record<TrustGuvenBlockReason, string> = {
  boarding_confirmed: 'Yolculuk doğrulandıktan sonra Güven Al kullanılamaz.',
  trust_pending: 'Güven Al isteği zaten beklemede.',
  incoming_modal_open: 'Gelen Güven Al isteğini önce yanıtla.',
  trust_video_active: 'Görüntülü güven görüşmesi zaten açık.',
  trust_modal_loading: 'Gelen Güven Al isteği yanıtlanıyor.',
  call_screen_active: 'Önce devam eden aramayı sonlandırın.',
  no_active_tag: 'Aktif eşleşme bulunamadı.',
};

/** tag_id / activeTag yarışı için kısa retry; socket tek sefer kaçsa bile activeTag yetişince modal / video açılır */
const MAX_TRUST_TAG_RETRY_ATTEMPTS = 14;
const TRUST_TAG_RETRY_BASE_MS = 260;

/** İstek sahibi (outgoing): trust_session_ready socket kaçınca GET /trust/active ile accepted yakalama */
const REQUESTER_TRUST_POLL_INTERVAL_MS = 3000;
const REQUESTER_TRUST_POLL_MAX_MS = 48000;

/** Güven görüşmesi UI açıkken trust_session_ended kaçsa bile GET /trust/active ile düşük frekanslı doğrulama */
const TRUST_VIDEO_ACTIVE_POLL_MS = 2600;

/** Gelen pending güven isteği: socket kaçsa / tag geç hydrate olsa bile GET /trust/active ile toparla */
const INCOMING_PENDING_TRUST_RECOVERY_INTERVAL_MS = 5200;
const TRUST_TERMINAL_COOLDOWN_MS = Platform.OS === 'ios' ? 220 : 120;
const TRUST_GUVEN_PRESS_DEBOUNCE_MS = 3000;

const ACTIVE_TAG_INCOMING_RECOVERY_DELAY_MS = 420;

function normTrustId(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function trustVideoSessionKey(trustId: unknown, channelName: unknown): string {
  return `${normTrustId(trustId)}|${String(channelName ?? '').trim()}`;
}

function isDuplicateTrustVideoSession(
  current: TrustVideoSessionState,
  trustId: string,
  channelName: string,
): boolean {
  if (!current) return false;
  return trustVideoSessionKey(current.trustId, current.channelName) === trustVideoSessionKey(trustId, channelName);
}

/** GET /trust/active veya socket'te deadline boş gelirse iOS video shell açılmasın diye client fallback */
function trustSessionDeadlineIso(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (s && Number.isFinite(Date.parse(s))) return s;
  return new Date(Date.now() + 15 * 60 * 1000).toISOString();
}

export type TrustRequestModalState = {
  trustId: string;
  tagId: string;
  requesterRole: 'driver' | 'passenger';
} | null;

export type TrustVideoSessionState = {
  trustId: string;
  channelName: string;
  agoraToken: string;
  peerUserId: string;
  sessionHardDeadlineAt: string;
  peerDisplayName: string;
} | null;

export type TrustActiveTagSnapshot = {
  id?: string;
  driver_id?: string;
  passenger_id?: string;
  driver_name?: string;
  passenger_name?: string;
  status?: string;
  /** Biniş doğrulandıktan sonra aynı tag içi güven/call/chat kapısı (sunucu ile uyumlu) */
  boarding_confirmed_at?: string | null;
} | null;

export type TrustSocketHandlers = {
  onTrustSocketRequest?: (data: {
    trust_id: string;
    tag_id: string;
    requester_id: string;
    requester_role: string;
    request_ttl_expires_at?: string;
  }) => void;
  onTrustSessionReady?: (data: {
    trust_id: string;
    tag_id: string;
    channel_name: string;
    agora_token: string;
    agora_app_id?: string;
    session_hard_deadline_at?: string;
    peer_user_id: string;
  }) => void;
  onTrustSessionEnded?: (data: {
    trust_id: string;
    tag_id?: string;
    end_reason?: string;
    rejected_by?: string;
  }) => void;
};

type Options = {
  role: 'passenger' | 'driver';
  userId: string | null | undefined;
  activeTag: TrustActiveTagSnapshot;
  showCallScreen: boolean;
  incomingCallBlocked: boolean;
  /** Güven reddedildiğinde eşleşmiş yolculuk sohbetini aç */
  openChatForMatchedTrip?: () => void;
  /** Biniş sonrası: yeni güven isteği / reddedince otomatik chat açılması yok */
  boardingCommsClosed?: boolean;
};

export function useTrustSessionController({
  role,
  userId,
  activeTag,
  showCallScreen,
  incomingCallBlocked,
  openChatForMatchedTrip,
  boardingCommsClosed = false,
}: Options) {
  const roleRef = useRef(role);
  roleRef.current = role;

  const [trustRequestModal, setTrustRequestModal] = useState<TrustRequestModalState>(null);
  const [trustModalLoading, setTrustModalLoading] = useState(false);
  const [trustOutgoingPending, setTrustOutgoingPending] = useState(false);
  const [trustGuvenCooldownUntil, setTrustGuvenCooldownUntil] = useState(0);
  const [trustGuvenPressLockUntil, setTrustGuvenPressLockUntil] = useState(0);
  const lastTrustAlertKeyRef = useRef<string | null>(null);
  const [trustVideoSession, setTrustVideoSession] = useState<TrustVideoSessionState>(null);

  const trustOutgoingPendingRef = useRef(false);
  useEffect(() => {
    trustOutgoingPendingRef.current = trustOutgoingPending;
  }, [trustOutgoingPending]);

  const activeTagIdRef = useRef<string | null>(null);
  const activeTagRef = useRef(activeTag);
  const outboundTrustIdRef = useRef<string | null>(null);
  /** Güven isteği gönderildiğinde tag — active-tag geçici null olsa bile requester poll devam eder */
  const outgoingTrustTagIdRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);
  const recoveryInFlightRef = useRef(false);
  const incomingPendingRecoveryInFlightRef = useRef(false);
  const trustVideoActivePollInFlightRef = useRef(false);
  const openChatRef = useRef(openChatForMatchedTrip);
  openChatRef.current = openChatForMatchedTrip;

  const trustVideoSessionRef = useRef<TrustVideoSessionState>(null);
  const lastAppliedTrustVideoKeyRef = useRef('');
  useEffect(() => {
    trustVideoSessionRef.current = trustVideoSession;
  }, [trustVideoSession]);

  /** onTrustSessionEnded içinde setState güncellemesinden önce güvenilir trust_id eşlemesi için */
  const trustRequestModalRef = useRef<TrustRequestModalState>(null);
  useEffect(() => {
    trustRequestModalRef.current = trustRequestModal;
  }, [trustRequestModal]);

  /** P0-D — Güven Al isteği modalı görünür olunca premium video-trust tonu (foreground). */
  useEffect(() => {
    const trustId = trustRequestModal?.trustId?.trim();
    if (!trustId) return;
    offerSoundController.stopAllOfferLoops('trust_modal');
    const key = `video_trust:${trustId}`;
    if (lastTrustAlertKeyRef.current && lastTrustAlertKeyRef.current !== key) {
      stopRepeatingAlertSound(lastTrustAlertKeyRef.current, 'trust_modal_key_change');
    }
    lastTrustAlertKeyRef.current = key;
    startRepeatingAlertSound(key, () => playVideoTrustCallSoundRepeatTick(), { intervalMs: 2000 });
    return () => {
      stopRepeatingAlertSound(key, 'trust_modal_cleanup');
      if (lastTrustAlertKeyRef.current === key) {
        lastTrustAlertKeyRef.current = null;
      }
    };
  }, [trustRequestModal?.trustId]);

  const trustTagRetryTimerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTrustTagRetryTimers = useCallback(() => {
    trustTagRetryTimerIdsRef.current.forEach((timerId) => clearTimeout(timerId));
    trustTagRetryTimerIdsRef.current = [];
  }, []);

  const stopTrustRepeatAlerts = useCallback((trustId?: string | null, reason?: string) => {
    const tid =
      normTrustId(trustId) ||
      normTrustId(trustRequestModalRef.current?.trustId) ||
      normTrustId(outboundTrustIdRef.current);
    if (tid) {
      const key = `video_trust:${tid}`;
      stopRepeatingAlertSound(key, reason ?? 'trust_repeat_stop');
      if (lastTrustAlertKeyRef.current === key) {
        lastTrustAlertKeyRef.current = null;
      }
      try {
        perfLog('TRUST_REPEAT_STOP', JSON.stringify({ key, reason: reason ?? null }));
      } catch {
        /* noop */
      }
    }
    stopAllRepeatingAlertSounds('trust_terminal');
    void stopVideoTrustCachedPlayback();
  }, []);

  const startTrustTerminalCooldown = useCallback(() => {
    const until = Date.now() + TRUST_TERMINAL_COOLDOWN_MS;
    setTrustGuvenCooldownUntil(until);
    const timerId = setTimeout(() => {
      setTrustGuvenCooldownUntil((prev) => (prev === until ? 0 : prev));
    }, TRUST_TERMINAL_COOLDOWN_MS + 32);
    trustTagRetryTimerIdsRef.current.push(timerId);
  }, []);

  const finalizeTrustTerminal = useCallback(
    (source: string, opts?: { trustId?: string | null; skipCooldown?: boolean }) => {
      stopTrustRepeatAlerts(opts?.trustId ?? null, source);
      clearTrustTagRetryTimers();
      outboundTrustIdRef.current = null;
      outgoingTrustTagIdRef.current = null;
      sendInFlightRef.current = false;
      deferredTrustRequestRef.current = null;
      lastAppliedTrustVideoKeyRef.current = '';
      setTrustOutgoingPending(false);
      setTrustRequestModal(null);
      setTrustModalLoading(false);
      if (!opts?.skipCooldown) {
        startTrustTerminalCooldown();
      }
      try {
        perfLog(
          'TRUST_FREEZE_GUARD_CLEAR',
          JSON.stringify({
            source,
            trust_id: normTrustId(opts?.trustId) || null,
          }),
        );
      } catch {
        /* noop */
      }
    },
    [clearTrustTagRetryTimers, startTrustTerminalCooldown, stopTrustRepeatAlerts],
  );

  const prepTrustNewRequest = useCallback(() => {
    stopTrustRepeatAlerts(null, 'before_new_request');
    clearTrustTagRetryTimers();
    outboundTrustIdRef.current = null;
    sendInFlightRef.current = false;
    deferredTrustRequestRef.current = null;
    setTrustRequestModal(null);
    setTrustModalLoading(false);
    setTrustOutgoingPending(false);
    try {
      perfLog('TRUST_SECOND_REQUEST_GUARD', JSON.stringify({ action: 'prep_clear' }));
    } catch {
      /* noop */
    }
  }, [clearTrustTagRetryTimers, stopTrustRepeatAlerts]);

  const scheduleTrustTagRetry = useCallback((fn: () => void, attempt: number) => {
    const delay = TRUST_TAG_RETRY_BASE_MS + Math.min(attempt * 45, 420);
    const timerId = setTimeout(() => {
      trustTagRetryTimerIdsRef.current = trustTagRetryTimerIdsRef.current.filter((t) => t !== timerId);
      fn();
    }, delay);
    trustTagRetryTimerIdsRef.current.push(timerId);
  }, []);

  /** Arama / gelen arama UI açıkken gelen trust_request tek seferlik saklanır; blok kalkınca modal gösterilir. */
  const deferredTrustRequestRef = useRef<{
    trustId: string;
    tagId: string;
    requesterRole: 'driver' | 'passenger';
  } | null>(null);

  const blockStateRef = useRef({
    showCallScreen,
    incomingCallBlocked,
    trustVideo: false as boolean,
  });
  blockStateRef.current = {
    showCallScreen,
    incomingCallBlocked,
    trustVideo: !!trustVideoSession,
  };

  useEffect(() => {
    const nextId = activeTag?.id ? String(activeTag.id).trim() : '';
    const trustLive =
      trustOutgoingPendingRef.current ||
      !!trustVideoSessionRef.current ||
      !!trustRequestModalRef.current;
    if (!nextId && trustLive && activeTagIdRef.current) {
      try {
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_ACTIVE_TAG_REF_HELD',
            held_tag_id: activeTagIdRef.current,
            role,
          }),
        );
      } catch {
        /* noop */
      }
      if (activeTag) {
        activeTagRef.current = activeTag;
      }
      return;
    }
    activeTagIdRef.current = nextId || null;
    activeTagRef.current = activeTag;
    if (nextId) {
      outgoingTrustTagIdRef.current = nextId;
    }
  }, [activeTag?.id, activeTag, role]);

  const clearAllTrustState = useCallback(() => {
    finalizeTrustTerminal('clear_all_trust_state', { skipCooldown: true });
    setTrustVideoSession(null);
  }, [finalizeTrustTerminal]);

  const openTrustVideoSession = useCallback(
    (payload: NonNullable<TrustVideoSessionState>, source: string): boolean => {
      const trustId = String(payload.trustId ?? '').trim();
      const ch = String(payload.channelName ?? '').trim();
      if (!trustId || !ch) return false;

      const key = trustVideoSessionKey(trustId, ch);
      const cur = trustVideoSessionRef.current;
      if (cur && isDuplicateTrustVideoSession(cur, trustId, ch)) {
        try {
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_VIDEO_SESSION_DUPLICATE_SKIP',
              source,
              trust_id: trustId,
              channel_name: ch,
            }),
          );
        } catch {
          /* noop */
        }
        return false;
      }
      if (lastAppliedTrustVideoKeyRef.current === key) {
        try {
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_VIDEO_SESSION_DUPLICATE_SKIP',
              source,
              reason: 'last_applied_key',
              trust_id: trustId,
              channel_name: ch,
            }),
          );
        } catch {
          /* noop */
        }
        return false;
      }

      trustCallPerf('TRUST_CALL_TOKEN_BEGIN', {
        role: roleRef.current,
        tag_id: activeTagIdRef.current,
        request_id: trustId,
        source,
      });

      lastAppliedTrustVideoKeyRef.current = key;
      setTrustVideoSession((prev) => {
        if (prev && isDuplicateTrustVideoSession(prev, trustId, ch)) {
          return prev;
        }
        return payload;
      });
      trustCallPerf('TRUST_CALL_TOKEN_READY', {
        role: roleRef.current,
        tag_id: activeTagIdRef.current,
        request_id: trustId,
        source,
      });
      return true;
    },
    [],
  );

  useEffect(() => {
    if (activeTag?.id) return;
    const hasLiveTrustUi =
      trustOutgoingPendingRef.current ||
      !!trustVideoSessionRef.current ||
      !!trustRequestModalRef.current ||
      trustModalLoading;
    if (hasLiveTrustUi) {
      try {
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_CLEAR_SKIP_ACTIVE_TAG_NULL',
            role,
            trust_outgoing_pending: trustOutgoingPendingRef.current,
            trust_video_active: !!trustVideoSessionRef.current,
            trust_modal_active: !!trustRequestModalRef.current,
          }),
        );
      } catch {
        /* noop */
      }
      return;
    }
    clearAllTrustState();
  }, [activeTag?.id, clearAllTrustState, role, trustModalLoading]);

  useEffect(() => {
    if (boardingCommsClosed) {
      deferredTrustRequestRef.current = null;
    }
  }, [boardingCommsClosed]);

  const trustGuvenCooldownActive = trustGuvenCooldownUntil > Date.now();
  const trustGuvenPressLocked = trustGuvenPressLockUntil > Date.now();

  const trustGuvenButtonDisabled =
    trustOutgoingPending ||
    trustModalLoading ||
    !!trustVideoSession ||
    !!trustRequestModal ||
    trustGuvenCooldownActive ||
    trustGuvenPressLocked;

  const trustGuvenBlockReason = useMemo((): TrustGuvenBlockReason | null => {
    if (boardingCommsClosed) return 'boarding_confirmed';
    if (trustVideoSession) return 'trust_video_active';
    if (trustRequestModal) return 'incoming_modal_open';
    if (trustModalLoading) return 'trust_modal_loading';
    if (trustOutgoingPending) return 'trust_pending';
    if (trustGuvenCooldownActive || trustGuvenPressLocked) return 'trust_pending';
    if (showCallScreen || incomingCallBlocked) return 'call_screen_active';
    const uid = userId?.trim();
    const tagId = activeTag?.id ? String(activeTag.id) : '';
    if (!uid || !tagId) return 'no_active_tag';
    return null;
  }, [
    boardingCommsClosed,
    trustVideoSession,
    trustRequestModal,
    trustModalLoading,
    trustOutgoingPending,
    trustGuvenCooldownActive,
    trustGuvenPressLocked,
    showCallScreen,
    incomingCallBlocked,
    userId,
    activeTag?.id,
  ]);

  /**
   * Sesli arama yalnızca Agora güven görüşmesi kanalına gerçekten katılımda engellenir.
   * Bekleyen güven isteği / modal — klasik sesli aramayı bloke etmez (ayrı token/kanal).
   */
  const isTrustBlockingCalls = !!trustVideoSession;

  const peerDisplayNameForPeerId = useCallback(
    (peer: string) => {
      const tagSnap = activeTagRef.current;
      const p = String(peer ?? '').trim().toLowerCase();
      if (role === 'passenger') {
        const drv = String(tagSnap?.driver_id ?? '').trim().toLowerCase();
        return p === drv
          ? displayFirstName(tagSnap?.driver_name, 'Sürücü')
          : displayFirstName(tagSnap?.passenger_name, 'Yolcu');
      }
      const pax = String(tagSnap?.passenger_id ?? '').trim().toLowerCase();
      return p === pax
        ? displayFirstName(tagSnap?.passenger_name, 'Yolcu')
        : displayFirstName(tagSnap?.driver_name, 'Sürücü');
    },
    [role],
  );

  /** accepted satırından video shell — requester poll / recovery / socket fallback ortak */
  const applyAcceptedTrustVideoFromRow = useCallback(
    (s: TrustActiveSessionRow, source: string): boolean => {
      const trustId = String(s.id ?? '').trim();
      const ch = String(s.channel_name ?? '').trim();
      const tok = String(s.recovery_agora_token ?? s.agora_token ?? '').trim();
      const peer = String(s.recovery_peer_user_id ?? s.peer_user_id ?? '').trim();
      if (!trustId || !ch || !tok || !peer) return false;
      if (showCallScreen || incomingCallBlocked) return false;

      const curVid = trustVideoSessionRef.current;
      if (curVid) {
        if (isDuplicateTrustVideoSession(curVid, trustId, ch)) return false;
        return false;
      }

      outboundTrustIdRef.current = null;
      setTrustOutgoingPending(false);
      setTrustRequestModal(null);
      setTrustModalLoading(false);
      trustCallPerf('TRUST_CALL_ACCEPT_SEEN', {
        role: roleRef.current,
        tag_id: String(s.tag_id ?? activeTagIdRef.current ?? ''),
        request_id: trustId,
        source,
      });
      return openTrustVideoSession(
        {
          trustId,
          channelName: ch,
          agoraToken: tok,
          peerUserId: peer,
          sessionHardDeadlineAt: trustSessionDeadlineIso(s.session_hard_deadline_at),
          peerDisplayName: peerDisplayNameForPeerId(peer),
        },
        source,
      );
    },
    [
      showCallScreen,
      incomingCallBlocked,
      peerDisplayNameForPeerId,
      openTrustVideoSession,
    ],
  );

  /** Socket kaçınca / tag geç hydrate: GET /trust/active ile pending + ben target_id isem modal (veya defer). */
  const recoverIncomingPendingTrust = useCallback(
    async (opts: { source: string; tagIdOverride?: string | null }) => {
      const uidRaw = userId?.trim();
      const tagFromRef = activeTagIdRef.current?.trim() || '';
      const tagForQuery = (opts.tagIdOverride?.trim() || tagFromRef || '').trim();
      if (!uidRaw || !tagForQuery) {
        try {
          console.log(
            'TRUST_PENDING_RECOVERY_SKIP',
            JSON.stringify({ source: opts.source, reason: 'missing_tag_or_user' }),
          );
        } catch {
          /* noop */
        }
        return;
      }
      if (boardingCommsClosed) {
        try {
          console.log(
            'TRUST_PENDING_RECOVERY_SKIP',
            JSON.stringify({ source: opts.source, reason: 'boarding_comms_closed_prop' }),
          );
        } catch {
          /* noop */
        }
        return;
      }
      if (incomingPendingRecoveryInFlightRef.current) {
        try {
          console.log(
            'TRUST_PENDING_RECOVERY_SKIP',
            JSON.stringify({ source: opts.source, reason: 'already_in_flight' }),
          );
        } catch {
          /* noop */
        }
        return;
      }
      if (trustVideoSessionRef.current) {
        try {
          console.log(
            'TRUST_PENDING_RECOVERY_SKIP',
            JSON.stringify({ source: opts.source, reason: 'trust_video_active' }),
          );
        } catch {
          /* noop */
        }
        return;
      }

      const uidLo = normTrustId(uidRaw);
      try {
        console.log(
          'TRUST_PENDING_RECOVERY_CHECK',
          JSON.stringify({
            source: opts.source,
            tag_for_query: tagForQuery,
            role,
            has_tag_override: !!opts.tagIdOverride?.trim(),
          }),
        );
      } catch {
        /* noop */
      }

      incomingPendingRecoveryInFlightRef.current = true;
      try {
        const requestedTag = tagForQuery.toLowerCase();
        const r = await getTrustActive(tagForQuery);

        if (trustVideoSessionRef.current) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({ source: opts.source, reason: 'trust_video_race_after_fetch' }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        if (!r?.success || !r.session) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({ source: opts.source, reason: 'no_session' }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const s = r.session as TrustActiveSessionRow;
        const rowTagLo = normTrustId(s.tag_id ?? '');
        if (!rowTagLo || rowTagLo !== requestedTag) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({
                source: opts.source,
                reason: 'session_tag_mismatch',
                row_tag: rowTagLo || null,
                requested: requestedTag,
              }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const curAfter = activeTagIdRef.current?.trim().toLowerCase() || '';
        if (!opts.tagIdOverride?.trim()) {
          if (curAfter !== requestedTag) {
            try {
              console.log(
                'TRUST_PENDING_RECOVERY_SKIP',
                JSON.stringify({
                  source: opts.source,
                  reason: 'active_tag_changed_during_fetch',
                  curAfter: curAfter || null,
                  requested: requestedTag,
                }),
              );
            } catch {
              /* noop */
            }
            return;
          }
        } else if (curAfter && curAfter !== rowTagLo) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({
                source: opts.source,
                reason: 'active_tag_mismatch_after_fetch_override',
                curAfter,
                rowTagLo,
              }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const st = String(s.status ?? '').trim().toLowerCase();
        if (st !== 'pending') {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({ source: opts.source, reason: 'not_pending', status: st || null }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const targetLo = normTrustId(s.target_id);
        if (!targetLo || targetLo !== uidLo) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({ source: opts.source, reason: 'not_target' }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const trustId = String(s.id ?? '').trim();
        if (!trustId) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({ source: opts.source, reason: 'missing_trust_id' }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        if (normTrustId(trustRequestModalRef.current?.trustId) === normTrustId(trustId)) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({ source: opts.source, reason: 'modal_already_same_trust', trust_id: trustId }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        if (activeTagRef.current?.boarding_confirmed_at) {
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_SKIP',
              JSON.stringify({
                source: opts.source,
                reason: 'boarding_confirmed_local',
                trust_id: trustId,
              }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const rr =
          String(s.requester_role ?? '').trim().toLowerCase() === 'driver' ? 'driver' : 'passenger';
        const modalTag = String(s.tag_id ?? tagForQuery).trim();

        const stBlock = blockStateRef.current;
        if (stBlock.showCallScreen || stBlock.incomingCallBlocked || stBlock.trustVideo) {
          deferredTrustRequestRef.current = {
            trustId,
            tagId: modalTag,
            requesterRole: rr,
          };
          try {
            console.log(
              'TRUST_PENDING_RECOVERY_HIT',
              JSON.stringify({
                source: opts.source,
                action: 'deferred',
                trust_id: trustId,
                tag_id: modalTag,
              }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        deferredTrustRequestRef.current = null;
        try {
          console.log(
            'TRUST_PENDING_RECOVERY_HIT',
            JSON.stringify({
              source: opts.source,
              action: 'modal',
              trust_id: trustId,
              tag_id: modalTag,
            }),
          );
        } catch {
          /* noop */
        }
        trustCallPerf('TRUST_CALL_SOCKET_RECEIVED', {
          role: roleRef.current,
          tag_id: modalTag,
          request_id: trustId,
          source: opts.source,
        });
        setTrustRequestModal({
          trustId,
          tagId: modalTag,
          requesterRole: rr,
        });
      } finally {
        incomingPendingRecoveryInFlightRef.current = false;
      }
    },
    [userId, boardingCommsClosed, role],
  );

  const tryRecoverAcceptedSession = useCallback(async () => {
    const uid = userId?.trim();
    const tid =
      activeTagIdRef.current?.trim() || outgoingTrustTagIdRef.current?.trim() || '';
    if (!uid || !tid) return;
    if (trustVideoSessionRef.current) return;
    if (showCallScreen || incomingCallBlocked) return;
    if (recoveryInFlightRef.current) return;
    recoveryInFlightRef.current = true;
    try {
      const requestedTag = tid.toLowerCase();
      const r = await getTrustActive(tid);
      const curSnap = String(activeTagIdRef.current ?? '').trim().toLowerCase();
      if (curSnap && curSnap !== requestedTag) return;
      if (!r?.success || !r.session) return;
      const s = r.session as TrustActiveSessionRow;
      if (String(s.status || '') !== 'accepted') return;
      const rowTag = String(s.tag_id ?? '').trim().toLowerCase();
      if (rowTag !== requestedTag) return;
      applyAcceptedTrustVideoFromRow(s, 'try_recover_accepted_session');
    } finally {
      recoveryInFlightRef.current = false;
    }
  }, [userId, showCallScreen, incomingCallBlocked, applyAcceptedTrustVideoFromRow]);

  /**
   * Socket trust_session_ready tag eşleşmediğinde veya event kaçtığında: event'teki tag_id ile GET /trust/active.
   * activeTag ref henüz güncellenmemiş olsa bile kabul edilmiş oturumu açar (yanlış tag için active_tag_mismatch_after_fetch ile iptal).
   */
  const recoverTrustVideoByTagId = useCallback(
    async (tagIdForQuery: string, reason: string) => {
      const tid = String(tagIdForQuery ?? '').trim().toLowerCase();
      const uid = userId?.trim();
      if (!tid || !uid) return;
      if (showCallScreen || incomingCallBlocked) return;
      if (recoveryInFlightRef.current) return;
      recoveryInFlightRef.current = true;
      try {
        console.log(
          'TRUST_RECOVERY_BY_TAG',
          JSON.stringify({ reason, tag_id: tid, role }),
        );
        const r = await getTrustActive(String(tagIdForQuery).trim());
        const curSnap = String(activeTagIdRef.current ?? '').trim().toLowerCase();
        if (curSnap && curSnap !== tid) {
          console.log(
            'TRUST_RECOVERY_BY_TAG_ABORT',
            JSON.stringify({ reason: 'active_tag_mismatch_after_fetch', curSnap, tid }),
          );
          return;
        }
        if (!r?.success || !r.session) return;
        const s = r.session as TrustActiveSessionRow;
        if (String(s.status || '') !== 'accepted') return;
        const rowTag = String(s.tag_id ?? '').trim().toLowerCase();
        if (rowTag !== tid) return;
        const opened = applyAcceptedTrustVideoFromRow(s, reason);
        if (opened) {
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_READY_RECOVERY_APPLIED',
              reason,
              trust_id: String(s.id ?? ''),
              tag_id: tid,
            }),
          );
        }
      } finally {
        recoveryInFlightRef.current = false;
      }
    },
    [userId, showCallScreen, incomingCallBlocked, role, applyAcceptedTrustVideoFromRow],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void tryRecoverAcceptedSession();
        void recoverIncomingPendingTrust({ source: 'app_foreground' });
      }
    });
    return () => sub.remove();
  }, [tryRecoverAcceptedSession, recoverIncomingPendingTrust]);

  useEffect(() => {
    const tid = activeTag?.id ? String(activeTag.id).trim() : '';
    if (!tid || !userId?.trim()) return;
    const t = setTimeout(
      () => void recoverIncomingPendingTrust({ source: 'active_tag_changed' }),
      ACTIVE_TAG_INCOMING_RECOVERY_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [activeTag?.id, userId, recoverIncomingPendingTrust]);

  useEffect(() => {
    const tid = activeTag?.id ? String(activeTag.id).trim() : '';
    const uid = userId?.trim();
    if (!tid || !uid) return;
    if (boardingCommsClosed) return;

    const id = setInterval(
      () => void recoverIncomingPendingTrust({ source: 'incoming_pending_tick' }),
      INCOMING_PENDING_TRUST_RECOVERY_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [activeTag?.id, userId, boardingCommsClosed, recoverIncomingPendingTrust]);

  useEffect(() => {
    if (activeTag?.id && String(activeTag.status || '') === 'matched') {
      const t = setTimeout(() => void tryRecoverAcceptedSession(), 600);
      return () => clearTimeout(t);
    }
  }, [activeTag?.id, activeTag?.status, tryRecoverAcceptedSession]);

  const recoverTrustVideoByTagIdRef = useRef(recoverTrustVideoByTagId);
  recoverTrustVideoByTagIdRef.current = recoverTrustVideoByTagId;

  /**
   * Outgoing requester: karşı taraf kabul edince sunucu trust_session_ready yayınlar; socket kaçarsa
   * yalnızca AppState / tek seferlik recover yetmez. Bu interval ile aynı tag için accepted + token
   * gelene kadar GET /trust/active tekrarlanır (recoverTrustVideoByTagId ile aynı güvenlik kontrolleri).
   */
  useEffect(() => {
    if (!trustOutgoingPending) return;
    const uid = userId?.trim();
    const tid =
      (activeTag?.id ? String(activeTag.id).trim() : '') ||
      outgoingTrustTagIdRef.current?.trim() ||
      '';
    if (!uid || !tid) return;

    let cancelled = false;
    const t0 = Date.now();

    const tick = async () => {
      if (cancelled) return;
      if (!trustOutgoingPendingRef.current) return;
      if (trustVideoSessionRef.current) return;
      if (Date.now() - t0 > REQUESTER_TRUST_POLL_MAX_MS) {
        outboundTrustIdRef.current = null;
        setTrustOutgoingPending(false);
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_REQUESTER_POLL_MAX_MS',
            tag_id: tid,
            role,
            action: 'clear_outgoing_pending',
          }),
        );
        appAlert('Güven', 'Yanıt alınamadı. Tekrar deneyebilirsiniz.', [{ text: 'Tamam' }], {
          variant: 'info',
          autoDismissMs: 3200,
          cancelable: true,
        });
        return;
      }
      const bs = blockStateRef.current;
      if (bs.showCallScreen || bs.incomingCallBlocked) return;

      const tagLo = tid.toLowerCase();
      if (String(activeTagIdRef.current ?? '').trim().toLowerCase() !== tagLo) return;

      try {
        const r = await getTrustActive(tid);
        if (cancelled || !trustOutgoingPendingRef.current || trustVideoSessionRef.current) return;
        if (String(activeTagIdRef.current ?? '').trim().toLowerCase() !== tagLo) return;
        if (!r) return;

        if (!r.success || !r.session) {
          try {
            console.log(
              '[TRUST]',
              JSON.stringify({
                evt: 'TRUST_REQUESTER_POLL_NO_SESSION_YET',
                source: 'requester_outgoing_poll',
                success: r?.success ?? null,
                has_session: !!r?.session,
                tag_id: tid,
                role,
              }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const s = r.session as TrustActiveSessionRow;
        const rowTagLo = normTrustId(s.tag_id ?? '');
        if (rowTagLo && rowTagLo !== tagLo) return;

        const st = String(s.status ?? '').trim().toLowerCase();
        if (st === 'accepted') {
          const opened = applyAcceptedTrustVideoFromRow(s, 'requester_outgoing_poll');
          if (opened) {
            try {
              console.log(
                '[TRUST]',
                JSON.stringify({
                  evt: 'TRUST_REQUESTER_POLL_OPENED',
                  tag_id: tid,
                  role,
                  trust_id: String(s.id ?? ''),
                }),
              );
            } catch {
              /* noop */
            }
          } else {
            await recoverTrustVideoByTagIdRef.current(tid, 'requester_outgoing_poll_fallback');
          }
          return;
        }
        if (st === 'pending') return;

        const terminalTrustId = String(s.id ?? outboundTrustIdRef.current ?? '').trim();
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_OUTGOING_PENDING_CLEAR',
            source: 'requester_outgoing_poll',
            reason: st || 'terminal_status',
            tag_id: tid,
            role,
          }),
        );
        if (st === 'rejected') {
          appAlert('Güven isteği', 'Karşı taraf şu an müsait değil.', [{ text: 'Tamam' }], {
            variant: 'info',
            autoDismissMs: 2600,
            cancelable: true,
          });
          if (!activeTagRef.current?.boarding_confirmed_at) {
            setTimeout(() => {
              openChatRef.current?.();
            }, 150);
          }
        }
        finalizeTrustTerminal('requester_outgoing_poll_terminal', {
          trustId: terminalTrustId || null,
        });
      } catch {
        /* noop — sonraki tick tekrar dener */
      }
    };

    const id = setInterval(() => void tick(), REQUESTER_TRUST_POLL_INTERVAL_MS);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trustOutgoingPending, activeTag?.id, userId, role, applyAcceptedTrustVideoFromRow, finalizeTrustTerminal]);

  useEffect(() => {
    if (!trustOutgoingPending) return;
    void tryRecoverAcceptedSession();
  }, [trustOutgoingPending, tryRecoverAcceptedSession]);

  /**
   * Güven görüşmesi açıkken: socket `trust_session_ended` kaçsa bile sunucudaki aktif oturumu periyodik doğrular.
   * Aktif kayıt yoksa veya mevcut `trust_id` / accepted durumu ile uyuşmuyorsa video state'i kapatır (socket ile aynı setter).
   */
  useEffect(() => {
    if (!trustVideoSession?.trustId) return;
    const tagId = activeTag?.id ? String(activeTag.id).trim() : '';
    if (!tagId) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const vid = trustVideoSessionRef.current;
      if (!vid?.trustId) return;
      const pollTrustId = normTrustId(vid.trustId);
      const tagForQuery = String(activeTagIdRef.current ?? '').trim();
      if (!tagForQuery || tagForQuery.toLowerCase() !== tagId.toLowerCase()) return;
      if (trustVideoActivePollInFlightRef.current) return;
      trustVideoActivePollInFlightRef.current = true;
      try {
        const r = await getTrustActive(tagForQuery);
        if (cancelled) return;
        if (
          String(activeTagIdRef.current ?? '').trim().toLowerCase() !== tagForQuery.toLowerCase()
        ) {
          return;
        }
        const stillVid = trustVideoSessionRef.current;
        if (!stillVid || normTrustId(stillVid.trustId) !== pollTrustId) return;

        if (!r || r.success === false) {
          return;
        }

        const s = r.session as TrustActiveSessionRow | null | undefined;
        if (!s) {
          lastAppliedTrustVideoKeyRef.current = '';
          setTrustVideoSession((prev) =>
            prev && normTrustId(prev.trustId) === pollTrustId ? null : prev,
          );
          console.log(
            '[TRUST]',
            JSON.stringify({ evt: 'TRUST_VIDEO_ACTIVE_POLL', action: 'close', reason: 'no_session' }),
          );
          return;
        }

        const sid = normTrustId(s.id);
        const st = String(s.status ?? '').trim().toLowerCase();
        if (sid !== pollTrustId || st !== 'accepted') {
          lastAppliedTrustVideoKeyRef.current = '';
          setTrustVideoSession((prev) =>
            prev && normTrustId(prev.trustId) === pollTrustId ? null : prev,
          );
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_VIDEO_ACTIVE_POLL',
              action: 'close',
              reason: sid !== pollTrustId ? 'trust_id_mismatch' : 'status_not_accepted',
              server_trust_id: sid || null,
              server_status: st || null,
            }),
          );
        }
      } finally {
        trustVideoActivePollInFlightRef.current = false;
      }
    };

    const id = setInterval(() => void tick(), TRUST_VIDEO_ACTIVE_POLL_MS);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trustVideoSession?.trustId, activeTag?.id]);

  useEffect(() => {
    if (showCallScreen || incomingCallBlocked || !!trustVideoSession) {
      return;
    }
    const d = deferredTrustRequestRef.current;
    if (!d?.trustId) {
      return;
    }
    const cur = String(activeTagIdRef.current ?? '').trim();
    if (!cur || d.tagId.toLowerCase() !== cur.toLowerCase()) {
      deferredTrustRequestRef.current = null;
      return;
    }
    deferredTrustRequestRef.current = null;
    console.log(
      'TRUST_REQUEST_SHOWN_FROM_DEFERRED',
      JSON.stringify({ trust_id: d.trustId, tag_id: d.tagId }),
    );
    trustCallPerf('TRUST_CALL_SOCKET_RECEIVED', {
      role: roleRef.current,
      tag_id: d.tagId,
      request_id: d.trustId,
      source: 'deferred_ui',
    });
    setTrustRequestModal({
      trustId: d.trustId,
      tagId: d.tagId,
      requesterRole: d.requesterRole,
    });
  }, [showCallScreen, incomingCallBlocked, trustVideoSession]);

  const sendTrustRequest = useCallback(async () => {
    const uid = userId?.trim();
    const tagId = activeTag?.id ? String(activeTag.id) : '';
    if (!uid || !tagId) {
      appAlert('Hata', 'Yolculuk bilgisi bulunamadı');
      return;
    }
    if (Date.now() < trustGuvenPressLockUntil) {
      try {
        perfLog('TRUST_SECOND_REQUEST_GUARD', JSON.stringify({ action: 'press_debounce_skip' }));
      } catch {
        /* noop */
      }
      return;
    }
    if (trustGuvenCooldownUntil > Date.now()) {
      try {
        perfLog('TRUST_SECOND_REQUEST_GUARD', JSON.stringify({ action: 'terminal_cooldown_skip' }));
      } catch {
        /* noop */
      }
      return;
    }
    if (sendInFlightRef.current || trustOutgoingPending) {
      try {
        perfLog(
          'TRUST_GUVEN_SEND_SKIP',
          JSON.stringify({
            reason: sendInFlightRef.current ? 'send_in_flight' : 'trust_pending',
          }),
        );
      } catch {
        /* noop */
      }
      return;
    }
    if (boardingCommsClosed) {
      appAlert('Bilgi', BOARDING_COMMS_CLOSED_USER_MSG, [], {
        variant: 'info',
        autoDismissMs: 3200,
        cancelable: true,
      });
      return;
    }
    if (showCallScreen || incomingCallBlocked) {
      appAlert('Uyarı', 'Önce devam eden aramayı sonlandırın.');
      return;
    }
    if (trustRequestModal || trustVideoSession) {
      appAlert('Uyarı', 'Güven isteği zaten sürüyor.');
      return;
    }
    prepTrustNewRequest();
    const pressLockUntil = Date.now() + TRUST_GUVEN_PRESS_DEBOUNCE_MS;
    setTrustGuvenPressLockUntil(pressLockUntil);
    setTimeout(() => {
      setTrustGuvenPressLockUntil((prev) => (prev === pressLockUntil ? 0 : prev));
    }, TRUST_GUVEN_PRESS_DEBOUNCE_MS + 32);
    sendInFlightRef.current = true;
    setTrustOutgoingPending(true);
    outgoingTrustTagIdRef.current = tagId;
    trustCallPerf('TRUST_CALL_REQUEST_START', {
      role: roleRef.current,
      tag_id: tagId,
    });
    try {
      const res = await postTrustRequest(tagId);
      if (!res?.success) {
        setTrustOutgoingPending(false);
        const err = String(res?.error ?? 'İstek gönderilemedi');
        const det = String((res as { detail?: unknown }).detail ?? '');
        if (err === BOARDING_COMM_CLOSED_CODE || det === BOARDING_COMM_CLOSED_CODE) {
          appAlert('Bilgi', BOARDING_COMMS_CLOSED_USER_MSG, [], {
            variant: 'info',
            autoDismissMs: 3200,
            cancelable: true,
          });
          return;
        }
        if (err === 'trust_already_active') {
          console.log(
            'TRUST_DIAG_SEND_TRUST_ALREADY_ACTIVE',
            JSON.stringify({
              activeTagId: tagId,
              outboundTrustIdRef: outboundTrustIdRef.current,
              trustOutgoingPending,
            }),
          );
          appAlert('Güven', 'Bu yolculukta zaten aktif bir güven isteği var.');
        } else if (err === 'trust_race_lost') {
          console.log(
            'TRUST_DIAG_SEND_TRUST_RACE_LOST',
            JSON.stringify({ activeTagId: tagId }),
          );
          appAlert(
            'Güven',
            'Karşı taraf güven isteğini bir an önce gönderdi. Yineleyebilir veya karşı tarafın isteğini bekleyebilirsiniz.',
            [{ text: 'Tamam' }],
            { variant: 'info' },
          );
        } else {
          appAlert('Hata', err);
        }
        return;
      }
      if (res.trust_id) {
        outboundTrustIdRef.current = String(res.trust_id);
        linkTrustCallPerfMark(tagId, String(res.trust_id));
      }
      trustCallPerf('TRUST_CALL_REQUEST_SENT', {
        role: roleRef.current,
        tag_id: tagId,
        request_id: res.trust_id ?? null,
      });
      trustCallPerf('TRUST_CALL_REQUEST_ACK', {
        role: roleRef.current,
        tag_id: tagId,
        request_id: res.trust_id ?? null,
      });
      appAlert('Gönderildi', 'Karşı tarafın yanıtı bekleniyor.', [{ text: 'Tamam' }], { variant: 'info' });
    } finally {
      sendInFlightRef.current = false;
    }
  }, [
    userId,
    activeTag,
    trustOutgoingPending,
    trustVideoSession,
    incomingCallBlocked,
    showCallScreen,
    trustRequestModal,
    boardingCommsClosed,
    prepTrustNewRequest,
    trustGuvenCooldownUntil,
    trustGuvenPressLockUntil,
  ]);

  const respondTrust = useCallback(
    async (accept: boolean) => {
      if (!trustRequestModal?.trustId) return;
      const trustId = trustRequestModal.trustId;
      const tagIdForRecovery = String(
        trustRequestModal.tagId ?? activeTagIdRef.current ?? '',
      ).trim();
      if (accept) {
        trustCallPerf('TRUST_CALL_ACCEPT_PRESS', {
          role: roleRef.current,
          tag_id: tagIdForRecovery,
          request_id: trustId,
        });
      } else {
        stopTrustRepeatAlerts(trustId, 'respond_reject_press');
      }
      setTrustModalLoading(true);
      const res = await postTrustRespond(trustId, accept);
      setTrustModalLoading(false);
      if (!res?.success) {
        finalizeTrustTerminal('respond_error', { trustId });
        appAlert('Hata', String(res?.error ?? 'Yanıt gönderilemedi'));
        return;
      }
      if (!accept) {
        finalizeTrustTerminal('respond_reject', { trustId });
        return;
      }
      setTrustRequestModal(null);
      /**
       * Kabul eden taraf güven kanalına yalnızca `trust_session_ready` socket’i ile giriyordu;
       * event kaçarsa karşı taraf bağlı kalıp bu taraf beklemeye düşebiliyordu.
       * Sunucu zaten iki tarafa da aynı channel + token yayınlıyor — GET /trust/active ile hydrate et.
       */
      if (!accept || !tagIdForRecovery) return;

      const bootstrapAfterAccept = async () => {
        const staggerMs = [0, 240, 520, 1100];
        for (let i = 0; i < staggerMs.length; i++) {
          if (staggerMs[i] > 0) {
            await new Promise((r) => setTimeout(r, staggerMs[i]! - staggerMs[i - 1]!));
          }
          if (trustVideoSessionRef.current) return;
          await recoverTrustVideoByTagId(tagIdForRecovery, `respond_accept_try_${i}`);
          if (trustVideoSessionRef.current) return;
        }
      };
      void bootstrapAfterAccept();
    },
    [trustRequestModal, recoverTrustVideoByTagId, finalizeTrustTerminal, stopTrustRepeatAlerts],
  );

  const processTrustSocketRequestInternal = useCallback(
    (
      data: {
        trust_id?: string;
        tag_id?: string;
        requester_id?: string;
        requester_role?: string;
        request_ttl_expires_at?: string;
      },
      attempt: number,
    ) => {
      const tid = String(data?.tag_id ?? '').trim();
      const cur = String(activeTagIdRef.current ?? '').trim();
      const st = blockStateRef.current;
      console.log(
        'TRUST_DIAG_TRUST_REQUEST_HANDLER',
        JSON.stringify({
          role,
          attempt,
          data_tag_id: tid || null,
          activeTagIdRef: cur || null,
          showCallScreen: st.showCallScreen,
          incomingCallBlocked: st.incomingCallBlocked,
          trustVideoSession_active: st.trustVideo,
        }),
      );

      if (!tid) {
        console.log(
          'TRUST_DIAG_MODAL_SKIP',
          JSON.stringify({ reason: 'MISSING_TAG_ID', role, attempt }),
        );
        return;
      }

      if (!cur || tid.toLowerCase() !== cur.toLowerCase()) {
        if (attempt < MAX_TRUST_TAG_RETRY_ATTEMPTS) {
          console.log(
            'TRUST_REQUEST_TAG_RETRY_SCHEDULED',
            JSON.stringify({
              attempt,
              role,
              data_tag_id: tid,
              activeTagIdRef: cur || null,
            }),
          );
          scheduleTrustTagRetry(() => processTrustSocketRequestInternal(data, attempt + 1), attempt);
        } else {
          console.log(
            'TRUST_REQUEST_RETRY_EXHAUSTED',
            JSON.stringify({
              role,
              data_tag_id: tid,
              activeTagIdRef: cur || null,
            }),
          );
          try {
            console.log(
              'TRUST_REQUEST_RETRY_RECOVERY',
              JSON.stringify({ role, data_tag_id: tid, activeTagIdRef: cur || null }),
            );
          } catch {
            /* noop */
          }
          void recoverIncomingPendingTrust({
            source: 'TRUST_REQUEST_RETRY_RECOVERY',
            tagIdOverride: tid,
          });
        }
        return;
      }

      trustCallPerf('TRUST_CALL_SOCKET_RECEIVED', {
        role,
        tag_id: tid,
        request_id: String(data?.trust_id ?? ''),
        source: 'socket',
      });

      if (activeTagRef.current?.boarding_confirmed_at) {
        try {
          console.log(
            'TRUST_BOARDING_INCOMING_TRUST_DROP',
            JSON.stringify({
              role,
              tag_id: tid || null,
              trust_id: String(data?.trust_id ?? ''),
            }),
          );
        } catch {
          /* noop */
        }
        console.log(
          'TRUST_DIAG_MODAL_SKIP',
          JSON.stringify({
            reason: 'BOARDING_COMMS_CLOSED',
            role,
            data_tag_id: tid || null,
          }),
        );
        return;
      }
      const rr = data?.requester_role === 'driver' ? 'driver' : 'passenger';
      if (st.showCallScreen || st.incomingCallBlocked || st.trustVideo) {
        if (st.trustVideo) {
          console.log(
            'TRUST_DIAG_MODAL_SKIP',
            JSON.stringify({
              reason: 'DEFER_DUE_TO_TRUST_VIDEO',
              role,
              trust_id: String(data?.trust_id ?? ''),
              tag_id: tid,
            }),
          );
        }
        if (st.showCallScreen || st.incomingCallBlocked) {
          console.log(
            'TRUST_DIAG_MODAL_SKIP',
            JSON.stringify({
              reason: 'DEFER_DUE_TO_CALL',
              role,
              showCallScreen: st.showCallScreen,
              incomingCallBlocked: st.incomingCallBlocked,
              trust_id: String(data?.trust_id ?? ''),
              tag_id: tid,
            }),
          );
        }
        const reasons: string[] = [];
        if (st.showCallScreen) reasons.push('showCallScreen');
        if (st.incomingCallBlocked) reasons.push('incomingCallBlocked');
        if (st.trustVideo) reasons.push('trustVideoSession');
        console.log(
          'TRUST_REQUEST_BLOCK_REASON',
          JSON.stringify({
            reasons,
            trust_id: String(data?.trust_id ?? ''),
            tag_id: tid,
          }),
        );
        console.log(
          'TRUST_REQUEST_DEFERRED_UI',
          JSON.stringify({
            trust_id: String(data?.trust_id ?? ''),
            tag_id: tid,
          }),
        );
        deferredTrustRequestRef.current = {
          trustId: String(data.trust_id ?? ''),
          tagId: tid,
          requesterRole: rr,
        };
        return;
      }
      deferredTrustRequestRef.current = null;
      console.log(
        'TRUST_DIAG_MODAL_OPENED',
        JSON.stringify({
          reason: 'MODAL_OPENED',
          role,
          trust_id: String(data?.trust_id ?? ''),
          tag_id: tid,
          requester_role: rr,
        }),
      );
      setTrustRequestModal({
        trustId: String(data.trust_id ?? ''),
        tagId: tid,
        requesterRole: rr,
      });
    },
    [role, scheduleTrustTagRetry, recoverIncomingPendingTrust],
  );

  const processTrustSessionReadyInternal = useCallback(
    (
      data: {
        trust_id?: string;
        tag_id?: string;
        channel_name?: string;
        agora_token?: string;
        agora_app_id?: string;
        session_hard_deadline_at?: string;
        peer_user_id?: string;
      },
      attempt: number,
    ) => {
      const tid = String(data?.tag_id ?? '').trim();
      const cur = String(activeTagIdRef.current ?? '').trim();
      const ch = String(data?.channel_name ?? '').trim();
      const tok = String(data?.agora_token ?? '').trim();

      if (!ch || !tok) {
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_READY_SKIP',
            reason: 'missing_channel_or_token',
            attempt,
            tag_id: tid || null,
          }),
        );
        return;
      }

      const tagMatches = !!(tid && cur && tid.toLowerCase() === cur.toLowerCase());

      if (tagMatches) {
        const incomingTrustId = String(data.trust_id ?? '').trim();
        const curVid = trustVideoSessionRef.current;
        if (curVid && isDuplicateTrustVideoSession(curVid, incomingTrustId, ch)) {
          try {
            console.log(
              '[TRUST]',
              JSON.stringify({
                evt: 'TRUST_READY_DUPLICATE_SKIP',
                attempt,
                trust_id: incomingTrustId,
                channel_name: ch,
              }),
            );
          } catch {
            /* noop */
          }
          return;
        }

        const peer = String(data.peer_user_id ?? '');
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_READY_RECEIVED',
            attempt,
            trust_id: incomingTrustId,
            tag_id: String(data.tag_id ?? ''),
            channel_name: ch,
            current_user_id: String(userId ?? ''),
            peer_user_id: peer,
            has_token: !!tok,
          }),
        );
        const peerName = peerDisplayNameForPeerId(peer);
        outboundTrustIdRef.current = null;
        setTrustOutgoingPending(false);
        setTrustRequestModal(null);
        setTrustModalLoading(false);
        trustCallPerf('TRUST_CALL_ACCEPT_SEEN', {
          role,
          tag_id: tid,
          request_id: incomingTrustId,
          source: 'trust_session_ready_socket',
        });
        openTrustVideoSession(
          {
            trustId: incomingTrustId,
            channelName: ch,
            agoraToken: tok,
            peerUserId: peer,
            sessionHardDeadlineAt: trustSessionDeadlineIso(data.session_hard_deadline_at),
            peerDisplayName: peerName,
          },
          'trust_session_ready_socket',
        );
        return;
      }

      if (attempt < MAX_TRUST_TAG_RETRY_ATTEMPTS) {
        console.log(
          'TRUST_READY_TAG_RETRY_SCHEDULED',
          JSON.stringify({
            attempt,
            role,
            data_tag_id: tid || null,
            activeTagIdRef: cur || null,
          }),
        );
        scheduleTrustTagRetry(() => processTrustSessionReadyInternal(data, attempt + 1), attempt);
        return;
      }

      console.log(
        'TRUST_READY_RETRY_EXHAUSTED',
        JSON.stringify({
          role,
          data_tag_id: tid || null,
          activeTagIdRef: cur || null,
          trust_outgoing_pending: trustOutgoingPendingRef.current,
        }),
      );
      if (trustOutgoingPendingRef.current && ch && tok) {
        const incomingTrustId = String(data.trust_id ?? '').trim();
        const peer = String(data.peer_user_id ?? '').trim();
        if (incomingTrustId && peer) {
          outboundTrustIdRef.current = null;
          setTrustOutgoingPending(false);
          setTrustRequestModal(null);
          setTrustModalLoading(false);
          trustCallPerf('TRUST_CALL_ACCEPT_SEEN', {
            role,
            tag_id: tid || cur,
            request_id: incomingTrustId,
            source: 'trust_ready_socket_requester_outgoing',
          });
          openTrustVideoSession(
            {
              trustId: incomingTrustId,
              channelName: ch,
              agoraToken: tok,
              peerUserId: peer,
              sessionHardDeadlineAt: trustSessionDeadlineIso(data.session_hard_deadline_at),
              peerDisplayName: peerDisplayNameForPeerId(peer),
            },
            'trust_ready_socket_requester_outgoing',
          );
          return;
        }
      }
      const fallbackTag = tid || cur;
      if (fallbackTag) {
        void recoverTrustVideoByTagId(fallbackTag, 'trust_ready_socket_tag_exhausted');
      }
    },
    [role, scheduleTrustTagRetry, peerDisplayNameForPeerId, userId, recoverTrustVideoByTagId, openTrustVideoSession],
  );

  const trustSocketHandlers = useMemo<TrustSocketHandlers>(
    () => ({
      onTrustSocketRequest: (data) => {
        clearTrustTagRetryTimers();
        processTrustSocketRequestInternal(data, 0);
      },
      onTrustSessionReady: (data) => {
        clearTrustTagRetryTimers();
        processTrustSessionReadyInternal(data, 0);
      },
      onTrustSessionEnded: (data) => {
        clearTrustTagRetryTimers();

        const endTrustId = normTrustId(data?.trust_id);
        if (!endTrustId) {
          console.log(
            '[TRUST]',
            JSON.stringify({ evt: 'TRUST_SESSION_ENDED_SKIP', reason: 'missing_trust_id' }),
          );
          return;
        }

        const evTag = String(data?.tag_id ?? '').trim();
        const cur = String(activeTagIdRef.current ?? '').trim();
        const tagOk = !evTag || !cur || evTag.toLowerCase() === cur.toLowerCase();

        const videoTid = normTrustId(trustVideoSessionRef.current?.trustId);
        const sessionMatches = !!videoTid && videoTid === endTrustId;
        const outboundMatches = normTrustId(outboundTrustIdRef.current) === endTrustId;
        const deferredMatches =
          normTrustId(deferredTrustRequestRef.current?.trustId) === endTrustId;
        const modalMatches = normTrustId(trustRequestModalRef.current?.trustId) === endTrustId;

        /** Bu oturuma ait UI/state var mı? (tag yarışında trust_id bağlayıcıdır.) */
        const trustIdApplies =
          sessionMatches || outboundMatches || deferredMatches || modalMatches;

        if (!tagOk && !trustIdApplies) {
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_SESSION_ENDED_SKIP',
              reason: 'tag_and_trust_mismatch',
              end_trust_id: endTrustId,
              ev_tag: evTag || null,
              active_tag_id: cur || null,
            }),
          );
          return;
        }

        if (normTrustId(deferredTrustRequestRef.current?.trustId) === endTrustId) {
          deferredTrustRequestRef.current = null;
        }

        const reason = String(data?.end_reason ?? '');

        if (reason === 'rejected') {
          if (!trustIdApplies) {
            if (tagOk && trustOutgoingPendingRef.current) {
              appAlert('Güven isteği', 'Karşı taraf şu an müsait değil.', [{ text: 'Tamam' }], {
                variant: 'info',
                autoDismissMs: 2600,
                cancelable: true,
              });
              if (!activeTagRef.current?.boarding_confirmed_at) {
                setTimeout(() => {
                  openChatRef.current?.();
                }, 150);
              }
              finalizeTrustTerminal('trust_session_ended_rejected_outgoing', {
                trustId: endTrustId,
              });
              console.log(
                '[TRUST]',
                JSON.stringify({
                  evt: 'TRUST_OUTGOING_PENDING_CLEAR',
                  source: 'trust_session_ended_rejected',
                  reason: 'outgoing_pending_tag_match',
                  end_trust_id: endTrustId,
                }),
              );
            } else {
              console.log(
                '[TRUST]',
                JSON.stringify({
                  evt: 'TRUST_SESSION_ENDED_SKIP',
                  reason: 'rejected_not_applicable',
                  end_trust_id: endTrustId,
                }),
              );
            }
            return;
          }

          const currentUserId = String(userId ?? '').trim().toLowerCase();
          const isRejectingUser =
            String((data as { rejected_by?: string }).rejected_by ?? '')
              .trim()
              .toLowerCase() === currentUserId;

          if (isRejectingUser) {
            appAlert('Bilgi', 'Müsait değilseniz mesaj yazabilirsiniz', [{ text: 'Tamam' }], {
              variant: 'info',
            });
          } else {
            appAlert('Güven isteği', 'Karşı taraf şu an müsait değil.', [{ text: 'Tamam' }], {
              variant: 'info',
            });
          }

          if (!activeTagRef.current?.boarding_confirmed_at) {
            setTimeout(() => {
              openChatRef.current?.();
            }, 150);
          }

          finalizeTrustTerminal('trust_session_ended_rejected', { trustId: endTrustId });
          return;
        }

        if (outboundMatches) {
          outboundTrustIdRef.current = null;
          setTrustOutgoingPending(false);
        }
        if (modalMatches) {
          setTrustModalLoading(false);
        }
        lastAppliedTrustVideoKeyRef.current = '';
        setTrustVideoSession((prev) =>
          prev && normTrustId(prev.trustId) === endTrustId ? null : prev,
        );
        setTrustRequestModal((prev) =>
          prev && normTrustId(prev.trustId) === endTrustId ? null : prev,
        );
        if (reason === 'expired' && trustIdApplies) {
          appAlert('Güven isteği', 'Süre doldu veya görüşme sona erdi.', [{ text: 'Tamam' }], { variant: 'info' });
        }
      },
    }),
    [
      peerDisplayNameForPeerId,
      userId,
      clearAllTrustState,
      finalizeTrustTerminal,
      role,
      processTrustSocketRequestInternal,
      processTrustSessionReadyInternal,
      clearTrustTagRetryTimers,
    ],
  );

  return {
    trustRequestModal,
    trustModalLoading,
    trustOutgoingPending,
    trustVideoSession,
    sendTrustRequest,
    respondTrust,
    clearAllTrustState,
    trustSocketHandlers,
    trustGuvenButtonDisabled,
    trustGuvenBlockReason,
    isTrustBlockingCalls,
  };
}
