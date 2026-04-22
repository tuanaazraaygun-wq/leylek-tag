/**
 * Güven AL — state, API, socket ve yeniden bağlanma (index.tsx ile aynı davranış, taşınmış kod).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { appAlert } from '../contexts/AppAlertContext';
import { displayFirstName } from '../lib/displayName';
import {
  postTrustRequest,
  postTrustRespond,
  getTrustActive,
  type TrustActiveSessionRow,
} from '../lib/trustApi';
import { BOARDING_COMMS_CLOSED_USER_MSG, BOARDING_COMM_CLOSED_CODE } from '../lib/boardingCommsClosed';

/** tag_id / activeTag yarışı için kısa retry; socket tek sefer kaçsa bile activeTag yetişince modal / video açılır */
const MAX_TRUST_TAG_RETRY_ATTEMPTS = 14;
const TRUST_TAG_RETRY_BASE_MS = 260;

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
  const [trustRequestModal, setTrustRequestModal] = useState<TrustRequestModalState>(null);
  const [trustModalLoading, setTrustModalLoading] = useState(false);
  const [trustOutgoingPending, setTrustOutgoingPending] = useState(false);
  const [trustVideoSession, setTrustVideoSession] = useState<TrustVideoSessionState>(null);

  const activeTagIdRef = useRef<string | null>(null);
  const activeTagRef = useRef(activeTag);
  const outboundTrustIdRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);
  const recoveryInFlightRef = useRef(false);
  const openChatRef = useRef(openChatForMatchedTrip);
  openChatRef.current = openChatForMatchedTrip;

  const trustVideoSessionRef = useRef<TrustVideoSessionState>(null);
  useEffect(() => {
    trustVideoSessionRef.current = trustVideoSession;
  }, [trustVideoSession]);

  const trustTagRetryTimerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTrustTagRetryTimers = useCallback(() => {
    trustTagRetryTimerIdsRef.current.forEach((timerId) => clearTimeout(timerId));
    trustTagRetryTimerIdsRef.current = [];
  }, []);

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
    activeTagIdRef.current = activeTag?.id ? String(activeTag.id) : null;
    activeTagRef.current = activeTag;
  }, [activeTag?.id, activeTag]);

  const clearAllTrustState = useCallback(() => {
    clearTrustTagRetryTimers();
    outboundTrustIdRef.current = null;
    sendInFlightRef.current = false;
    deferredTrustRequestRef.current = null;
    setTrustOutgoingPending(false);
    setTrustRequestModal(null);
    setTrustModalLoading(false);
    setTrustVideoSession(null);
  }, [clearTrustTagRetryTimers]);

  useEffect(() => {
    if (!activeTag?.id) {
      clearAllTrustState();
    }
  }, [activeTag?.id, clearAllTrustState]);

  useEffect(() => {
    if (boardingCommsClosed) {
      deferredTrustRequestRef.current = null;
    }
  }, [boardingCommsClosed]);

  const trustGuvenButtonDisabled =
    trustOutgoingPending || trustModalLoading || !!trustVideoSession || !!trustRequestModal;

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

  const tryRecoverAcceptedSession = useCallback(async () => {
    const uid = userId?.trim();
    const tid = activeTagIdRef.current;
    if (!uid || !tid) return;
    if (trustVideoSessionRef.current) return;
    if (showCallScreen || incomingCallBlocked) return;
    if (recoveryInFlightRef.current) return;
    recoveryInFlightRef.current = true;
    try {
      const requestedTag = String(tid).trim().toLowerCase();
      const r = await getTrustActive(tid);
      if (activeTagIdRef.current?.trim().toLowerCase() !== requestedTag) return;
      if (!r?.success || !r.session) return;
      const s = r.session as TrustActiveSessionRow;
      if (String(s.status || '') !== 'accepted') return;
      const rowTag = String(s.tag_id ?? '').trim().toLowerCase();
      if (rowTag !== requestedTag) return;
      const ch = String(s.channel_name ?? '').trim();
      const recoveryTok = String(s.recovery_agora_token ?? '').trim();
      if (!ch || !recoveryTok) return;
      const trustId = String(s.id ?? '').trim();
      const deadline = String(s.session_hard_deadline_at ?? '').trim();
      const peer = String(s.recovery_peer_user_id ?? '').trim();
      if (!trustId || !deadline || !peer) return;

      setTrustVideoSession({
        trustId,
        channelName: ch,
        agoraToken: recoveryTok,
        peerUserId: peer,
        sessionHardDeadlineAt: deadline,
        peerDisplayName: peerDisplayNameForPeerId(peer),
      });
    } finally {
      recoveryInFlightRef.current = false;
    }
  }, [userId, showCallScreen, incomingCallBlocked, peerDisplayNameForPeerId]);

  /**
   * Socket trust_session_ready tag eşleşmediğinde veya event kaçtığında: event'teki tag_id ile GET /trust/active.
   * activeTag ref henüz güncellenmemiş olsa bile kabul edilmiş oturumu açar (yanlış tag için active_tag_mismatch_after_fetch ile iptal).
   */
  const recoverTrustVideoByTagId = useCallback(
    async (tagIdForQuery: string, reason: string) => {
      const tid = String(tagIdForQuery ?? '').trim().toLowerCase();
      const uid = userId?.trim();
      if (!tid || !uid) return;
      if (trustVideoSessionRef.current) return;
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
        const ch = String(s.channel_name ?? '').trim();
        const recoveryTok = String(s.recovery_agora_token ?? '').trim();
        if (!ch || !recoveryTok) return;
        const trustId = String(s.id ?? '').trim();
        const deadline = String(s.session_hard_deadline_at ?? '').trim();
        const peer = String(s.recovery_peer_user_id ?? '').trim();
        if (!trustId || !deadline || !peer) return;

        outboundTrustIdRef.current = null;
        setTrustOutgoingPending(false);
        setTrustRequestModal(null);
        setTrustModalLoading(false);
        setTrustVideoSession({
          trustId,
          channelName: ch,
          agoraToken: recoveryTok,
          peerUserId: peer,
          sessionHardDeadlineAt: deadline,
          peerDisplayName: peerDisplayNameForPeerId(peer),
        });
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_READY_RECOVERY_APPLIED',
            reason,
            trust_id: trustId,
            tag_id: tid,
          }),
        );
      } finally {
        recoveryInFlightRef.current = false;
      }
    },
    [userId, showCallScreen, incomingCallBlocked, peerDisplayNameForPeerId, role],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void tryRecoverAcceptedSession();
      }
    });
    return () => sub.remove();
  }, [tryRecoverAcceptedSession]);

  useEffect(() => {
    if (activeTag?.id && String(activeTag.status || '') === 'matched') {
      const t = setTimeout(() => void tryRecoverAcceptedSession(), 600);
      return () => clearTimeout(t);
    }
  }, [activeTag?.id, activeTag?.status, tryRecoverAcceptedSession]);

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
    if (sendInFlightRef.current || trustOutgoingPending) {
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
    sendInFlightRef.current = true;
    setTrustOutgoingPending(true);
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
        } else {
          appAlert('Hata', err);
        }
        return;
      }
      if (res.trust_id) {
        outboundTrustIdRef.current = String(res.trust_id);
      }
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
  ]);

  const respondTrust = useCallback(
    async (accept: boolean) => {
      if (!trustRequestModal?.trustId) return;
      setTrustModalLoading(true);
      const res = await postTrustRespond(trustRequestModal.trustId, accept);
      setTrustModalLoading(false);
      if (!res?.success) {
        appAlert('Hata', String(res?.error ?? 'Yanıt gönderilemedi'));
        setTrustRequestModal(null);
        return;
      }
      setTrustRequestModal(null);
    },
    [trustRequestModal],
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
        }
        return;
      }

      if (activeTagRef.current?.boarding_confirmed_at) {
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
    [role, scheduleTrustTagRetry],
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
        const peer = String(data.peer_user_id ?? '');
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_READY_RECEIVED',
            attempt,
            trust_id: String(data.trust_id ?? ''),
            tag_id: String(data.tag_id ?? ''),
            channel_name: String(data.channel_name ?? ''),
            current_user_id: String(userId ?? ''),
            peer_user_id: peer,
            has_token: !!String(data.agora_token ?? '').trim(),
          }),
        );
        const peerName = peerDisplayNameForPeerId(peer);
        outboundTrustIdRef.current = null;
        setTrustOutgoingPending(false);
        setTrustRequestModal(null);
        setTrustModalLoading(false);
        setTrustVideoSession({
          trustId: String(data.trust_id ?? ''),
          channelName: ch,
          agoraToken: tok,
          peerUserId: peer,
          sessionHardDeadlineAt: String(data.session_hard_deadline_at ?? ''),
          peerDisplayName: peerName,
        });
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
        }),
      );
      const fallbackTag = tid || cur;
      if (fallbackTag) {
        void recoverTrustVideoByTagId(fallbackTag, 'trust_ready_socket_tag_exhausted');
      }
    },
    [role, scheduleTrustTagRetry, peerDisplayNameForPeerId, userId, recoverTrustVideoByTagId],
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
        const endTrustId = String(data?.trust_id ?? '');
        const evTag = String(data?.tag_id ?? '').trim();
        const cur = String(activeTagIdRef.current ?? '').trim();
        const tagOk = !evTag || !cur || evTag.toLowerCase() === cur.toLowerCase();
        if (!tagOk) return;

        if (deferredTrustRequestRef.current?.trustId === endTrustId) {
          deferredTrustRequestRef.current = null;
        }

        const reason = String(data?.end_reason ?? '');

        if (reason === 'rejected') {
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
            appAlert('Güven isteği', 'Karşı taraf güven vermedi', [{ text: 'Tamam' }], {
              variant: 'warning',
            });
          }

          if (!activeTagRef.current?.boarding_confirmed_at) {
            setTimeout(() => {
              openChatRef.current?.();
            }, 150);
          }

          clearAllTrustState();
          return;
        }

        if (outboundTrustIdRef.current && outboundTrustIdRef.current === endTrustId) {
          outboundTrustIdRef.current = null;
        }
        setTrustOutgoingPending(false);
        setTrustModalLoading(false);
        setTrustVideoSession((prev) => (prev && prev.trustId === endTrustId ? null : prev));
        setTrustRequestModal((prev) => (prev && prev.trustId === endTrustId ? null : prev));
        if (reason === 'expired') {
          appAlert('Güven isteği', 'Süre doldu veya görüşme sona erdi.', [{ text: 'Tamam' }], { variant: 'info' });
        }
      },
    }),
    [
      peerDisplayNameForPeerId,
      userId,
      clearAllTrustState,
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
    isTrustBlockingCalls,
  };
}
