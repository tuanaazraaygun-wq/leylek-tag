import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../../lib/backendConfig';
import LeylekTripScreen from '../../components/LeylekTripScreen';

export default function LeylekTripRoute() {
  const p = useLocalSearchParams<{ sessionId: string | string[] }>();
  const raw = p.sessionId;
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  if (!sessionId) return null;
  return <LeylekTripScreen apiBaseUrl={API_BASE_URL} sessionId={String(sessionId)} />;
}
