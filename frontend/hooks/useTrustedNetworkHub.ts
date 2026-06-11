import { useCallback, useEffect, useState } from 'react';
import {
  getTrustedConnections,
  getTrustedPending,
  type TrustedConnectionItem,
  type TrustedPendingItem,
} from '../lib/trustedNetworkApi';

export type TrustedNetworkHubStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useTrustedNetworkHub() {
  const [status, setStatus] = useState<TrustedNetworkHubStatus>('idle');
  const [connections, setConnections] = useState<TrustedConnectionItem[]>([]);
  const [incoming, setIncoming] = useState<TrustedPendingItem[]>([]);
  const [outgoing, setOutgoing] = useState<TrustedPendingItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (cancelledRef: { current: boolean }) => {
    setStatus('loading');
    setErrorMessage(null);
    setConnections([]);
    setIncoming([]);
    setOutgoing([]);

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
      setConnections([]);
      setIncoming([]);
      setOutgoing([]);
      setErrorMessage(msg);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    void load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const refresh = useCallback(() => {
    const cancelledRef = { current: false };
    void load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return {
    status,
    connections,
    incoming,
    outgoing,
    errorMessage,
    refresh,
  };
}
