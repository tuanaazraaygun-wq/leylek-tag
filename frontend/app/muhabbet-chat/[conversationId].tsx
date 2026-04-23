/**
 * Route: /muhabbet-chat/{conversationId}
 */
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../components/ChatScreen';
import { API_BASE_URL } from '../../lib/backendConfig';

export default function MuhabbetChatRoute() {
  const p = useLocalSearchParams<{
    conversationId?: string | string[];
    n?: string | string[];
    f?: string | string[];
    t?: string | string[];
  }>();
  const idRaw = p.conversationId;
  const id = (Array.isArray(idRaw) ? idRaw[0] : idRaw) || '';
  const n = (Array.isArray(p.n) ? p.n[0] : p.n) || '';
  const f = (Array.isArray(p.f) ? p.f[0] : p.f) || '';
  const t = (Array.isArray(p.t) ? p.t[0] : p.t) || '';

  return (
    <ChatScreen
      apiBaseUrl={API_BASE_URL}
      conversationId={id}
      initialOtherUserName={n}
      initialFromText={f}
      initialToText={t}
    />
  );
}
