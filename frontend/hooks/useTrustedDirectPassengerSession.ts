import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  cancelTrustedDirectRequest,
  createTrustedDirectRequest,
  fetchPassengerActiveTagForBootstrap,
  getActiveTrustedDirectRequest,
  getLatestTrustedDirectRequest,
  mapTdmUserFacingError,
  TDM_MATCHING_TIMEOUT_MS,
  TDM_POLL_INTERVAL_MS,
  type CreateTrustedDirectRequestPayload,
  type TrustedDirectApiErrorCode,
  type TrustedDirectApiResult,
  type TrustedDirectRequestRow,
  type TrustedDirectRouteContext,
} from '../lib/trustedDirectApi';
import {
  TDM_MATCHING_TIMEOUT,
  TDM_TERMINAL_EXPIRED,
} from '../lib/trustedHubCopy';

const TDM_ACCEPT_GRACE_MS = TDM_POLL_INTERVAL_MS;

export type TrustedDirectTerminalDeclinedPayload = {
  reason: 'declined';
  responderLabel: string | null;
};

function maxMatchingPollsForInterval(pollIntervalMs: number): number {
  return Math.max(1, Math.ceil(TDM_MATCHING_TIMEOUT_MS / pollIntervalMs));
}

export type TrustedDirectPassengerSessionStatus =
  | 'idle'
  | 'restoring'
  | 'creating'
  | 'pending'
  | 'matching'
  | 'error';

export type UseTrustedDirectPassengerSessionOptions = {
  enabled: boolean;
  userId: string | null;
  routeContext: TrustedDirectRouteContext | null;
  hasActiveTag: boolean;
  pollIntervalMs?: number;
  onMatched: (tagId: string) => void;
  onTerminalDeclined?: (payload: TrustedDirectTerminalDeclinedPayload) => void;
};

function isPendingResponderStatus(status: string | null | undefined): boolean {
  return String(status || '').trim().toLowerCase() === 'pending_responder';
}

function isAcceptedRequestStatus(status: string | null | undefined): boolean {
  return String(status || '').trim().toLowerCase() === 'accepted';
}

function isHardPollStopCode(code: TrustedDirectApiErrorCode): boolean {
  return code === 'UNAVAILABLE' || code === 'UNAUTH' || code === 'FORBIDDEN';
}

function mapCreateErrorMessage(
  result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>,
): string {
  return mapTdmUserFacingError(result);
}

function userFacingPollError(
  result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>,
): string {
  return mapTdmUserFacingError(result);
}

export function useTrustedDirectPassengerSession(
  options: UseTrustedDirectPassengerSessionOptions,
) {
  const {
    enabled,
    userId,
    routeContext,
    hasActiveTag,
    pollIntervalMs = TDM_POLL_INTERVAL_MS,
    onMatched,
    onTerminalDeclined,
  } = options;

  const [status, setStatus] = useState<TrustedDirectPassengerSessionStatus>('idle');
  const [request, setRequest] = useState<TrustedDirectRequestRow | null>(null);
  const [responderLabel, setResponderLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollErrorMessage, setPollErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [appIsActive, setAppIsActive] = useState(
    () => AppState.currentState === 'active',
  );

  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const createInFlightRef = useRef(false);
  const cancelInFlightRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchingPollCountRef = useRef(0);
  const requestRef = useRef<TrustedDirectRequestRow | null>(null);
  const statusRef = useRef<TrustedDirectPassengerSessionStatus>('idle');
  const userIdRef = useRef(userId);
  const enabledRef = useRef(enabled);
  const hasActiveTagRef = useRef(hasActiveTag);
  const pollIntervalMsRef = useRef(pollIntervalMs);
  const onMatchedRef = useRef(onMatched);
  const onTerminalDeclinedRef = useRef(onTerminalDeclined);
  const responderLabelRef = useRef<string | null>(null);
  const terminalNotifiedRef = useRef(false);
  const prevEnabledRef = useRef(false);
  const prevHasActiveTagRef = useRef(false);

  useEffect(() => {
    userIdRef.current = userId;
    enabledRef.current = enabled;
    hasActiveTagRef.current = hasActiveTag;
    pollIntervalMsRef.current = pollIntervalMs;
    onMatchedRef.current = onMatched;
    onTerminalDeclinedRef.current = onTerminalDeclined;
  }, [userId, enabled, hasActiveTag, pollIntervalMs, onMatched, onTerminalDeclined]);

  useEffect(() => {
    responderLabelRef.current = responderLabel;
  }, [responderLabel]);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
    matchingPollCountRef.current = 0;
  }, []);

  const resetLocal = useCallback(() => {
    setRequest(null);
    setResponderLabel(null);
    setErrorMessage(null);
    setPollErrorMessage(null);
    setStatus('idle');
    setIsCreating(false);
    setIsCancelling(false);
    setIsRestoring(false);
    terminalNotifiedRef.current = false;
  }, []);

  const finishTerminalDeclined = useCallback(
    (generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      if (terminalNotifiedRef.current) {
        return;
      }
      terminalNotifiedRef.current = true;
      stopPolling();
      const label = responderLabelRef.current?.trim() || null;
      onTerminalDeclinedRef.current?.({ reason: 'declined', responderLabel: label });
      resetLocal();
    },
    [resetLocal, stopPolling],
  );

  const finishTerminal = useCallback(
    (message: string, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      stopPolling();
      setRequest(null);
      setResponderLabel(null);
      setPollErrorMessage(null);
      setIsCreating(false);
      setIsCancelling(false);
      setIsRestoring(false);
      setStatus('idle');
      setErrorMessage(message);
    },
    [stopPolling],
  );

  const finishMatchingTimeout = useCallback(
    (generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      stopPolling();
      setRequest(null);
      setResponderLabel(null);
      setPollErrorMessage(null);
      setIsCreating(false);
      setIsCancelling(false);
      setIsRestoring(false);
      setStatus('idle');
      setErrorMessage(TDM_MATCHING_TIMEOUT);
    },
    [stopPolling],
  );

  const finishTerminalCancelled = useCallback(
    (generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      stopPolling();
      resetLocal();
    },
    [resetLocal, stopPolling],
  );

  const enterMatchingPhase = useCallback(
    (generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      matchingPollCountRef.current = 0;
      setPollErrorMessage(null);
      setStatus('matching');
    },
    [],
  );

  const handleMatchedTag = useCallback(
    (tagId: string, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      stopPolling();
      resetLocal();
      onMatchedRef.current(tagId);
    },
    [resetLocal, stopPolling],
  );

  const applyRequestOutcome = useCallback(
    (nextRequest: TrustedDirectRequestRow, generation: number): boolean => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return true;
      }

      setRequest(nextRequest);
      setPollErrorMessage(null);

      const st = String(nextRequest.status || '').trim().toLowerCase();

      if (isPendingResponderStatus(st)) {
        setStatus('pending');
        return true;
      }

      if (st === 'declined') {
        finishTerminalDeclined(generation);
        return true;
      }

      if (st === 'expired') {
        finishTerminal(TDM_TERMINAL_EXPIRED, generation);
        return true;
      }

      if (st === 'cancelled') {
        finishTerminalCancelled(generation);
        return true;
      }

      if (isAcceptedRequestStatus(st)) {
        const tagId = String(nextRequest.matched_tag_id || '').trim();
        if (tagId) {
          handleMatchedTag(tagId, generation);
          return true;
        }
        enterMatchingPhase(generation);
        return true;
      }

      return false;
    },
    [
      enterMatchingPhase,
      finishTerminal,
      finishTerminalCancelled,
      finishTerminalDeclined,
      handleMatchedTag,
    ],
  );

  const applyPendingRequest = useCallback(
    (nextRequest: TrustedDirectRequestRow, generation: number) => {
      applyRequestOutcome(nextRequest, generation);
    },
    [applyRequestOutcome],
  );

  const handleLatestPollFailure = useCallback(
    (
      result: Extract<TrustedDirectApiResult<unknown>, { ok: false }>,
      generation: number,
    ): 'retry' | 'abort' => {
      if (result.code === 'NETWORK' || result.code === 'SERVER' || result.code === 'PARSE') {
        setPollErrorMessage(userFacingPollError(result));
        return 'retry';
      }
      if (isHardPollStopCode(result.code)) {
        stopPolling();
        setStatus('error');
        setErrorMessage(mapTdmUserFacingError(result));
        return 'abort';
      }
      return 'retry';
    },
    [stopPolling],
  );

  const resolveLatestRequestOutcome = useCallback(
    async (generation: number): Promise<'handled' | 'retry' | 'continue'> => {
      const scopedId = String(requestRef.current?.id || '').trim() || undefined;
      const latestResult = await getLatestTrustedDirectRequest(scopedId);
      if (!mountedRef.current || generation !== generationRef.current) {
        return 'handled';
      }

      if (latestResult.ok === false) {
        return handleLatestPollFailure(latestResult, generation);
      }

      if (!latestResult.data) {
        return 'continue';
      }

      if (scopedId && latestResult.data.id !== scopedId) {
        return 'continue';
      }

      const handled = applyRequestOutcome(latestResult.data, generation);
      return handled ? 'handled' : 'continue';
    },
    [applyRequestOutcome, handleLatestPollFailure],
  );

  const probePendingAbsentOutcome = useCallback(
    async (generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      if (hasActiveTagRef.current) {
        stopPolling();
        return;
      }

      const uid = String(userIdRef.current || '').trim();
      if (!uid) {
        return;
      }

      const checkTag = async (): Promise<'abort' | 'retry' | string | null> => {
        const tagResult = await fetchPassengerActiveTagForBootstrap(uid);
        if (!mountedRef.current || generation !== generationRef.current) {
          return 'abort';
        }
        if (tagResult.ok === false) {
          if (
            tagResult.code === 'NETWORK' ||
            tagResult.code === 'SERVER' ||
            tagResult.code === 'PARSE'
          ) {
            setPollErrorMessage(userFacingPollError(tagResult));
            return 'retry';
          }
          if (isHardPollStopCode(tagResult.code)) {
            stopPolling();
            setStatus('error');
            setErrorMessage(mapTdmUserFacingError(tagResult));
            return 'abort';
          }
          return null;
        }
        const tagId = String(tagResult.data?.id || '').trim();
        return tagId || null;
      };

      const tagIdFirst = await checkTag();
      if (tagIdFirst === 'abort' || tagIdFirst === 'retry') {
        return;
      }
      if (typeof tagIdFirst === 'string' && tagIdFirst) {
        handleMatchedTag(tagIdFirst, generation);
        return;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, TDM_ACCEPT_GRACE_MS);
      });
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      const tagIdGrace = await checkTag();
      if (tagIdGrace === 'abort' || tagIdGrace === 'retry') {
        return;
      }
      if (typeof tagIdGrace === 'string' && tagIdGrace) {
        handleMatchedTag(tagIdGrace, generation);
        return;
      }

      const activeResult = await getActiveTrustedDirectRequest();
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (activeResult.ok === false) {
        if (
          activeResult.code === 'NETWORK' ||
          activeResult.code === 'SERVER' ||
          activeResult.code === 'PARSE'
        ) {
          setPollErrorMessage(userFacingPollError(activeResult));
          return;
        }
        if (isHardPollStopCode(activeResult.code)) {
          stopPolling();
          setStatus('error');
          setErrorMessage(mapTdmUserFacingError(activeResult));
        }
        return;
      }

      if (activeResult.data) {
        applyPendingRequest(activeResult.data, generation);
        return;
      }

      const latestOutcome = await resolveLatestRequestOutcome(generation);
      if (latestOutcome === 'handled' || latestOutcome === 'retry') {
        return;
      }

      enterMatchingPhase(generation);
    },
    [
      applyPendingRequest,
      enterMatchingPhase,
      handleMatchedTag,
      resolveLatestRequestOutcome,
      stopPolling,
    ],
  );

  const pollPendingOnce = useCallback(
    async (generation: number) => {
      const result = await getActiveTrustedDirectRequest();
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.ok === false) {
        if (result.code === 'NETWORK' || result.code === 'SERVER' || result.code === 'PARSE') {
          setPollErrorMessage(userFacingPollError(result));
          return;
        }
        if (isHardPollStopCode(result.code)) {
          stopPolling();
          setStatus('error');
          setErrorMessage(mapTdmUserFacingError(result));
        }
        return;
      }

      if (!result.data) {
        await probePendingAbsentOutcome(generation);
        return;
      }

      applyPendingRequest(result.data, generation);
    },
    [applyPendingRequest, probePendingAbsentOutcome, stopPolling],
  );

  const pollMatchingOnce = useCallback(
    async (generation: number) => {
      const uid = String(userIdRef.current || '').trim();
      if (!uid) {
        stopPolling();
        setStatus('error');
        setErrorMessage('Oturum bulunamadı');
        return;
      }

      const result = await fetchPassengerActiveTagForBootstrap(uid);
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.ok === false) {
        if (result.code === 'NETWORK' || result.code === 'SERVER' || result.code === 'PARSE') {
          setPollErrorMessage(userFacingPollError(result));
          return;
        }
        if (isHardPollStopCode(result.code)) {
          stopPolling();
          setStatus('error');
          setErrorMessage(mapTdmUserFacingError(result));
        }
        return;
      }

      if (result.data?.id) {
        handleMatchedTag(result.data.id, generation);
        return;
      }

      const latestOutcome = await resolveLatestRequestOutcome(generation);
      if (latestOutcome === 'handled' || latestOutcome === 'retry') {
        return;
      }

      matchingPollCountRef.current += 1;
      if (matchingPollCountRef.current >= maxMatchingPollsForInterval(pollIntervalMsRef.current)) {
        finishMatchingTimeout(generation);
      }
    },
    [finishMatchingTimeout, handleMatchedTag, resolveLatestRequestOutcome, stopPolling],
  );

  const schedulePollTick = useCallback(
    (generation: number) => {
      if (pollTimerRef.current != null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      pollTimerRef.current = setTimeout(() => {
        pollTimerRef.current = null;
        if (!mountedRef.current || generation !== generationRef.current) {
          return;
        }
        if (
          !enabledRef.current ||
          hasActiveTagRef.current ||
          !appIsActive ||
          (statusRef.current !== 'pending' && statusRef.current !== 'matching')
        ) {
          setIsPolling(false);
          return;
        }

        setIsPolling(true);
        const poll =
          statusRef.current === 'pending' ? pollPendingOnce : pollMatchingOnce;
        void poll(generation).finally(() => {
          if (!mountedRef.current || generation !== generationRef.current) {
            return;
          }
          if (
            enabledRef.current &&
            !hasActiveTagRef.current &&
            appIsActive &&
            (statusRef.current === 'pending' || statusRef.current === 'matching')
          ) {
            schedulePollTick(generation);
          } else {
            setIsPolling(false);
          }
        });
      }, pollIntervalMsRef.current);
    },
    [appIsActive, pollMatchingOnce, pollPendingOnce],
  );

  const startPolling = useCallback(
    (generation: number) => {
      if (
        !enabledRef.current ||
        hasActiveTagRef.current ||
        !appIsActive ||
        (statusRef.current !== 'pending' && statusRef.current !== 'matching')
      ) {
        stopPolling();
        return;
      }
      setIsPolling(true);
      schedulePollTick(generation);
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

    const result = await getActiveTrustedDirectRequest();

    if (!mountedRef.current || generation !== generationRef.current) {
      return;
    }

    setIsRestoring(false);

    if (result.ok === false) {
      if (result.code === 'UNAVAILABLE') {
        resetLocal();
        return;
      }
      stopPolling();
      setRequest(null);
      setStatus('error');
      setErrorMessage(mapTdmUserFacingError(result));
      return;
    }

    if (!result.data) {
      resetLocal();
      return;
    }

    applyPendingRequest(result.data, generation);
  }, [applyPendingRequest, resetLocal, stopPolling]);

  const create = useCallback(
    async (
      payload: CreateTrustedDirectRequestPayload,
      opts?: { responderLabel?: string },
    ): Promise<boolean> => {
      if (createInFlightRef.current) {
        return false;
      }
      if (
        statusRef.current !== 'idle' &&
        statusRef.current !== 'error' &&
        statusRef.current !== 'restoring'
      ) {
        setErrorMessage('Zaten bekleyen bir isteğiniz var.');
        return false;
      }

      createInFlightRef.current = true;

      const active = await getActiveTrustedDirectRequest();
      if (!mountedRef.current) {
        createInFlightRef.current = false;
        return false;
      }
      if (active.ok && active.data && isPendingResponderStatus(active.data.status)) {
        createInFlightRef.current = false;
        applyPendingRequest(active.data, generationRef.current);
        setErrorMessage('Zaten bekleyen bir isteğiniz var.');
        return false;
      }

      generationRef.current += 1;
      const generation = generationRef.current;

      stopPolling();
      setIsCreating(true);
      setErrorMessage(null);
      setPollErrorMessage(null);
      setStatus('creating');
      if (opts?.responderLabel?.trim()) {
        setResponderLabel(opts.responderLabel.trim());
      }

      const result = await createTrustedDirectRequest(payload);

      createInFlightRef.current = false;
      if (!mountedRef.current || generation !== generationRef.current) {
        return false;
      }

      setIsCreating(false);

      if (result.ok === false) {
        setStatus('error');
        setErrorMessage(mapCreateErrorMessage(result));
        return false;
      }

      applyPendingRequest(result.data, generation);
      return true;
    },
    [applyPendingRequest, stopPolling],
  );

  const dismissWaiting = useCallback(
    (generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return false;
      }
      stopPolling();
      resetLocal();
      return true;
    },
    [resetLocal, stopPolling],
  );

  const cancel = useCallback(async (): Promise<boolean> => {
    if (cancelInFlightRef.current) {
      return false;
    }

    const rid = String(requestRef.current?.id || '').trim();
    const phase = statusRef.current;

    if ((phase === 'matching' || phase === 'pending') && !rid) {
      generationRef.current += 1;
      return dismissWaiting(generationRef.current);
    }

    if (!rid) {
      return false;
    }

    cancelInFlightRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    stopPolling();
    setIsCancelling(true);
    setErrorMessage(null);

    const result = await cancelTrustedDirectRequest(rid);

    cancelInFlightRef.current = false;
    if (!mountedRef.current || generation !== generationRef.current) {
      return false;
    }

    setIsCancelling(false);

    if (result.ok === false) {
      if (phase === 'matching') {
        return dismissWaiting(generation);
      }
      setErrorMessage(mapTdmUserFacingError(result));
      return false;
    }

    resetLocal();
    return true;
  }, [dismissWaiting, resetLocal, stopPolling]);

  const clear = useCallback(() => {
    generationRef.current += 1;
    stopPolling();
    resetLocal();
  }, [resetLocal, stopPolling]);

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
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [stopPolling]);

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
    prevEnabledRef.current = enabled;
    prevHasActiveTagRef.current = hasActiveTag;

    if (enabledTurnedOn || activeTagCleared) {
      void restore();
    }
  }, [enabled, hasActiveTag, restore, stopPolling]);

  useEffect(() => {
    if (
      !enabled ||
      hasActiveTag ||
      (status !== 'pending' && status !== 'matching') ||
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
  }, [enabled, hasActiveTag, status, appIsActive, startPolling, stopPolling]);

  const isWaitingVisible =
    status === 'creating' || status === 'pending' || status === 'matching';
  const hasPendingRequest =
    status === 'creating' || status === 'pending' || status === 'matching';

  return {
    status,
    request,
    responderLabel,
    routeContext,
    errorMessage,
    pollErrorMessage,
    isCreating,
    isCancelling,
    isRestoring,
    isPolling,
    isWaitingVisible,
    hasPendingRequest,
    create,
    cancel,
    clear,
    restore,
    dismissError: () => setErrorMessage(null),
  };
}
