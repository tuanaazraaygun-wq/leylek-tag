import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import { useTrustedNetworkHub } from '../../hooks/useTrustedNetworkHub';
import { appAlert } from '../../contexts/AppAlertContext';
import { tapButtonHaptic } from '../../utils/touchHaptics';
import { PremiumText } from '../../design-system/primitives';
import { PremiumGradientCtaButton } from '../auth/premiumAuthChrome';
import {
  cancelTrustedDirectRequest,
  fetchSuggestedContributionTl,
  getActiveTrustedDirectRequest,
  isDriverVehicleCompatibleWithPreference,
  notifyTrustedDriverAvailability,
  type TrustedDirectNotifyTemplate,
  type TrustedDirectRequestRow,
  type TrustedDirectRouteContext,
} from '../../lib/trustedDirectApi';
import type { useTrustedDirectPassengerSession } from '../../hooks/useTrustedDirectPassengerSession';
import {
  resolveTdmDriverAvailability,
  type TrustedConnectionItem,
  type TdmDriverAvailability,
} from '../../lib/trustedNetworkApi';
import {
  globalEmptyBody,
  globalEmptyTitle,
  hubHeaderSubtitle,
  hubTitle,
  HUB_ERROR_BODY,
  HUB_ERROR_TITLE,
  SECTION_INCOMING_TITLE,
  SECTION_OUTGOING_TITLE,
  sectionConnectionsTitle,
  formatTrustedRadarBriefing,
  TDM_ACTIVE_TAG_BLOCK,
  TDM_CONTRIBUTION_CANCEL,
  TDM_CONTRIBUTION_CONFIRM,
  TDM_CONTRIBUTION_TITLE,
  TDM_NO_ROUTE_HINT,
  TDM_PENDING_BANNER,
  TDM_ROUTE_BANNER_TITLE,
  TDM_ORPHAN_CANCEL,
  TDM_ORPHAN_CLOSE,
  TDM_ORPHAN_PENDING_BODY,
  TDM_ORPHAN_PENDING_TITLE,
  TDM_ORPHAN_PICK_ROUTE,
  TDM_PENDING_ROW_HINT,
  TDM_REQUEST_BLOCKED_TITLE,
  TDM_UNAVAILABLE_HINT,
  TDM_VEHICLE_MISMATCH,
  TDM_NOTIFY_CANCEL,
  TDM_NOTIFY_FAILED,
  TDM_NOTIFY_OPTION_AVAILABLE,
  TDM_NOTIFY_OPTION_NEARBY,
  TDM_NOTIFY_RATE_LIMITED,
  TDM_NOTIFY_SEND,
  TDM_NOTIFY_SHEET_TITLE,
  TDM_NOTIFY_SUCCESS,
  type TrustedHubRole,
} from '../../lib/trustedHubCopy';
import TrustedConnectionRow from './TrustedConnectionRow';
import TrustedPendingRow from './TrustedPendingRow';
import TrustedRadarBriefingStrip from './TrustedRadarBriefingStrip';
import { useQrPaymentTrustTheme } from '../../lib/theme/useQrPaymentTrustTheme';

export type TrustedNetworkHubProps = {
  role: TrustedHubRole;
  tdmEnabled?: boolean | null;
  routeContext?: TrustedDirectRouteContext | null;
  hasActiveTag?: boolean;
  tdmSession?: Pick<
    ReturnType<typeof useTrustedDirectPassengerSession>,
    'hasPendingRequest' | 'isCreating' | 'errorMessage' | 'create' | 'dismissError'
  > | null;
};

type TdmRowGate = {
  disabled: boolean;
  eligible: boolean;
  statusLabel: string | null;
  helperMessage: string | null;
  availability: TdmDriverAvailability | null;
};

function isPendingResponderRequest(row: TrustedDirectRequestRow | null | undefined): boolean {
  return String(row?.status || '').trim().toLowerCase() === 'pending_responder';
}

function RouteContextBanner({ route }: { route: TrustedDirectRouteContext }) {
  const { trustSurfaces: trLt } = useQrPaymentTrustTheme('trust');
  return (
    <View style={[styles.routeBanner, trLt?.routeBanner]}>
      <Text style={[styles.routeBannerTitle, trLt?.routeBannerTitle]}>{TDM_ROUTE_BANNER_TITLE}</Text>
      <Text style={styles.routeBannerLine} numberOfLines={1}>
        {route.pickup_label} → {route.dropoff_label}
      </Text>
      {route.distance_km != null ? (
        <Text style={styles.routeBannerMeta}>{route.distance_km} km</Text>
      ) : null}
    </View>
  );
}

function HubSkeletonRows() {
  const { trustSurfaces: trLt } = useQrPaymentTrustTheme('trust');
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={[styles.skeletonRow, trLt?.skeletonRow]}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonTextCol}>
            <View style={styles.skeletonLineMain} />
            <View style={styles.skeletonLineSub} />
          </View>
        </View>
      ))}
    </View>
  );
}

function HubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { trustSurfaces: trLt } = useQrPaymentTrustTheme('trust');
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, trLt?.sectionTitle]}>{title}</Text>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

function TrustedNetworkHub({
  role,
  tdmEnabled = null,
  routeContext = null,
  hasActiveTag = false,
  tdmSession = null,
}: TrustedNetworkHubProps) {
  const { trustSurfaces: trLt, ui, isScopeLight } = useQrPaymentTrustTheme('trust');
  const router = useRouter();
  const {
    status,
    connections,
    incoming,
    outgoing,
    actingId,
    actionError,
    actionSuccess,
    acceptInvite,
    declineInvite,
    revokeConnection,
    clearActionFeedback,
  } = useTrustedNetworkHub();

  const [contributionTarget, setContributionTarget] = useState<TrustedConnectionItem | null>(
    null,
  );
  const [contributionTl, setContributionTl] = useState(0);
  const [minContributionTl, setMinContributionTl] = useState(0);
  const [maxContributionTl, setMaxContributionTl] = useState(0);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [orphanPending, setOrphanPending] = useState<TrustedDirectRequestRow | null>(null);
  const [orphanCancelling, setOrphanCancelling] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<TrustedConnectionItem | null>(null);
  const [notifyTemplate, setNotifyTemplate] = useState<TrustedDirectNotifyTemplate>('available_now');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyFeedback, setNotifyFeedback] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  const notifyTemplateOptions = useMemo(
    (): { id: TrustedDirectNotifyTemplate; label: string }[] => [
      { id: 'available_now', label: TDM_NOTIFY_OPTION_AVAILABLE },
      { id: 'nearby_ready', label: TDM_NOTIFY_OPTION_NEARBY },
    ],
    [],
  );

  const showTdmUi =
    role === 'passenger' && tdmEnabled === true && !!routeContext && !hasActiveTag;
  const tdmGloballyBlocked =
    role === 'passenger' && tdmEnabled === false && !!routeContext && !hasActiveTag;
  const tdmPendingBlocked = !!tdmSession?.hasPendingRequest;
  const showOrphanPendingPanel =
    role === 'passenger' &&
    !routeContext &&
    !hasActiveTag &&
    tdmEnabled !== false &&
    orphanPending != null &&
    !tdmPendingBlocked;

  useEffect(() => {
    if (
      role !== 'passenger' ||
      routeContext ||
      hasActiveTag ||
      tdmEnabled === false ||
      tdmPendingBlocked
    ) {
      setOrphanPending(null);
      return;
    }
    let cancelled = false;
    void getActiveTrustedDirectRequest().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data && isPendingResponderRequest(res.data)) {
        setOrphanPending(res.data);
      } else {
        setOrphanPending(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasActiveTag, role, routeContext, tdmEnabled, tdmPendingBlocked]);

  const handleOrphanCancel = useCallback(async () => {
    const rid = String(orphanPending?.id || '').trim();
    if (!rid || orphanCancelling) return;
    setOrphanCancelling(true);
    const result = await cancelTrustedDirectRequest(rid);
    setOrphanCancelling(false);
    if (result.ok) {
      setOrphanPending(null);
    }
  }, [orphanCancelling, orphanPending?.id]);

  const handleLeaveHubForRoute = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    if (!contributionTarget || !routeContext) {
      return;
    }
    let cancelled = false;
    setPriceLoading(true);
    setPriceError(null);
    void fetchSuggestedContributionTl(routeContext)
      .then((quote) => {
        if (cancelled) return;
        if (!quote) {
          setPriceError('Katkı payı hesaplanamadı.');
          setContributionTl(0);
          setMinContributionTl(0);
          setMaxContributionTl(0);
          return;
        }
        setContributionTl(quote.suggested);
        setMinContributionTl(quote.suggested);
        setMaxContributionTl(quote.max);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contributionTarget, routeContext]);

  const resolveTdmRowDisabled = useCallback(
    (item: TrustedConnectionItem): TdmRowGate => {
      if (!showTdmUi) {
        return {
          disabled: true,
          eligible: false,
          helperMessage: null,
          statusLabel: null,
          availability: null,
        };
      }
      if (tdmPendingBlocked) {
        return {
          disabled: true,
          eligible: false,
          helperMessage: TDM_PENDING_ROW_HINT,
          statusLabel: null,
          availability: null,
        };
      }
      const vehiclePref = routeContext?.vehicle_preference ?? 'car';
      const driverKind = item.counterparty.vehicle_kind;
      if (!isDriverVehicleCompatibleWithPreference(driverKind, vehiclePref)) {
        return {
          disabled: true,
          eligible: false,
          helperMessage: TDM_VEHICLE_MISMATCH,
          statusLabel: null,
          availability: null,
        };
      }

      const availability = resolveTdmDriverAvailability(item);
      if (!availability.eligible) {
        return {
          disabled: true,
          eligible: false,
          statusLabel: availability.statusLabel,
          helperMessage: null,
          availability,
        };
      }

      return {
        disabled: false,
        eligible: true,
        helperMessage: null,
        statusLabel: availability.statusLabel,
        availability,
      };
    },
    [routeContext?.vehicle_preference, showTdmUi, tdmPendingBlocked],
  );

  const contributionTargetFresh = useMemo(() => {
    if (!contributionTarget) return null;
    return (
      connections.find((c) => c.connection_id === contributionTarget.connection_id) ??
      contributionTarget
    );
  }, [connections, contributionTarget]);

  const contributionModalGate = useMemo((): TdmRowGate | null => {
    if (!contributionTargetFresh) return null;
    return resolveTdmRowDisabled(contributionTargetFresh);
  }, [contributionTargetFresh, resolveTdmRowDisabled]);

  const contributionConfirmBlocked =
    contributionModalGate != null &&
    (contributionModalGate.disabled || !contributionModalGate.eligible);

  const handleRequestDirectPress = useCallback(
    (item: TrustedConnectionItem) => {
      if (tdmPendingBlocked || !routeContext || !tdmSession) return;
      const gate = resolveTdmRowDisabled(item);
      if (gate.disabled || !gate.eligible) {
        if (gate.helperMessage) {
          appAlert(TDM_REQUEST_BLOCKED_TITLE, gate.helperMessage);
        }
        return;
      }
      setContributionTarget(item);
    },
    [resolveTdmRowDisabled, routeContext, tdmPendingBlocked, tdmSession],
  );

  const closeContributionModal = useCallback(() => {
    setContributionTarget(null);
    setPriceError(null);
  }, []);

  const handleNotifyPress = useCallback((item: TrustedConnectionItem) => {
    if (actingId != null) return;
    setNotifyTarget(item);
    setNotifyTemplate('available_now');
  }, [actingId]);

  const closeNotifySheet = useCallback(() => {
    if (notifySending) return;
    setNotifyTarget(null);
  }, [notifySending]);

  const handleConfirmNotify = useCallback(async () => {
    if (!notifyTarget || notifySending) return;
    const passengerId = String(notifyTarget.counterparty.user_id || '').trim();
    const connectionId = String(notifyTarget.connection_id || '').trim();
    if (!passengerId || !connectionId) return;

    setNotifySending(true);
    setNotifyFeedback(null);
    clearActionFeedback();
    const result = await notifyTrustedDriverAvailability({
      passenger_id: passengerId,
      relationship_connection_id: connectionId,
      message_template: notifyTemplate,
    });
    setNotifySending(false);

    if (result.ok === false) {
      const msg =
        result.message === TDM_NOTIFY_RATE_LIMITED ? TDM_NOTIFY_RATE_LIMITED : TDM_NOTIFY_FAILED;
      setNotifyFeedback({ error: msg });
      return;
    }

    setNotifyTarget(null);
    setNotifyFeedback({ success: TDM_NOTIFY_SUCCESS });
  }, [clearActionFeedback, notifySending, notifyTarget, notifyTemplate]);

  const handleConfirmContribution = useCallback(async () => {
    if (!contributionTarget || !routeContext || !tdmSession) return;

    const freshTarget =
      connections.find((c) => c.connection_id === contributionTarget.connection_id) ??
      contributionTarget;
    const gate = resolveTdmRowDisabled(freshTarget);
    if (gate.disabled || !gate.eligible) {
      if (gate.helperMessage) {
        appAlert(TDM_REQUEST_BLOCKED_TITLE, gate.helperMessage);
      }
      return;
    }

    const responderId = String(freshTarget.counterparty.user_id || '').trim();
    const connectionId = String(freshTarget.connection_id || '').trim();
    if (!responderId || !connectionId) return;

    const vehiclePref = routeContext.vehicle_preference ?? 'car';
    const created = await tdmSession.create(
      {
        responder_id: responderId,
        relationship_connection_id: connectionId,
        pickup_lat: routeContext.pickup_lat,
        pickup_lng: routeContext.pickup_lng,
        pickup_label: routeContext.pickup_label,
        dropoff_lat: routeContext.dropoff_lat,
        dropoff_lng: routeContext.dropoff_lng,
        dropoff_label: routeContext.dropoff_label,
        offered_contribution_tl: contributionTl,
        vehicle_preference: vehiclePref,
        idempotency_key: `tdm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
      {
        responderLabel: (freshTarget.counterparty.display_name || '').trim() || 'Sürücü',
      },
    );
    if (created) {
      closeContributionModal();
    }
  }, [
    closeContributionModal,
    connections,
    contributionTarget,
    contributionTl,
    resolveTdmRowDisabled,
    routeContext,
    tdmSession,
  ]);

  const title = hubTitle(role);
  const isReady = status === 'ready';
  const isLoading = status === 'loading' || status === 'idle';
  const isError = status === 'error';
  const actionsDisabled = actingId != null;

  const hasConnections = connections.length > 0;
  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;
  const hasAnyData = hasConnections || hasIncoming || hasOutgoing;
  const bannerError = actionError || notifyFeedback?.error || null;
  const bannerSuccess = actionSuccess || notifyFeedback?.success || null;
  const showActionBanner = isReady && (!!bannerError || !!bannerSuccess);

  const handleClearActionBanner = useCallback(() => {
    clearActionFeedback();
    setNotifyFeedback(null);
  }, [clearActionFeedback]);

  const displayConnections = useMemo(() => {
    if (role !== 'passenger') return connections;
    const hasAnyRadar = connections.some((c) => c.radar != null);
    const hasAnyTie = connections.some((c) => c.tie != null);
    if (!hasAnyRadar && !hasAnyTie) return connections;
    return [...connections]
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rankA =
          a.item.radar?.availability_rank != null &&
          Number.isFinite(Number(a.item.radar.availability_rank))
            ? Number(a.item.radar.availability_rank)
            : -1;
        const rankB =
          b.item.radar?.availability_rank != null &&
          Number.isFinite(Number(b.item.radar.availability_rank))
            ? Number(b.item.radar.availability_rank)
            : -1;
        if (rankB !== rankA) return rankB - rankA;
        const tieRankA =
          a.item.tie?.tie_rank != null && Number.isFinite(Number(a.item.tie.tie_rank))
            ? Number(a.item.tie.tie_rank)
            : -1;
        const tieRankB =
          b.item.tie?.tie_rank != null && Number.isFinite(Number(b.item.tie.tie_rank))
            ? Number(b.item.tie.tie_rank)
            : -1;
        if (tieRankB !== tieRankA) return tieRankB - tieRankA;
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [connections, role]);

  const radarBriefingText = useMemo(() => {
    if (role !== 'passenger') return null;
    const drivers = connections.filter((c) => c.role === 'driver');
    if (drivers.length === 0) return null;

    let eligibleCount = 0;
    let busyCount = 0;

    for (const item of drivers) {
      const availability = resolveTdmDriverAvailability(item);
      if (availability.eligible) {
        eligibleCount += 1;
      } else if (availability.uiState === 'busy') {
        busyCount += 1;
      }
    }

    return formatTrustedRadarBriefing({
      hasRadarData: true,
      readyCount: eligibleCount,
      onTripCount: busyCount,
      staleCount: 0,
      offlineCount: 0,
    });
  }, [connections, role]);

  const subtitle =
    isReady && hasAnyData
      ? hubHeaderSubtitle(role, connections.length, incoming.length, outgoing.length)
      : isReady
        ? hubHeaderSubtitle(role, 0, 0, 0)
        : isLoading
          ? 'Yükleniyor…'
          : '';

  return (
    <SafeAreaView style={[styles.root, trLt?.root]} edges={['top', 'left', 'right']}>
      {!isScopeLight ? (
        <LinearGradient
          colors={[PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(11, 18, 32, 0.98)']}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={[styles.header, trLt?.header]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, trLt?.backBtn, pressed && styles.hubBtnPressed]}
          onPress={() => {
            void tapButtonHaptic();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={20} color={ui.accent} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={[styles.title, trLt?.title]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, trLt?.subtitle]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {showActionBanner ? (
        <Pressable
          style={[
            styles.actionBanner,
            trLt?.actionBanner,
            bannerError ? styles.actionBannerError : styles.actionBannerSuccess,
            bannerError ? trLt?.actionBannerError : trLt?.actionBannerSuccess,
          ]}
          onPress={handleClearActionBanner}
          accessibilityRole="text"
        >
          <Ionicons
            name={bannerError ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={16}
            color={bannerError ? ui.errorIcon : ui.successBanner}
          />
          <Text
            style={[
              styles.actionBannerText,
              bannerError ? styles.actionBannerTextError : styles.actionBannerTextSuccess,
            ]}
            numberOfLines={2}
          >
            {bannerError || bannerSuccess}
          </Text>
        </Pressable>
      ) : null}

      {tdmSession?.errorMessage ? (
        <Pressable
          style={[styles.actionBanner, styles.actionBannerError, trLt?.actionBanner, trLt?.actionBannerError]}
          onPress={() => tdmSession.dismissError?.()}
          accessibilityRole="text"
        >
          <Ionicons name="alert-circle-outline" size={16} color={ui.errorIcon} />
          <Text style={[styles.actionBannerText, styles.actionBannerTextError]} numberOfLines={3}>
            {tdmSession.errorMessage}
          </Text>
        </Pressable>
      ) : null}

      {showOrphanPendingPanel ? (
        <View style={[styles.orphanPanel, trLt?.orphanPanel]}>
          <Text style={styles.orphanTitle}>{TDM_ORPHAN_PENDING_TITLE}</Text>
          <Text style={styles.orphanBody}>{TDM_ORPHAN_PENDING_BODY}</Text>
          <View style={styles.orphanActions}>
            <Pressable
              style={[styles.orphanBtn, styles.orphanBtnPrimary]}
              onPress={() => void handleOrphanCancel()}
              disabled={orphanCancelling}
            >
              {orphanCancelling ? (
                <ActivityIndicator size="small" color={ui.activity} />
              ) : (
                <Text style={styles.orphanBtnPrimaryText}>{TDM_ORPHAN_CANCEL}</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.orphanBtn}
              onPress={handleLeaveHubForRoute}
            >
              <Text style={styles.orphanBtnText}>{TDM_ORPHAN_PICK_ROUTE}</Text>
            </Pressable>
            <Pressable style={styles.orphanBtn} onPress={() => router.back()}>
              <Text style={styles.orphanBtnText}>{TDM_ORPHAN_CLOSE}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showTdmUi && tdmPendingBlocked ? (
        <View style={[styles.tdmPendingBanner, trLt?.tdmPendingBanner]}>
          <Ionicons name="time-outline" size={16} color={ui.accent} />
          <Text style={styles.tdmPendingBannerText}>{TDM_PENDING_BANNER}</Text>
        </View>
      ) : null}

      {tdmGloballyBlocked ? (
        <View style={[styles.tdmHintBanner, trLt?.tdmHintBanner]}>
          <Text style={styles.tdmHintBannerText}>{TDM_UNAVAILABLE_HINT}</Text>
        </View>
      ) : null}

      {role === 'passenger' && !routeContext && tdmEnabled !== false && !showOrphanPendingPanel ? (
        <View style={[styles.tdmHintBanner, trLt?.tdmHintBanner]}>
          <Text style={styles.tdmHintBannerText}>{TDM_NO_ROUTE_HINT}</Text>
        </View>
      ) : null}

      {hasActiveTag && role === 'passenger' && routeContext ? (
        <View style={[styles.tdmHintBanner, trLt?.tdmHintBanner]}>
          <Text style={styles.tdmHintBannerText}>{TDM_ACTIVE_TAG_BLOCK}</Text>
        </View>
      ) : null}

      {showTdmUi && routeContext ? <RouteContextBanner route={routeContext} /> : null}

      {isLoading ? (
        <HubSkeletonRows />
      ) : isError ? (
        <View style={[styles.errorPanel, trLt?.errorPanel]}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={28} color={ui.accent} />
          </View>
          <Text style={styles.errorTitle}>{HUB_ERROR_TITLE}</Text>
          <Text style={styles.errorBody}>{HUB_ERROR_BODY}</Text>
        </View>
      ) : isReady && !hasAnyData ? (
        <View style={[styles.emptyPanel, trLt?.emptyPanel]}>
          <Text style={styles.emptyEmoji}>🦢</Text>
          <Text style={styles.emptyTitle}>{globalEmptyTitle(role)}</Text>
          <Text style={styles.emptyBody}>{globalEmptyBody(role)}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {hasConnections ? (
            <HubSection title={sectionConnectionsTitle(role)}>
              {radarBriefingText ? (
                <TrustedRadarBriefingStrip text={radarBriefingText} />
              ) : null}
              {displayConnections.map((item) => {
                const tdmRow = resolveTdmRowDisabled(item);
                return (
                  <View key={item.connection_id} style={styles.connectionWrap}>
                    <TrustedConnectionRow
                      item={item}
                      hubRole={role}
                      actingId={actingId}
                      actionsDisabled={actionsDisabled || tdmPendingBlocked}
                      onRevoke={revokeConnection}
                      tdmRequestVisible={showTdmUi && item.role === 'driver'}
                      tdmRequestDisabled={tdmRow.disabled}
                      tdmRequestBusy={tdmSession?.isCreating === true}
                      tdmAvailability={tdmRow.availability}
                      onRequestDirect={showTdmUi ? handleRequestDirectPress : undefined}
                      notifyPassengerVisible={role === 'driver' && item.role === 'passenger'}
                      notifyPassengerDisabled={actionsDisabled}
                      notifyPassengerBusy={
                        notifySending && notifyTarget?.connection_id === item.connection_id
                      }
                      onNotifyPassenger={role === 'driver' ? handleNotifyPress : undefined}
                    />
                    {showTdmUi && item.role === 'driver' && tdmRow.helperMessage ? (
                      <Text style={styles.tdmRowHint}>{tdmRow.helperMessage}</Text>
                    ) : null}
                  </View>
                );
              })}
            </HubSection>
          ) : null}

          {hasIncoming ? (
            <HubSection title={SECTION_INCOMING_TITLE}>
              {incoming.map((item) => (
                <TrustedPendingRow
                  key={item.invite_id}
                  item={item}
                  direction="incoming"
                  actingId={actingId}
                  actionsDisabled={actionsDisabled}
                  onAccept={acceptInvite}
                  onDecline={declineInvite}
                />
              ))}
            </HubSection>
          ) : null}

          {hasOutgoing ? (
            <HubSection title={SECTION_OUTGOING_TITLE}>
              {outgoing.map((item) => (
                <TrustedPendingRow
                  key={item.invite_id}
                  item={item}
                  direction="outgoing"
                  actingId={actingId}
                  actionsDisabled={actionsDisabled}
                />
              ))}
            </HubSection>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={contributionTarget != null}
        animationType="slide"
        transparent
        onRequestClose={closeContributionModal}
      >
        <View style={[styles.modalBackdrop, trLt?.modalBackdrop]}>
          <View style={[styles.modalCard, trLt?.modalCard]}>
            <Text style={[styles.modalTitle, trLt?.modalTitle]}>{TDM_CONTRIBUTION_TITLE}</Text>
            {priceLoading ? (
              <ActivityIndicator size="small" color={ui.activity} />
            ) : (
              <>
                <View style={styles.stepperRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.stepperBtn,
                      trLt?.stepperBtn,
                      pressed && !(contributionTl <= minContributionTl) && styles.hubBtnPressed,
                    ]}
                    onPress={() => {
                      void tapButtonHaptic();
                      setContributionTl((v) => Math.max(minContributionTl, v - 10));
                    }}
                    disabled={contributionTl <= minContributionTl}
                  >
                    <Ionicons name="remove" size={22} color={ui.accent} />
                  </Pressable>
                  <Text style={styles.stepperValue}>{contributionTl} ₺</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.stepperBtn,
                      trLt?.stepperBtn,
                      pressed && !(contributionTl >= maxContributionTl) && styles.hubBtnPressed,
                    ]}
                    onPress={() => {
                      void tapButtonHaptic();
                      setContributionTl((v) => Math.min(maxContributionTl, v + 10));
                    }}
                    disabled={contributionTl >= maxContributionTl}
                  >
                    <Ionicons name="add" size={22} color={ui.accent} />
                  </Pressable>
                </View>
                {priceError ? (
                  <PremiumText variant="caption" style={styles.modalError}>
                    {priceError}
                  </PremiumText>
                ) : null}
                {contributionConfirmBlocked && contributionModalGate?.helperMessage ? (
                  <PremiumText variant="caption" style={styles.modalError}>
                    {contributionModalGate.helperMessage}
                  </PremiumText>
                ) : null}
                {tdmSession?.errorMessage ? (
                  <PremiumText variant="caption" style={styles.modalError}>
                    {tdmSession.errorMessage}
                  </PremiumText>
                ) : null}
              </>
            )}
            <PremiumGradientCtaButton
              label={TDM_CONTRIBUTION_CONFIRM}
              onPress={() => void handleConfirmContribution()}
              disabled={
                priceLoading ||
                contributionTl <= 0 ||
                tdmSession?.isCreating === true ||
                !!priceError ||
                contributionConfirmBlocked
              }
              busy={tdmSession?.isCreating === true}
            />
            <Pressable
              style={({ pressed }) => [
                styles.modalCancelBtn,
                trLt?.modalCancelBtn,
                pressed && styles.hubBtnPressed,
              ]}
              onPress={() => {
                void tapButtonHaptic();
                closeContributionModal();
              }}
            >
              <Text style={[styles.modalCancelText, trLt?.modalCancelText]}>{TDM_CONTRIBUTION_CANCEL}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={notifyTarget != null}
        animationType="slide"
        transparent
        onRequestClose={closeNotifySheet}
      >
        <View style={[styles.modalBackdrop, trLt?.modalBackdrop]}>
          <View style={[styles.modalCard, trLt?.modalCard]}>
            <Text style={[styles.modalTitle, trLt?.modalTitle]}>{TDM_NOTIFY_SHEET_TITLE}</Text>
            <View style={styles.notifyOptions}>
              {notifyTemplateOptions.map((opt) => {
                const selected = notifyTemplate === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [
                      styles.notifyOption,
                      trLt?.stepperBtn,
                      selected && styles.notifyOptionSelected,
                      pressed && !notifySending && styles.hubBtnPressed,
                    ]}
                    onPress={() => {
                      void tapButtonHaptic();
                      setNotifyTemplate(opt.id);
                    }}
                    disabled={notifySending}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? ui.accent : ui.textMuted}
                    />
                    <Text
                      style={[
                        styles.notifyOptionText,
                        trLt?.notifyOptionText,
                        selected && styles.notifyOptionTextSelected,
                        selected && trLt?.notifyOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <PremiumGradientCtaButton
              label={TDM_NOTIFY_SEND}
              onPress={() => void handleConfirmNotify()}
              disabled={notifySending}
              busy={notifySending}
            />
            <Pressable
              style={({ pressed }) => [
                styles.modalCancelBtn,
                trLt?.modalCancelBtn,
                pressed && !notifySending && styles.hubBtnPressed,
              ]}
              onPress={() => {
                void tapButtonHaptic();
                closeNotifySheet();
              }}
              disabled={notifySending}
            >
              <Text style={[styles.modalCancelText, trLt?.modalCancelText]}>{TDM_NOTIFY_CANCEL}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default memo(TrustedNetworkHub);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 18,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBannerSuccess: {
    backgroundColor: 'rgba(6, 78, 59, 0.22)',
    borderColor: 'rgba(52, 211, 153, 0.32)',
  },
  actionBannerError: {
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    borderColor: 'rgba(248, 113, 113, 0.32)',
  },
  actionBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionBannerTextSuccess: {
    color: 'rgba(167, 243, 208, 0.95)',
  },
  actionBannerTextError: {
    color: 'rgba(252, 165, 165, 0.95)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.95)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionList: {
    gap: 8,
  },
  connectionWrap: {
    gap: 4,
  },
  tdmRowHint: {
    marginLeft: 14,
    marginRight: 14,
    fontSize: 11,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 15,
  },
  tdmRowStatus: {
    marginLeft: 14,
    marginRight: 14,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  tdmRowStatusReady: {
    color: PREMIUM_AUTH_CYAN,
  },
  tdmRowStatusMuted: {
    color: PREMIUM_TEXT_MUTED,
  },
  orphanPanel: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 47, 73, 0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.28)',
    gap: 10,
  },
  orphanTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
  },
  orphanBody: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 18,
  },
  orphanActions: {
    gap: 8,
  },
  orphanBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    backgroundColor: 'rgba(16, 26, 43, 0.72)',
  },
  orphanBtnPrimary: {
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
  },
  orphanBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: PREMIUM_TEXT_MUTED,
  },
  orphanBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(252, 165, 165, 0.92)',
  },
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 26, 43, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
  },
  skeletonTextCol: {
    flex: 1,
    gap: 8,
  },
  skeletonLineMain: {
    height: 12,
    width: '58%',
    borderRadius: 6,
    backgroundColor: 'rgba(30, 58, 95, 0.5)',
  },
  skeletonLineSub: {
    height: 10,
    width: '36%',
    borderRadius: 5,
    backgroundColor: 'rgba(30, 58, 95, 0.38)',
  },
  errorPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 10,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 36,
    lineHeight: 42,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  routeBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 47, 73, 0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.22)',
    gap: 4,
  },
  routeBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(148, 163, 184, 0.95)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  routeBannerLine: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  routeBannerMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
  },
  tdmPendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 47, 73, 0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  tdmPendingBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    lineHeight: 18,
  },
  tdmHintBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 26, 43, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  tdmHintBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 11, 24, 0.72)',
  },
  modalCard: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: PREMIUM_NAVY_CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
  },
  stepperValue: {
    minWidth: 88,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
  },
  modalError: {
    color: 'rgba(252, 165, 165, 0.92)',
    textAlign: 'center',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_TEXT_MUTED,
  },
  notifyOptions: {
    gap: 8,
  },
  notifyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
  },
  notifyOptionSelected: {
    borderColor: 'rgba(34, 211, 238, 0.42)',
  },
  notifyOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 20,
  },
  notifyOptionTextSelected: {
    color: PREMIUM_TEXT_SOFT,
    fontWeight: '700',
  },
  hubBtnPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
