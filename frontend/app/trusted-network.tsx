import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import TrustedNetworkHub from '../components/superUx/TrustedNetworkHub';
import TrustedDirectWaitingOverlay from '../components/superUx/TrustedDirectWaitingOverlay';
import { appAlert } from '../contexts/AppAlertContext';
import {
  useTrustedDirectPassengerSession,
  type TrustedDirectTerminalDeclinedPayload,
} from '../hooks/useTrustedDirectPassengerSession';
import {
  clearTrustedDirectRouteContext,
  fetchPassengerActiveTagForBootstrap,
  getTrustedDirectRouteContext,
  notifyTrustedDirectBootstrap,
  probeTrustedDirectAvailable,
  resolvePersistedPassengerUserId,
} from '../lib/trustedDirectApi';
import {
  formatTdmTerminalDeclinedAlert,
  TDM_TERMINAL_DECLINED_PRIMARY,
  TDM_TERMINAL_DECLINED_SECONDARY,
  type TrustedHubRole,
} from '../lib/trustedHubCopy';

function parseHubRole(raw: string | string[] | undefined): TrustedHubRole {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'driver' ? 'driver' : 'passenger';
}

export default function TrustedNetworkRoute() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const hubRole = parseHubRole(role);
  const router = useRouter();
  const routeContext = getTrustedDirectRouteContext();
  const [userId, setUserId] = useState<string | null>(null);
  const [hasActiveTag, setHasActiveTag] = useState(false);
  const [tdmEnabled, setTdmEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void resolvePersistedPassengerUserId().then(setUserId);
  }, []);

  useEffect(() => {
    if (hubRole !== 'passenger') {
      setTdmEnabled(null);
      return;
    }
    let cancelled = false;
    void probeTrustedDirectAvailable().then((available) => {
      if (!cancelled) setTdmEnabled(available);
    });
    return () => {
      cancelled = true;
    };
  }, [hubRole]);

  useEffect(() => {
    if (hubRole !== 'passenger' || !userId) return;
    let cancelled = false;
    void fetchPassengerActiveTagForBootstrap(userId).then((res) => {
      if (cancelled) return;
      setHasActiveTag(Boolean(res.ok && res.data));
    });
    return () => {
      cancelled = true;
    };
  }, [hubRole, userId]);

  const handleMatched = useCallback(
    (_tagId: string) => {
      clearTrustedDirectRouteContext();
      notifyTrustedDirectBootstrap();
      router.back();
    },
    [router],
  );

  const handleTerminalDeclined = useCallback(
    (payload: TrustedDirectTerminalDeclinedPayload) => {
      const { title, body } = formatTdmTerminalDeclinedAlert(payload.responderLabel);
      appAlert(
        title,
        body,
        [
          { text: TDM_TERMINAL_DECLINED_SECONDARY, style: 'cancel' },
          { text: TDM_TERMINAL_DECLINED_PRIMARY, style: 'default' },
        ],
        { tone: 'info' },
      );
    },
    [],
  );

  const tdmSession = useTrustedDirectPassengerSession({
    enabled: hubRole === 'passenger' && tdmEnabled === true && !!routeContext && !hasActiveTag,
    userId,
    routeContext,
    hasActiveTag,
    onMatched: handleMatched,
    onTerminalDeclined: handleTerminalDeclined,
  });

  const handleCancelWaiting = useCallback(() => {
    if (tdmSession.status === 'matching') {
      return;
    }
    void tdmSession.cancel();
  }, [tdmSession]);

  return (
    <>
      <TrustedNetworkHub
        role={hubRole}
        tdmEnabled={tdmEnabled}
        routeContext={routeContext}
        hasActiveTag={hasActiveTag}
        tdmSession={hubRole === 'passenger' ? tdmSession : null}
      />
      {hubRole === 'passenger' ? (
        <TrustedDirectWaitingOverlay
          visible={tdmSession.isWaitingVisible}
          phase={tdmSession.status}
          responderLabel={tdmSession.responderLabel}
          pollErrorMessage={tdmSession.pollErrorMessage}
          isCancelling={tdmSession.isCancelling}
          onCancel={handleCancelWaiting}
        />
      ) : null}
    </>
  );
}
