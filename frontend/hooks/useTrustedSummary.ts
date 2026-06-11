import { useEffect, useState } from 'react';
import {
  getTrustedSummary,
  type TrustedSummaryResponse,
} from '../lib/trustedNetworkApi';

export type TrustedSummaryStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export function useTrustedSummary() {
  const [status, setStatus] = useState<TrustedSummaryStatus>('idle');
  const [summary, setSummary] = useState<TrustedSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      setSummary(null);
      try {
        const data = await getTrustedSummary();
        if (cancelled) return;
        setSummary(data);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[useTrustedSummary] unavailable', e);
        }
        setSummary(null);
        setStatus('unavailable');
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, summary };
}
