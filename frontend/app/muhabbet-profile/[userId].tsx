import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../../lib/backendConfig';
import ProfileScreen from '../../components/ProfileScreen';

export default function MuhabbetProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string | string[] }>();
  const id = Array.isArray(userId) ? userId[0] : userId;
  if (!id) return null;
  return <ProfileScreen apiBaseUrl={API_BASE_URL} userId={String(id)} />;
}
