import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TrustedNetworkHub from '../components/superUx/TrustedNetworkHub';
import type { TrustedHubRole } from '../lib/trustedHubCopy';

function parseHubRole(raw: string | string[] | undefined): TrustedHubRole {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'driver' ? 'driver' : 'passenger';
}

export default function TrustedNetworkRoute() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  return <TrustedNetworkHub role={parseHubRole(role)} />;
}
