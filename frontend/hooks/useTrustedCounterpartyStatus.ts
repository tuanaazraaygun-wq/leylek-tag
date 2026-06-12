import { useCallback, useEffect, useState } from 'react';
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

export function useTrustedCounterpartyStatus({
  counterpartyUserId,
  sourceTagId,
  enabled = true,
}: UseTrustedCounterpartyStatusArgs) {
  const [status, setStatus] = useState<TrustedCounterpartyUiStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cp = String(counterpartyUserId || '').trim();
  const tag = String(sourceTagId || '').trim();
  const canRun = enabled && !!cp && !!tag;

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
        setStatus('error');
        setErrorMessage('Güven ağı durumu okunamadı');
      }
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Yüklenemedi');
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
        if (e.code === 'already_pending' || e.code === 'already_active') {
          setStatus(e.code === 'already_active' ? 'active' : 'outgoing_pending');
          return;
        }
        setErrorMessage(e.message || 'Davet gönderilemedi');
        return;
      }
      setErrorMessage(e instanceof Error ? e.message : 'Davet gönderilemedi');
    } finally {
      setCreating(false);
    }
  }, [canRun, cp, tag, creating]);

  return {
    status,
    loading,
    creating,
    errorMessage,
    refresh,
    sendInvite,
  };
}
