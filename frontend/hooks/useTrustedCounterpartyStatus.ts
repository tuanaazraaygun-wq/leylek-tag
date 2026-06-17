import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  createTrustedInvite,
  getTrustedStatus,
  TrustedNetworkApiError,
  type TrustedPairStatus,
} from '../lib/trustedNetworkApi';

export type TrustedCounterpartyUiStatus =
  | 'idle'
  | 'loading'
  | 'none'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'active'
  | 'declined'
  | 'blocked'
  | 'error';

type UseTrustedCounterpartyStatusArgs = {
  counterpartyUserId: string | null | undefined;
  sourceTagId: string | null | undefined;
  enabled?: boolean;
  /** Hub accept/decline sonrası geri dönüşte GET /trusted/status yenile */
  refetchOnScreenFocus?: boolean;
  /** Periyodik GET /trusted/status; 0 veya undefined = kapalı */
  pollIntervalMs?: number;
};

function isTrustedPairStatus(value: string): value is TrustedPairStatus {
  return (
    value === 'none' ||
    value === 'outgoing_pending' ||
    value === 'incoming_pending' ||
    value === 'active' ||
    value === 'declined' ||
    value === 'blocked'
  );
}

function isKnownTrustedUiStatus(status: TrustedCounterpartyUiStatus): boolean {
  return (
    status === 'active' ||
    status === 'outgoing_pending' ||
    status === 'incoming_pending' ||
    status === 'blocked'
  );
}

/** GET fail — bilinen pair state korunur; aksi halde invite CTA için none. */
function failSoftStatus(prev: TrustedCounterpartyUiStatus): TrustedCounterpartyUiStatus {
  if (isKnownTrustedUiStatus(prev)) {
    return prev;
  }
  return 'none';
}

function maskTrustIdForLog(value: string): string {
  const s = String(value || '').trim();
  if (!s) return 'n/a';
  if (s.length <= 8) return `***${s.slice(-2)}`;
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

export function useTrustedCounterpartyStatus({
  counterpartyUserId,
  sourceTagId,
  enabled = true,
  refetchOnScreenFocus = false,
  pollIntervalMs = 0,
}: UseTrustedCounterpartyStatusArgs) {
  const [status, setStatus] = useState<TrustedCounterpartyUiStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cp = String(counterpartyUserId || '').trim();
  const tag = String(sourceTagId || '').trim();
  const canRun = enabled && !!cp && !!tag;
  const pollMs =
    typeof pollIntervalMs === 'number' && pollIntervalMs > 0 ? pollIntervalMs : 0;

  const refresh = useCallback(async () => {
    if (!canRun) {
      setStatus('idle');
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getTrustedStatus(cp);
      const next = String(data.status || '').trim();
      if (isTrustedPairStatus(next)) {
        setStatus(next);
      } else {
        setStatus((prev) => failSoftStatus(prev));
        setErrorMessage(null);
      }
    } catch {
      setStatus((prev) => failSoftStatus(prev));
      setErrorMessage(null);
    } finally {
      setLoading(false);
    }
  }, [canRun, cp]);

  useEffect(() => {
    if (!canRun) {
      setStatus('idle');
      setErrorMessage(null);
      setLoading(false);
      setCreating(false);
      return;
    }
    void refresh();
  }, [canRun, cp, tag, refresh]);

  useFocusEffect(
    useCallback(() => {
      if (!refetchOnScreenFocus || !canRun) return;
      void refresh();
    }, [refetchOnScreenFocus, canRun, refresh]),
  );

  useEffect(() => {
    if (!canRun || pollMs <= 0) {
      return undefined;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let appActive = AppState.currentState === 'active';

    const stopInterval = () => {
      if (intervalId == null) {
        return;
      }
      clearInterval(intervalId);
      intervalId = null;
    };

    const startInterval = () => {
      if (intervalId != null || !appActive) {
        return;
      }
      intervalId = setInterval(() => {
        if (!appActive) {
          return;
        }
        void refresh();
      }, pollMs);
    };

    const onAppStateChange = (next: AppStateStatus) => {
      appActive = next === 'active';
      if (appActive) {
        startInterval();
        return;
      }
      stopInterval();
    };

    startInterval();
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      stopInterval();
      sub.remove();
    };
  }, [canRun, pollMs, refresh]);

  const sendInvite = useCallback(async () => {
    if (!canRun || creating) return;

    setCreating(true);
    setErrorMessage(null);
    try {
      await createTrustedInvite({
        counterparty_user_id: cp,
        source_tag_id: tag,
      });
      setStatus('outgoing_pending');
    } catch (e) {
      if (e instanceof TrustedNetworkApiError) {
        console.warn(
          'TRUST_INVITE_POST_FAIL',
          JSON.stringify({
            code: e.code,
            httpStatus: e.httpStatus,
            detail: e.message,
            sourceTagId: maskTrustIdForLog(tag),
            counterpartyUserId: maskTrustIdForLog(cp),
          }),
        );
        if (e.code === 'already_pending' || e.code === 'already_active') {
          if (e.code === 'already_active') {
            setStatus('active');
          } else {
            void refresh();
          }
          return;
        }
        if (e.code === 'blocked' || e.code === 'counterparty_not_eligible') {
          setStatus('blocked');
          return;
        }
        setErrorMessage(e.message || 'Davet gönderilemedi');
        return;
      }
      console.warn(
        'TRUST_INVITE_POST_FAIL',
        JSON.stringify({
          code: 'unknown',
          httpStatus: null,
          detail: e instanceof Error ? e.message : String(e),
          sourceTagId: maskTrustIdForLog(tag),
          counterpartyUserId: maskTrustIdForLog(cp),
        }),
      );
      setErrorMessage(e instanceof Error ? e.message : 'Davet gönderilemedi');
    } finally {
      setCreating(false);
    }
  }, [canRun, cp, tag, creating, refresh]);

  return {
    status,
    loading,
    creating,
    errorMessage,
    refresh,
    sendInvite,
  };
}
