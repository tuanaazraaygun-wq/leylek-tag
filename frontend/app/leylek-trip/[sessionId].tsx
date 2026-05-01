import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_BASE_URL } from '../../lib/backendConfig';
import LeylekTripScreen from '../../components/LeylekTripScreen';

function normalizeMuhabbetRouteSessionId(value?: string | string[] | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const sid = String(raw || '').trim().toLowerCase();
  if (!sid || sid === 'undefined' || sid === 'null') return '';
  return sid;
}

export default function LeylekTripRoute() {
  const router = useRouter();
  const p = useLocalSearchParams<{ sessionId: string | string[] }>();
  const sessionId = normalizeMuhabbetRouteSessionId(p.sessionId);

  useEffect(() => {
    if (!sessionId) {
      Alert.alert(
        'Yolculuk',
        'Yolculuk oturumu hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin.'
      );
      router.back();
    }
  }, [sessionId, router]);

  if (!sessionId) return null;
  return <LeylekTripScreen apiBaseUrl={API_BASE_URL} sessionId={sessionId} />;
}
