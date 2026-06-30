import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  acceptTrustedDirectInvite,
  declineTrustedDirectInvite,
  getCurrentTrustedDirectInvite,
  mapTdmUserFacingError,
  TDM_DRIVER_INVITE_HYDRATE_ERROR,
  TDM_POLL_INTERVAL_MS,
  type TrustedDirectAcceptResponse,
  type TrustedDirectApiErrorCode,
  type TrustedDirectApiResult,
  type TrustedDirectDriverInvitePublic,
} from '../lib/trustedDirectApi';
import { appAlert } from '../contexts/AppAlertContext';
import { offerSoundController } from '../lib/offerSoundController';
import { perfLog } from '../utils/perfDiagLog';

const MAX_POLL_BACKOFF_MS = 10000;

export type TrustedDirectDriverSessionStatus =
  | 'idle'
  | 'restoring'
  | 'pending'
  | 'accepting'
  | 'matched'
  | 'error';

export type UseTrustedDirectDriverSessionOptions = {
  enabled: boolean;
  hasActiveTag: boolean;
  pollIntervalMs?: number;
  onMatched: (
    matchedTagId: string,
    acceptPayload: TrustedDirectAcceptResponse,
    inviteSnapshot: TrustedDirectDriverInvitePublic | null,
  ) => void;
};

function isPendingResponderInvite(
  invite: TrustedDirectDriverInvitePublic | null | undefined,
): invite is TrustedDirectDriverInvitePublic {
  return invite != null && invite.status === 'pending_responder';
}

function sessionStatusFromInvite(
  invite: TrustedDirectDriverInvitePublic | null,
): TrustedDirectDriverSessionStatus {
  if (isPendingResponderInvite(invite)) {
    return 'pending';
  }
  return 'idle';
}

function isHydrateParseFailure(
  result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>,
): boolean {
  return result.code === 'PARSE' && result.message === TDM_DRIVER_INVITE_HYDRATE_ERROR;
}

function isHardPollStopCode(code: TrustedDirectApiErrorCode): boolean {
  return (
    code === 'UNAVAILABLE' ||
    code === 'UNAUTH' ||
    code === 'FORBIDDEN' ||
    code === 'NOT_FOUND'
  );
}

export function useTrustedDirectDriverSession(options: UseTrustedDirectDriverSessionOptions) {
  const {
    enabled,
    hasActiveTag,
    pollIntervalMs = TDM_POLL_INTERVAL_MS,
    onMatched,
  } = options;

  const [status, setStatus] = useState<TrustedDirectDriverSessionStatus>('idle');
  const [invite, setInvite] = useState<TrustedDirectDriverInvitePublic | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollErrorMessage, setPollErrorMessage] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [appIsActive, setAppIsActive] = useState(
    () => AppState.currentState === 'active',
  );

  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const acceptInFlightRef = useRef(false);
  const declineInFlightRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollBackoffMsRef = useRef(pollIntervalMs);
  const inviteRef = useRef<TrustedDirectDriverInvitePublic | null>(null);
  const statusRef = useRef<TrustedDirectDriverSessionStatus>('idle');
  const prevEnabledRef = useRef(false);
  const prevHasActiveTagRef = useRef(false);
  const onMatchedRef = useRef(onMatched);
  const enabledRef = useRef(enabled);
  const hasActiveTagRef = useRef(hasActiveTag);
  const pollIntervalMsRef = useRef(pollIntervalMs);

  useEffect(() => {
    onMatchedRef.current = onMatched;
    enabledRef.current = enabled;
    hasActiveTagRef.current = hasActiveTag;
    pollIntervalMsRef.current = pollIntervalMs;
  }, [onMatched, enabled, hasActiveTag, pollIntervalMs]);

  useEffect(() => {
    inviteRef.current = invite;
  }, [invite]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
    pollBackoffMsRef.current = pollIntervalMsRef.current;
  }, []);

  const applyInvite = useCallback(
    (nextInvite: TrustedDirectDriverInvitePublic | null, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      setIsRestoring(false);
      setInvite(nextInvite);
      setPollErrorMessage(null);
      pollBackoffMsRef.current = pollIntervalMsRef.current;
      setStatus(sessionStatusFromInvite(nextInvite));
    },
    [],
  );

  const applyHydrateFailure = useCallback(
    (
      result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>,
      generation: number,
    ) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      stopPolling();
      setInvite(null);
      setStatus('error');
      setErrorMessage(
        isHydrateParseFailure(result)
          ? TDM_DRIVER_INVITE_HYDRATE_ERROR
          : mapTdmUserFacingError(result),
      );
      setPollErrorMessage(null);
    },
    [stopPolling],
  );

  const handlePollFailure = useCallback(
    (result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.code === 'NETWORK' || result.code === 'SERVER' || result.code === 'PARSE') {
        if (isHydrateParseFailure(result)) {
          applyHydrateFailure(result, generation);
          return;
        }
        setPollErrorMessage(mapTdmUserFacingError(result));
        pollBackoffMsRef.current = Math.min(
          pollBackoffMsRef.current * 2,
          MAX_POLL_BACKOFF_MS,
        );
        return;
      }

      if (isHardPollStopCode(result.code)) {
        stopPolling();
        if (result.code === 'NOT_FOUND' || result.code === 'UNAVAILABLE') {
          offerSoundController.stopAllOfferLoops('tdm_not_found');
          setInvite(null);
          setStatus('idle');
          setErrorMessage(null);
          setPollErrorMessage(null);
          return;
        }
        setStatus('error');
        setErrorMessage(mapTdmUserFacingError(result));
        setPollErrorMessage(null);
      }
    },
    [applyHydrateFailure, stopPolling],
  );

  const pollOnce = useCallback(
    async (generation: number) => {
      if (acceptInFlightRef.current || declineInFlightRef.current) {
        return;
      }
      if (!enabledRef.current || hasActiveTagRef.current) {
        return;
      }

      const iid = String(inviteRef.current?.id || '').trim();
      if (!iid || statusRef.current !== 'pending') {
        return;
      }

      const result = await getCurrentTrustedDirectInvite();
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.ok) {
        applyInvite(result.data, generation);
        return;
      }

      if (result.ok === false) {
        handlePollFailure(result, generation);
      }
    },
    [applyInvite, handlePollFailure],
  );

  const schedulePollTick = useCallback(
    (generation: number, delayMs?: number) => {
      if (pollTimerRef.current != null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      const delay = delayMs ?? pollBackoffMsRef.current;
      pollTimerRef.current = setTimeout(() => {
        pollTimerRef.current = null;
        if (!mountedRef.current || generation !== generationRef.current) {
          return;
        }
        if (
          !enabledRef.current ||
          hasActiveTagRef.current ||
          statusRef.current !== 'pending' ||
          !inviteRef.current?.id ||
          !appIsActive ||
          acceptInFlightRef.current ||
          declineInFlightRef.current
        ) {
          setIsPolling(false);
          return;
        }

        setIsPolling(true);
        void pollOnce(generation).finally(() => {
          if (!mountedRef.current || generation !== generationRef.current) {
            return;
          }
          if (
            enabledRef.current &&
            !hasActiveTagRef.current &&
            statusRef.current === 'pending' &&
            inviteRef.current?.id &&
            appIsActive &&
            !acceptInFlightRef.current &&
            !declineInFlightRef.current
          ) {
            schedulePollTick(generation);
          } else {
            setIsPolling(false);
          }
        });
      }, delay);
    },
    [appIsActive, pollOnce],
  );

  const startPolling = useCallback(
    (generation: number) => {
      if (
        !enabledRef.current ||
        hasActiveTagRef.current ||
        statusRef.current !== 'pending' ||
        !inviteRef.current?.id ||
        !appIsActive ||
        acceptInFlightRef.current ||
        declineInFlightRef.current
      ) {
        stopPolling();
        return;
      }
      pollBackoffMsRef.current = pollIntervalMsRef.current;
      setIsPolling(true);
      schedulePollTick(generation, pollIntervalMsRef.current);
    },
    [appIsActive, schedulePollTick, stopPolling],
  );

  const restore = useCallback(async () => {
    if (!enabledRef.current || hasActiveTagRef.current) {
      return;
    }
    if (acceptInFlightRef.current || declineInFlightRef.current) {
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;

    setIsRestoring(true);
    setErrorMessage(null);
    setPollErrorMessage(null);
    setStatus('restoring');

    try {
      const result = await getCurrentTrustedDirectInvite();

      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.ok === false) {
        stopPolling();
        if (result.code === 'UNAVAILABLE') {
          setInvite(null);
          setStatus('idle');
          setErrorMessage(null);
          return;
        }
        if (isHydrateParseFailure(result)) {
          applyHydrateFailure(result, generation);
          return;
        }
        setInvite(null);
        setStatus('error');
        setErrorMessage(mapTdmUserFacingError(result));
        return;
      }

      applyInvite(result.data, generation);
    } finally {
      if (mountedRef.current) {
        setIsRestoring(false);
      }
    }
  }, [applyHydrateFailure, applyInvite, stopPolling]);

  /** Push/poll refresh — no restoring status (keeps offerSoundController audible during fetch). */
  const refresh = useCallback(async () => {
    if (!enabledRef.current || hasActiveTagRef.current) {
      return;
    }
    if (acceptInFlightRef.current || declineInFlightRef.current) {
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;

    setErrorMessage(null);
    setPollErrorMessage(null);

    const result = await getCurrentTrustedDirectInvite();
    if (!mountedRef.current || generation !== generationRef.current) {
      return;
    }

    if (result.ok) {
      applyInvite(result.data, generation);
      return;
    }

    if (result.ok === false) {
      if (result.code === 'NOT_FOUND' || result.code === 'UNAVAILABLE') {
        offerSoundController.stopAllOfferLoops('tdm_not_found');
        stopPolling();
        setInvite(null);
        setStatus('idle');
        setErrorMessage(null);
        setPollErrorMessage(null);
        return;
      }

      if (isHydrateParseFailure(result)) {
        applyHydrateFailure(result, generation);
        return;
      }

      if (isHardPollStopCode(result.code)) {
        stopPolling();
        setStatus('error');
        setErrorMessage(mapTdmUserFacingError(result));
        return;
      }

      setPollErrorMessage(mapTdmUserFacingError(result));
    }
  }, [applyHydrateFailure, applyInvite, stopPolling]);

  const accept = useCallback(async (): Promise<boolean> => {
    const iid = String(inviteRef.current?.id || '').trim();
    if (!iid || acceptInFlightRef.current) {
      return false;
    }

    acceptInFlightRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    offerSoundController.stopAllOfferLoops('tdm_accept');
    stopPolling();
    setIsAccepting(true);
    setErrorMessage(null);

    let result: Awaited<ReturnType<typeof acceptTrustedDirectInvite>>;
    try {
      result = await acceptTrustedDirectInvite(iid);
    } finally {
      acceptInFlightRef.current = false;
      if (mountedRef.current) {
        setIsAccepting(false);
      }
    }

    if (!mountedRef.current || generation !== generationRef.current) {
      return false;
    }

    if (result.ok === false) {
      const refreshResult = await getCurrentTrustedDirectInvite();
      if (
        refreshResult.ok &&
        mountedRef.current &&
        generation === generationRef.current
      ) {
        applyInvite(refreshResult.data, generation);
      }
      setErrorMessage(mapTdmUserFacingError(result));
      return false;
    }

    const tagId = String(result.data.tag?.id || '').trim();
    setStatus('matched');
    stopPolling();
    if (tagId) {
      onMatchedRef.current(tagId, result.data, inviteRef.current);
    }
    return Boolean(tagId);
  }, [applyInvite, stopPolling]);

  const decline = useCallback(async (): Promise<boolean> => {
    const iid = String(inviteRef.current?.id || '').trim();
    if (declineInFlightRef.current) {
      return false;
    }
    if (!iid) {
      const msg = 'Davet bulunamadı. Lütfen tekrar deneyin.';
      perfLog('TDM_DECLINE_NO_INVITE', { status: statusRef.current });
      setErrorMessage(msg);
      appAlert('Reddet', msg, [{ text: 'Tamam', style: 'default' }], { variant: 'warning' });
      return false;
    }

    declineInFlightRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    offerSoundController.stopAllOfferLoops('tdm_decline');
    stopPolling();
    setIsDeclining(true);
    setErrorMessage(null);

    let result: Awaited<ReturnType<typeof declineTrustedDirectInvite>>;
    try {
      result = await declineTrustedDirectInvite(iid);
    } finally {
      declineInFlightRef.current = false;
      if (mountedRef.current) {
        setIsDeclining(false);
      }
    }

    if (!mountedRef.current) {
      return false;
    }

    if (result.ok === false) {
      if (generation === generationRef.current) {
        const refreshResult = await getCurrentTrustedDirectInvite();
        if (refreshResult.ok && mountedRef.current && generation === generationRef.current) {
          applyInvite(refreshResult.data, generation);
          if (!refreshResult.data) {
            setInvite(null);
            setStatus('idle');
            setErrorMessage(null);
            setPollErrorMessage(null);
            setIsRestoring(false);
            return true;
          }
        }
      }
      const errMsg =
        result.message?.trim() || mapTdmUserFacingError(result);
      setErrorMessage(errMsg);
      perfLog('TDM_DECLINE_FAILED', { inviteId: iid, code: result.code, message: errMsg });
      appAlert('Reddet', errMsg, [{ text: 'Tamam', style: 'default' }], { variant: 'warning' });
      return false;
    }

    setInvite(null);
    setStatus('idle');
    setErrorMessage(null);
    setPollErrorMessage(null);
    setIsRestoring(false);
    return true;
  }, [applyInvite, stopPolling]);

  const clear = useCallback(() => {
    offerSoundController.stopAllOfferLoops('tdm_clear');
    generationRef.current += 1;
    stopPolling();
    setInvite(null);
    setErrorMessage(null);
    setPollErrorMessage(null);
    setStatus('idle');
    setIsAccepting(false);
    setIsDeclining(false);
    setIsRestoring(false);
  }, [stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (pollTimerRef.current != null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onAppStateChange = (next: AppStateStatus) => {
      const active = next === 'active';
      setAppIsActive(active);
      if (!active) {
        stopPolling();
        return;
      }
      if (enabledRef.current && !hasActiveTagRef.current) {
        void refresh();
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [refresh, stopPolling]);

  useEffect(() => {
    if (hasActiveTag) {
      stopPolling();
    }
  }, [hasActiveTag, stopPolling]);

  useEffect(() => {
    if (!enabled || hasActiveTag) {
      prevEnabledRef.current = enabled;
      prevHasActiveTagRef.current = hasActiveTag;
      if (!enabled) {
        stopPolling();
      }
      return;
    }

    const enabledTurnedOn = enabled && !prevEnabledRef.current;
    const activeTagCleared = prevHasActiveTagRef.current && !hasActiveTag;
    const shouldRestore = enabledTurnedOn || activeTagCleared;

    prevEnabledRef.current = enabled;
    prevHasActiveTagRef.current = hasActiveTag;

    if (shouldRestore) {
      void restore();
    }
  }, [enabled, hasActiveTag, restore, stopPolling]);

  useEffect(() => {
    if (
      !enabled ||
      hasActiveTag ||
      status !== 'pending' ||
      !invite?.id ||
      !appIsActive
    ) {
      stopPolling();
      return;
    }

    const generation = generationRef.current;
    startPolling(generation);

    return () => {
      stopPolling();
    };
  }, [
    enabled,
    hasActiveTag,
    status,
    invite?.id,
    appIsActive,
    startPolling,
    stopPolling,
  ]);

  return {
    status,
    invite,
    errorMessage,
    pollErrorMessage,
    isRestoring,
    isAccepting,
    isDeclining,
    isPolling,
    accept,
    decline,
    refresh,
    clear,
  };
}
