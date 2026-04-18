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
  onTrustSessionEnded?: (data: { trust_id: string; tag_id?: string; end_reason?: string }) => void;
};

type Options = {
  role: 'passenger' | 'driver';
  userId: string | null | undefined;
  activeTag: TrustActiveTagSnapshot;
  showCallScreen: boolean;
  incomingCallBlocked: boolean;
};

export function useTrustSessionController({
  role,
  userId,
  activeTag,
  showCallScreen,
  incomingCallBlocked,
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
    outboundTrustIdRef.current = null;
    sendInFlightRef.current = false;
    setTrustOutgoingPending(false);
    setTrustRequestModal(null);
    setTrustModalLoading(false);
    setTrustVideoSession(null);
  }, []);

  useEffect(() => {
    if (!activeTag?.id) {
      clearAllTrustState();
    }
  }, [activeTag?.id, clearAllTrustState]);

  const trustGuvenButtonDisabled =
    trustOutgoingPending || trustModalLoading || !!trustVideoSession || !!trustRequestModal;

  const isTrustBlockingCalls =
    !!trustVideoSession || !!trustOutgoingPending || !!trustRequestModal;

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

  const applySessionReadyPayload = useCallback(
    (data: {
      trust_id: string;
      tag_id: string;
      channel_name: string;
      agora_token: string;
      session_hard_deadline_at?: string;
      peer_user_id: string;
    }) => {
      outboundTrustIdRef.current = null;
      setTrustOutgoingPending(false);
      setTrustRequestModal(null);
      setTrustModalLoading(false);
      const peer = String(data.peer_user_id ?? '');
      setTrustVideoSession({
        trustId: String(data.trust_id ?? ''),
        channelName: String(data.channel_name ?? ''),
        agoraToken: String(data.agora_token ?? ''),
        peerUserId: peer,
        sessionHardDeadlineAt: String(data.session_hard_deadline_at ?? ''),
        peerDisplayName: peerDisplayNameForPeerId(peer),
      });
    },
    [peerDisplayNameForPeerId],
  );

  const tryRecoverAcceptedSession = useCallback(async () => {
    const uid = userId?.trim();
    const tid = activeTagIdRef.current;
    if (!uid || !tid) return;
    if (trustVideoSession) return;
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
  }, [userId, trustVideoSession, showCallScreen, incomingCallBlocked, peerDisplayNameForPeerId]);

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
        if (err === 'trust_already_active') {
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

  const trustSocketHandlers = useMemo<TrustSocketHandlers>(
    () => ({
      onTrustSocketRequest: (data) => {
        const tid = String(data?.tag_id ?? '');
        if (!tid || tid !== activeTagIdRef.current) return;
        const st = blockStateRef.current;
        if (st.showCallScreen || st.incomingCallBlocked || st.trustVideo) return;
        const rr = data?.requester_role === 'driver' ? 'driver' : 'passenger';
        setTrustRequestModal({
          trustId: String(data.trust_id ?? ''),
          tagId: tid,
          requesterRole: rr,
        });
      },
      onTrustSessionReady: (data) => {
        const tid = String(data?.tag_id ?? '');
        if (!tid || tid !== activeTagIdRef.current) return;
        applySessionReadyPayload({
          trust_id: String(data.trust_id ?? ''),
          tag_id: tid,
          channel_name: String(data.channel_name ?? ''),
          agora_token: String(data.agora_token ?? ''),
          session_hard_deadline_at: data.session_hard_deadline_at,
          peer_user_id: String(data.peer_user_id ?? ''),
        });
      },
      onTrustSessionEnded: (data) => {
        const endTrustId = String(data?.trust_id ?? '');
        const tagOk =
          !data?.tag_id ||
          !activeTagIdRef.current ||
          String(data.tag_id) === activeTagIdRef.current;
        if (!tagOk) return;
        if (outboundTrustIdRef.current && outboundTrustIdRef.current === endTrustId) {
          outboundTrustIdRef.current = null;
        }
        setTrustOutgoingPending(false);
        setTrustModalLoading(false);
        setTrustVideoSession((prev) => (prev && prev.trustId === endTrustId ? null : prev));
        setTrustRequestModal((prev) => (prev && prev.trustId === endTrustId ? null : prev));
        const reason = String(data?.end_reason ?? '');
        if (reason === 'rejected') {
          appAlert('Güven isteği', 'Karşı taraf güven vermedi.', [{ text: 'Tamam' }], { variant: 'info' });
        } else if (reason === 'expired') {
          appAlert('Güven isteği', 'Süre doldu veya görüşme sona erdi.', [{ text: 'Tamam' }], { variant: 'info' });
        }
      },
    }),
    [applySessionReadyPayload],
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
