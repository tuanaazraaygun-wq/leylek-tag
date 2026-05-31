import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTripPaymentDetails,
  type TripPaymentDetailsResponse,
} from '../lib/tripPaymentApi';

export function useTripPaymentDetails() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<TripPaymentDetailsResponse | null>(null);
  const mountedRef = useRef(true);

  const clear = useCallback(() => {
    setLoading(false);
    setError(null);
    setDetails(null);
  }, []);

  const load = useCallback(async (tagId: string, userId: string) => {
    setLoading(true);
    setError(null);
    setDetails(null);

    const result = await fetchTripPaymentDetails(tagId, userId);
    if (!mountedRef.current) return;

    setLoading(false);
    if (result.ok) {
      setDetails(result.data);
      setError(null);
      return;
    }

    setDetails(null);
    setError(result.message);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setLoading(false);
      setError(null);
      setDetails(null);
    };
  }, []);

  return { loading, error, details, load, clear };
}
