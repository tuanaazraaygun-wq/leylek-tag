import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getOrCreateSocket } from '../contexts/SocketContext';
import {
  subscribeTrustedInviteHubRefresh,
  type TrustedInviteSocketPayload,
} from '../lib/trustedInviteRealtimeEvents';
import {
  acceptTrustedInvite,
  declineTrustedInvite,
  getTrustedConnections,
  getTrustedPending,
  revokeTrustedConnection,
  TrustedNetworkApiError,
  type TrustedConnectionItem,
  type TrustedPendingItem,
} from '../lib/trustedNetworkApi';
import { ACTION_FAILED, ACTION_SUCCESS } from '../lib/trustedHubCopy';

export type TrustedNetworkHubStatus = 'idle' | 'loading' | 'ready' | 'error';

type LoadOptions = {
  soft?: boolean;
};

export function useTrustedNetworkHub() {
  const [status, setStatus] = useState<TrustedNetworkHubStatus>('idle');
  const [connections, setConnections] = useState<TrustedConnectionItem[]>([]);
  const [incoming, setIncoming] = useState<TrustedPendingItem[]>([]);
  const [outgoing, setOutgoing] = useState<TrustedPendingItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(async (cancelledRef: { current: boolean }, options?: LoadOptions) => {
    const soft = options?.soft === true;
    if (!soft) {
      setStatus('loading');
      setErrorMessage(null);
      setConnections([]);
      setIncoming([]);
      setOutgoing([]);
    }

    try {
      const [connectionsRes, pendingRes] = await Promise.all([
        getTrustedConnections(),
        getTrustedPending(),
      ]);
      if (cancelledRef.current) return;

      setConnections(Array.isArray(connectionsRes.connections) ? connectionsRes.connections : []);
      setIncoming(Array.isArray(pendingRes.incoming) ? pendingRes.incoming : []);
      setOutgoing(Array.isArray(pendingRes.outgoing) ? pendingRes.outgoing : []);
      setStatus('ready');
    } catch (e) {
      if (cancelledRef.current) return;
      const msg = e instanceof Error ? e.message : 'Güven ağı bilgisi alınamadı';
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[useTrustedNetworkHub] error', e);
      }
      if (!soft) {
        setConnections([]);
        setIncoming([]);
        setOutgoing([]);
        setErrorMessage(msg);
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    void load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const refresh = useCallback(
    (options?: LoadOptions) => {
      const cancelledRef = { current: false };
      void load(cancelledRef, options);
      return () => {
        cancelledRef.current = true;
      };
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      refresh({ soft: true });
    }, [refresh]),
  );

  useEffect(() => {
    return subscribeTrustedInviteHubRefresh(() => {
      refresh({ soft: true });
    });
  }, [refresh]);

  useEffect(() => {
    const socket = getOrCreateSocket();
    let debounceId: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounceId) {
        clearTimeout(debounceId);
      }
      debounceId = setTimeout(() => {
        refresh({ soft: true });
      }, 400);
    };

    const onTrustedInviteSocket = (_data: TrustedInviteSocketPayload) => {
      scheduleRefresh();
    };

    socket.on('trusted_invite_received', onTrustedInviteSocket);
    socket.on('trusted_invite_updated', onTrustedInviteSocket);

    return () => {
      if (debounceId) {
        clearTimeout(debounceId);
      }
      socket.off('trusted_invite_received', onTrustedInviteSocket);
      socket.off('trusted_invite_updated', onTrustedInviteSocket);
    };
  }, [refresh]);

  const runMutation = useCallback(
    async (id: string, mutate: () => Promise<unknown>) => {
      const targetId = String(id || '').trim();
      if (!targetId || actingId) return;

      setActingId(targetId);
      setActionError(null);
      setActionSuccess(null);

      try {
        await mutate();
        setActionSuccess(ACTION_SUCCESS);
        refresh({ soft: true });
      } catch (e) {
        const msg =
          e instanceof TrustedNetworkApiError
            ? e.message || ACTION_FAILED
            : e instanceof Error
              ? e.message
              : ACTION_FAILED;
        setActionError(msg.trim() || ACTION_FAILED);
        refresh({ soft: true });
      } finally {
        setActingId(null);
      }
    },
    [actingId, refresh],
  );

  const acceptInvite = useCallback(
    (inviteId: string) => runMutation(inviteId, () => acceptTrustedInvite(inviteId)),
    [runMutation],
  );

  const declineInvite = useCallback(
    (inviteId: string) => runMutation(inviteId, () => declineTrustedInvite(inviteId)),
    [runMutation],
  );

  const revokeConnection = useCallback(
    (connectionId: string) => runMutation(connectionId, () => revokeTrustedConnection(connectionId)),
    [runMutation],
  );

  const clearActionFeedback = useCallback(() => {
    setActionError(null);
    setActionSuccess(null);
  }, []);

  return {
    status,
    connections,
    incoming,
    outgoing,
    errorMessage,
    actingId,
    actionError,
    actionSuccess,
    refresh,
    acceptInvite,
    declineInvite,
    revokeConnection,
    clearActionFeedback,
  };
}
