import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../../lib/backendConfig';
import MuhabbetChatScreen from '../../components/MuhabbetChatScreen';

export default function MuhabbetChatRoute() {
  const p = useLocalSearchParams<{
    conversationId: string | string[];
    n?: string | string[];
    ou?: string | string[];
  }>();
  const cidRaw = p.conversationId;
  const cid = Array.isArray(cidRaw) ? cidRaw[0] : cidRaw;
  const n = Array.isArray(p.n) ? p.n[0] : p.n;
  const ou = Array.isArray(p.ou) ? p.ou[0] : p.ou;
  if (!cid) return null;
  return (
    <MuhabbetChatScreen
      apiBaseUrl={API_BASE_URL}
      conversationId={String(cid)}
      titleName={n ? String(n) : undefined}
      otherUserId={ou ? String(ou) : undefined}
    />
  );
}
