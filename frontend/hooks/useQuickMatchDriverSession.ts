import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  acceptQuickMatchInvite,
  declineQuickMatchInvite,
  getCurrentQuickMatchInvite,
  type QuickMatchApiErrorCode,
  type QuickMatchApiResult,
  type QuickMatchAcceptResponse,
  type QuickMatchInvitePublic,
} from '../lib/quickMatchApi';
import { offerSoundController } from '../lib/offerSoundController';

const DEFAULT_POLL_INTERVAL_MS = 2500;
const MAX_POLL_BACKOFF_MS = 10000;

export type QuickMatchDriverSessionStatus =
  | 'idle'
  | 'restoring'
  | 'pending'
  | 'accepting'
  | 'matched'
  | 'error';

export type UseQuickMatchDriverSessionOptions = {
  enabled: boolean;
  hasActiveTag: boolean;
  pollIntervalMs?: number;
  onMatched: (matchedTagId: string, acceptPayload?: QuickMatchAcceptResponse) => void;
};

function isPendingDriverInvite(
  invite: QuickMatchInvitePublic | null | undefined,
): invite is QuickMatchInvitePublic {
  return invite != null && invite.status === 'pending_driver';
}

function sessionStatusFromInvite(
  invite: QuickMatchInvitePublic | null,
): QuickMatchDriverSessionStatus {
  if (isPendingDriverInvite(invite)) {
    return 'pending';
  }
  return 'idle';
}

function isHardPollStopCode(code: QuickMatchApiErrorCode): boolean {
  return (
    code === 'UNAVAILABLE' ||
    code === 'UNAUTH' ||
    code === 'FORBIDDEN' ||
    code === 'NOT_FOUND'
  );
}

export function useQuickMatchDriverSession(options: UseQuickMatchDriverSessionOptions) {
  const {
    enabled,
    hasActiveTag,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    onMatched,
  } = options;

  const [status, setStatus] = useState<QuickMatchDriverSessionStatus>('idle');
  const [invite, setInvite] = useState<QuickMatchInvitePublic | null>(null);
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
  const inviteRef = useRef<QuickMatchInvitePublic | null>(null);
  const statusRef = useRef<QuickMatchDriverSessionStatus>('idle');
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
    (nextInvite: QuickMatchInvitePublic | null, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      setInvite(nextInvite);
      setPollErrorMessage(null);
      pollBackoffMsRef.current = pollIntervalMsRef.current;
      setStatus(sessionStatusFromInvite(nextInvite));
    },
    [],
  );

  const handlePollFailure = useCallback(
    (result: Extract<QuickMatchApiResult<unknown>, { ok: false }>, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.code === 'NETWORK' || result.code === 'SERVER' || result.code === 'PARSE') {
        setPollErrorMessage(result.message);
        pollBackoffMsRef.current = Math.min(
          pollBackoffMsRef.current * 2,
          MAX_POLL_BACKOFF_MS,
        );
        return;
      }

      if (isHardPollStopCode(result.code)) {
        stopPolling();
        if (result.code === 'NOT_FOUND') {
          offerSoundController.stopAllOfferLoops('qm_not_found');
          setInvite(null);
          setStatus('idle');
          setErrorMessage(null);
          setPollErrorMessage(null);
          return;
        }
        setStatus('error');
        setErrorMessage(result.message);
        setPollErrorMessage(null);
      }
    },
    [stopPolling],
  );

  const pollOnce = useCallback(
    async (generation: number) => {
      if (acceptInFlightRef.current || declineInFlightRef.current) {
        return;
      }
      if (!enabledRef.current || hasActiveTagRef.current) {
        return;
      }

      const iid = String(inviteRef.current?.invite_id || '').trim();
      if (!iid || statusRef.current !== 'pending') {
        return;
      }

      const result = await getCurrentQuickMatchInvite();
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
          !inviteRef.current?.invite_id ||
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
            inviteRef.current?.invite_id &&
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
        !inviteRef.current?.invite_id ||
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

    generationRef.current += 1;
    const generation = generationRef.current;

    setIsRestoring(true);
    setErrorMessage(null);
    setPollErrorMessage(null);
    setStatus('restoring');

    const result = await getCurrentQuickMatchInvite();

    if (!mountedRef.current || generation !== generationRef.current) {
      return;
    }

    setIsRestoring(false);

    if (result.ok === false) {
      stopPolling();
      setInvite(null);
      setStatus('error');
      setErrorMessage(result.message);
      return;
    }

    applyInvite(result.data, generation);
  }, [applyInvite, stopPolling]);

  const refresh = useCallback(async () => {
    if (!enabledRef.current || hasActiveTagRef.current) {
      return;
    }

    const iid = String(inviteRef.current?.invite_id || '').trim();
    if (!iid) {
      await restore();
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;

    const result = await getCurrentQuickMatchInvite();
    if (!mountedRef.current || generation !== generationRef.current) {
      return;
    }

    if (result.ok) {
      applyInvite(result.data, generation);
      return;
    }

    if (result.ok === false) {
      if (result.code === 'NOT_FOUND') {
        offerSoundController.stopAllOfferLoops('qm_not_found');
        stopPolling();
        setInvite(null);
        setStatus('idle');
        setErrorMessage(null);
        setPollErrorMessage(null);
        return;
      }

      if (isHardPollStopCode(result.code)) {
        stopPolling();
        setStatus('error');
        setErrorMessage(result.message);
        return;
      }

      setPollErrorMessage(result.message);
    }
  }, [applyInvite, restore, stopPolling]);

  const accept = useCallback(async (): Promise<boolean> => {
    const iid = String(inviteRef.current?.invite_id || '').trim();
    if (!iid || acceptInFlightRef.current) {
      return false;
    }

    acceptInFlightRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    offerSoundController.stopAllOfferLoops('qm_accept');
    stopPolling();
    setIsAccepting(true);
    setErrorMessage(null);

    let result: Awaited<ReturnType<typeof acceptQuickMatchInvite>>;
    try {
      result = await acceptQuickMatchInvite(iid);
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
      const refreshResult = await getCurrentQuickMatchInvite();
      if (
        refreshResult.ok &&
        mountedRef.current &&
        generation === generationRef.current
      ) {
        applyInvite(refreshResult.data, generation);
      }
      setErrorMessage(result.message);
      return false;
    }

    const tagId = String(result.data.tag?.tag_id || '').trim();
    setStatus('matched');
    stopPolling();
    if (tagId) {
      onMatchedRef.current(tagId, result.data);
    }
    return Boolean(tagId);
  }, [applyInvite, stopPolling]);

  const decline = useCallback(async (): Promise<boolean> => {
    const iid = String(inviteRef.current?.invite_id || '').trim();
    if (!iid || declineInFlightRef.current) {
      return false;
    }

    declineInFlightRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    offerSoundController.stopAllOfferLoops('qm_decline');
    stopPolling();
    setIsDeclining(true);
    setErrorMessage(null);

    let result: Awaited<ReturnType<typeof declineQuickMatchInvite>>;
    try {
      result = await declineQuickMatchInvite(iid);
    } finally {
      declineInFlightRef.current = false;
      if (mountedRef.current) {
        setIsDeclining(false);
      }
    }

    if (!mountedRef.current || generation !== generationRef.current) {
      return false;
    }

    if (result.ok === false) {
      const refreshResult = await getCurrentQuickMatchInvite();
      if (
        refreshResult.ok &&
        mountedRef.current &&
        generation === generationRef.current
      ) {
        applyInvite(refreshResult.data, generation);
        if (!refreshResult.data) {
          return true;
        }
      }
      setErrorMessage(result.message);
      return false;
    }

    setInvite(null);
    setStatus('idle');
    setPollErrorMessage(null);
    return true;
  }, [applyInvite, stopPolling]);

  const clear = useCallback(() => {
    offerSoundController.stopAllOfferLoops('qm_clear');
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
      !invite?.invite_id ||
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
    invite?.invite_id,
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
