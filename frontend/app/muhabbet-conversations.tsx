/**
 * Route: /muhabbet-conversations — sohbet listesi.
 */
import React from 'react';
import ConversationsScreen from '../components/ConversationsScreen';
import { API_BASE_URL } from '../lib/backendConfig';

export default function MuhabbetConversationsRoute() {
  return <ConversationsScreen apiBaseUrl={API_BASE_URL} />;
}
