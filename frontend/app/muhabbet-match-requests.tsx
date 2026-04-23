import React from 'react';
import { API_BASE_URL } from '../lib/backendConfig';
import MatchRequestsScreen from '../components/MatchRequestsScreen';

export default function MuhabbetMatchRequestsRoute() {
  return <MatchRequestsScreen apiBaseUrl={API_BASE_URL} />;
}
