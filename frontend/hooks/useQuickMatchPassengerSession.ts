import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  cancelQuickMatchRequest,
  createQuickMatchRequest,
  getActiveQuickMatchRequest,
  getQuickMatchRequestStatus,
  type CreateQuickMatchRequestPayload,
  type QuickMatchApiErrorCode,
  type QuickMatchApiResult,
  type QuickMatchRequestPublic,
  type QuickMatchRequestStatus,
  type QuickMatchValidationCode,
} from '../lib/quickMatchApi';

const DEFAULT_POLL_INTERVAL_MS = 2500;
const MAX_POLL_BACKOFF_MS = 10000;

export type QuickMatchPassengerSessionStatus =
  | 'idle'
  | 'restoring'
  | 'creating'
  | 'sequencing'
  | 'matched'
  | 'exhausted'
  | 'expired'
  | 'cancelled'
  | 'error';

export type QuickMatchPassengerTerminalStatus = 'exhausted' | 'expired' | 'cancelled';

export type UseQuickMatchPassengerSessionOptions = {
  enabled: boolean;
  hasActiveTag: boolean;
  pollIntervalMs?: number;
  onMatched: (matchedTagId: string) => void;
  onTerminal?: (status: QuickMatchPassengerTerminalStatus) => void;
};

function isTerminalRequestStatus(
  status: QuickMatchRequestStatus,
): status is QuickMatchPassengerTerminalStatus {
  return status === 'exhausted' || status === 'expired' || status === 'cancelled';
}

function sessionStatusFromRequest(
  request: QuickMatchRequestPublic,
): QuickMatchPassengerSessionStatus {
  if (request.status === 'matched') {
    return 'matched';
  }
  if (isTerminalRequestStatus(request.status)) {
    return request.status;
  }
  return 'sequencing';
}

function isHardPollStopCode(code: QuickMatchApiErrorCode): boolean {
  return (
    code === 'UNAVAILABLE' ||
    code === 'UNAUTH' ||
    code === 'FORBIDDEN' ||
    code === 'NOT_FOUND'
  );
}

function isSequencingRequestStatus(status: QuickMatchRequestStatus | null | undefined): boolean {
  return String(status || '').trim().toLowerCase() === 'sequencing';
}

function mapCreateErrorMessage(
  result: Extract<QuickMatchApiResult<unknown>, { ok: false }>,
): string {
  const raw = `${result.detail || ''} ${result.message || ''}`.toLowerCase();
  if (result.code === 'CONFLICT') {
    if (
      raw.includes('aktif quick match') ||
      raw.includes('active_quick_request') ||
      raw.includes('zaten var')
    ) {
      return 'Önceki hızlı eşleşme isteği kapatılamadı. Birkaç saniye sonra tekrar deneyin.';
    }
    return 'Hızlı eşleşme isteği şu an gönderilemiyor. Lütfen tekrar deneyin.';
  }
  if (result.code === 'NETWORK') {
    return 'Bağlantı hatası. Lütfen tekrar deneyin.';
  }
  if (result.code === 'SERVER' || result.code === 'UNAVAILABLE') {
    return 'Hızlı eşleşme şu an kullanılamıyor. Lütfen tekrar deneyin.';
  }
  return result.message || 'Hızlı eşleşme isteği gönderilemedi.';
}

function resetLocalSessionState(
  setters: {
    setRequest: (v: QuickMatchRequestPublic | null) => void;
    setErrorMessage: (v: string | null) => void;
    setValidationHint: (v: QuickMatchPassengerValidationHint | null) => void;
    setPollErrorMessage: (v: string | null) => void;
    setStatus: (v: QuickMatchPassengerSessionStatus) => void;
    setIsCreating: (v: boolean) => void;
    setIsCancelling: (v: boolean) => void;
    setIsRestoring: (v: boolean) => void;
  },
) {
  setters.setRequest(null);
  setters.setErrorMessage(null);
  setters.setValidationHint(null);
  setters.setPollErrorMessage(null);
  setters.setStatus('idle');
  setters.setIsCreating(false);
  setters.setIsCancelling(false);
  setters.setIsRestoring(false);
}

export type QuickMatchPassengerValidationHint = {
  code?: QuickMatchValidationCode;
  suggestedContributionTl?: number;
  maxContributionTl?: number;
};

export function useQuickMatchPassengerSession(options: UseQuickMatchPassengerSessionOptions) {
  const {
    enabled,
    hasActiveTag,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    onMatched,
    onTerminal,
  } = options;

  const [status, setStatus] = useState<QuickMatchPassengerSessionStatus>('idle');
  const [request, setRequest] = useState<QuickMatchRequestPublic | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationHint, setValidationHint] = useState<QuickMatchPassengerValidationHint | null>(
    null,
  );
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
  const pollBackoffMsRef = useRef(pollIntervalMs);
  const requestRef = useRef<QuickMatchRequestPublic | null>(null);
  const statusRef = useRef<QuickMatchPassengerSessionStatus>('idle');
  const prevEnabledRef = useRef(false);
  const prevHasActiveTagRef = useRef(false);
  const onMatchedRef = useRef(onMatched);
  const onTerminalRef = useRef(onTerminal);
  const enabledRef = useRef(enabled);
  const hasActiveTagRef = useRef(hasActiveTag);
  const pollIntervalMsRef = useRef(pollIntervalMs);

  useEffect(() => {
    onMatchedRef.current = onMatched;
    onTerminalRef.current = onTerminal;
    enabledRef.current = enabled;
    hasActiveTagRef.current = hasActiveTag;
    pollIntervalMsRef.current = pollIntervalMs;
  }, [onMatched, onTerminal, enabled, hasActiveTag, pollIntervalMs]);

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
    pollBackoffMsRef.current = pollIntervalMsRef.current;
  }, []);

  const applyRequest = useCallback(
    (nextRequest: QuickMatchRequestPublic, generation: number) => {
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      setRequest(nextRequest);
      setPollErrorMessage(null);
      pollBackoffMsRef.current = pollIntervalMsRef.current;

      const nextStatus = sessionStatusFromRequest(nextRequest);
      setStatus(nextStatus);

      if (nextRequest.status === 'matched') {
        const tagId = String(nextRequest.matched_tag_id || '').trim();
        if (tagId) {
          stopPolling();
          onMatchedRef.current(tagId);
        }
        return;
      }

      if (isTerminalRequestStatus(nextRequest.status)) {
        stopPolling();
        onTerminalRef.current?.(nextRequest.status);
      }
    },
    [stopPolling],
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
          setRequest(null);
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
      if (cancelInFlightRef.current || createInFlightRef.current) {
        return;
      }
      if (!enabledRef.current || hasActiveTagRef.current) {
        return;
      }

      const rid = String(requestRef.current?.request_id || '').trim();
      if (!rid || statusRef.current !== 'sequencing') {
        return;
      }

      const result = await getQuickMatchRequestStatus(rid);
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      if (result.ok) {
        applyRequest(result.data, generation);
        return;
      }

      if (result.ok === false) {
        handlePollFailure(result, generation);
      }
    },
    [applyRequest, handlePollFailure],
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
          statusRef.current !== 'sequencing' ||
          !requestRef.current?.request_id ||
          !appIsActive
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
            statusRef.current === 'sequencing' &&
            requestRef.current?.request_id &&
            appIsActive
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
        statusRef.current !== 'sequencing' ||
        !requestRef.current?.request_id ||
        !appIsActive
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

    const result = await getActiveQuickMatchRequest();

    if (!mountedRef.current || generation !== generationRef.current) {
      return;
    }

    setIsRestoring(false);

    if (result.ok === false) {
      stopPolling();
      setRequest(null);
      setStatus('error');
      setErrorMessage(result.message);
      return;
    }

    if (!result.data) {
      setRequest(null);
      setStatus('idle');
      return;
    }

    applyRequest(result.data, generation);
  }, [applyRequest, stopPolling]);

  const refresh = useCallback(async () => {
    if (!enabledRef.current || hasActiveTagRef.current) {
      return;
    }

    const rid = String(requestRef.current?.request_id || '').trim();
    if (!rid) {
      await restore();
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;

    const result = await getQuickMatchRequestStatus(rid);
    if (!mountedRef.current || generation !== generationRef.current) {
      return;
    }

    if (result.ok) {
      applyRequest(result.data, generation);
      return;
    }

    if (result.ok === false) {
      if (result.code === 'NOT_FOUND') {
        stopPolling();
        setRequest(null);
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
  }, [applyRequest, restore, stopPolling]);

  const resetLocal = useCallback(() => {
    resetLocalSessionState({
      setRequest,
      setErrorMessage,
      setValidationHint,
      setPollErrorMessage,
      setStatus,
      setIsCreating,
      setIsCancelling,
      setIsRestoring,
    });
  }, []);

  const releaseActiveRequest = useCallback(
    async (opts?: { bestEffort?: boolean }): Promise<boolean> => {
      const bestEffort = opts?.bestEffort !== false;

      if (cancelInFlightRef.current) {
        return bestEffort;
      }

      generationRef.current += 1;
      const generation = generationRef.current;
      stopPolling();

      let rid = String(requestRef.current?.request_id || '').trim();
      let reqStatus = requestRef.current?.status;

      if (!rid || !isSequencingRequestStatus(reqStatus)) {
        const active = await getActiveQuickMatchRequest();
        if (!mountedRef.current || generation !== generationRef.current) {
          return false;
        }
        if (active.ok && active.data && isSequencingRequestStatus(active.data.status)) {
          rid = String(active.data.request_id || '').trim();
          reqStatus = active.data.status;
        }
      }

      if (!rid || !isSequencingRequestStatus(reqStatus)) {
        resetLocal();
        return true;
      }

      cancelInFlightRef.current = true;
      setIsCancelling(true);
      setErrorMessage(null);

      const result = await cancelQuickMatchRequest(rid);

      cancelInFlightRef.current = false;
      if (!mountedRef.current || generation !== generationRef.current) {
        return false;
      }

      setIsCancelling(false);

      if (result.ok && !isSequencingRequestStatus(result.data.request.status)) {
        resetLocal();
        return true;
      }

      const statusResult = await getQuickMatchRequestStatus(rid);
      if (!mountedRef.current || generation !== generationRef.current) {
        return false;
      }

      if (statusResult.ok && !isSequencingRequestStatus(statusResult.data.status)) {
        resetLocal();
        return true;
      }

      if (bestEffort) {
        resetLocal();
        return false;
      }

      setErrorMessage('Hızlı eşleşme isteği iptal edilemedi. Lütfen tekrar deneyin.');
      return false;
    },
    [resetLocal, stopPolling],
  );

  const create = useCallback(
    async (payload: CreateQuickMatchRequestPayload) => {
      if (createInFlightRef.current) {
        return;
      }

      createInFlightRef.current = true;

      await releaseActiveRequest({ bestEffort: true });

      generationRef.current += 1;
      const generation = generationRef.current;

      stopPolling();
      setIsCreating(true);
      setErrorMessage(null);
      setValidationHint(null);
      setPollErrorMessage(null);
      setStatus('creating');

      const attemptCreate = () => createQuickMatchRequest(payload);

      let result = await attemptCreate();

      if (
        result.ok === false &&
        result.code === 'CONFLICT' &&
        (`${result.detail || ''} ${result.message || ''}`.toLowerCase().includes('aktif quick match') ||
          `${result.detail || ''} ${result.message || ''}`.toLowerCase().includes('active_quick'))
      ) {
        await releaseActiveRequest({ bestEffort: true });
        if (!mountedRef.current || generation !== generationRef.current) {
          createInFlightRef.current = false;
          return;
        }
        result = await attemptCreate();
      }

      createInFlightRef.current = false;
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }

      setIsCreating(false);

      if (result.ok === false) {
        setStatus('error');
        setErrorMessage(mapCreateErrorMessage(result));
        if (
          result.validationCode ||
          result.suggestedContributionTl != null ||
          result.maxContributionTl != null
        ) {
          setValidationHint({
            code: result.validationCode,
            suggestedContributionTl: result.suggestedContributionTl,
            maxContributionTl: result.maxContributionTl,
          });
        } else {
          setValidationHint(null);
        }
        return;
      }

      setValidationHint(null);
      applyRequest(result.data.request, generation);
    },
    [applyRequest, releaseActiveRequest, stopPolling],
  );

  const cancel = useCallback(async (): Promise<boolean> => {
    const rid = String(requestRef.current?.request_id || '').trim();
    if (!rid || cancelInFlightRef.current) {
      return false;
    }

    cancelInFlightRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;

    stopPolling();
    setIsCancelling(true);
    setErrorMessage(null);

    const result = await cancelQuickMatchRequest(rid);

    cancelInFlightRef.current = false;
    if (!mountedRef.current || generation !== generationRef.current) {
      return false;
    }

    setIsCancelling(false);

    if (result.ok === false) {
      const statusResult = await getQuickMatchRequestStatus(rid);
      if (
        statusResult.ok &&
        mountedRef.current &&
        generation === generationRef.current
      ) {
        applyRequest(statusResult.data, generation);
        return statusResult.data.status === 'cancelled';
      }
      setErrorMessage(result.message);
      return false;
    }

    applyRequest(result.data.request, generation);
    return result.data.request.status === 'cancelled';
  }, [applyRequest, stopPolling]);

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
        return;
      }
      if (
        enabledRef.current &&
        !hasActiveTagRef.current &&
        statusRef.current === 'sequencing' &&
        requestRef.current?.request_id
      ) {
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
      status !== 'sequencing' ||
      !request?.request_id ||
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
    request?.request_id,
    appIsActive,
    startPolling,
    stopPolling,
  ]);

  return {
    status,
    request,
    errorMessage,
    validationHint,
    pollErrorMessage,
    isCreating,
    isCancelling,
    isRestoring,
    isPolling,
    create,
    cancel,
    refresh,
    clear,
    releaseActiveRequest,
  };
}
