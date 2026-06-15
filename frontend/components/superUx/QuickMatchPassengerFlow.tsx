import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_AUTH_CTA_GRADIENT,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import type { useQuickMatchPassengerSession } from '../../hooks/useQuickMatchPassengerSession';

import { API_BASE_URL } from '../../lib/backendConfig';

const CONTRIBUTION_STEP_TL = 10;
const QUICK_MATCH_MAX_DISTANCE_KM = 20;
const CONTRIBUTION_GUARD_MESSAGE = 'Önerilen katkı payının altına inilemez.';

export type QuickMatchRouteContext = {
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_label: string;
  distance_km?: number | null;
  vehicle_preference?: 'car' | 'motorcycle' | null;
};

export type QuickMatchPassengerSessionView = Pick<
  ReturnType<typeof useQuickMatchPassengerSession>,
  | 'status'
  | 'request'
  | 'errorMessage'
  | 'validationHint'
  | 'pollErrorMessage'
  | 'isCreating'
  | 'isCancelling'
  | 'isRestoring'
  | 'isPolling'
  | 'create'
  | 'cancel'
  | 'refresh'
  | 'clear'
>;

async function fetchNormalMatchSuggestedContribution(
  route: QuickMatchRouteContext,
): Promise<{ suggested: number; max: number; roadDistanceKm: number | null } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/price/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        pickup_lat: route.pickup_lat,
        pickup_lng: route.pickup_lng,
        dropoff_lat: route.dropoff_lat,
        dropoff_lng: route.dropoff_lng,
        passenger_vehicle_kind: route.vehicle_preference ?? 'car',
      }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      success?: boolean;
      suggested_price?: number;
      trip_distance_km?: number;
      distance_km?: number;
      route_distance_km?: number;
    };
    if (!data.success || data.suggested_price == null) {
      return null;
    }
    const suggested = Math.round(Number(data.suggested_price));
    if (!Number.isFinite(suggested) || suggested <= 0) {
      return null;
    }
    const roadDistanceKm = parsePricingRoadDistanceKm(data);
    return { suggested, max: suggested * 2, roadDistanceKm };
  } catch {
    return null;
  }
}

/** /price/calculate yol mesafesi — QM 20 km guard backend ile aynı kaynak. */
function parsePricingRoadDistanceKm(data: {
  trip_distance_km?: number;
  distance_km?: number;
  route_distance_km?: number;
}): number | null {
  for (const key of ['trip_distance_km', 'distance_km', 'route_distance_km'] as const) {
    const n = Number(data[key]);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return null;
}

export type QuickMatchPassengerFlowProps = {
  visible: boolean;
  route: QuickMatchRouteContext | null;
  session: QuickMatchPassengerSessionView;
  onClose: () => void;
  onRetry?: () => void;
  onGoNormalMatch?: () => void;
};

function isDistanceTooFarForQuickMatch(distanceKm: number | null | undefined): boolean {
  const km = Number(distanceKm);
  return Number.isFinite(km) && km > QUICK_MATCH_MAX_DISTANCE_KM;
}

function formatDistanceKm(km: number | null | undefined): string | null {
  const n = Number(km);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return `${n.toFixed(1)} km`;
}

function resetQuickMatchPricingLocalState(setters: {
  setContributionTl: (v: number) => void;
  setMinContributionTl: (v: number) => void;
  setMaxContributionTl: (v: number) => void;
  setPricingRoadDistanceKm: (v: number | null) => void;
  setPriceError: (v: string | null) => void;
  setCreateGuardMessage: (v: string | null) => void;
}) {
  setters.setContributionTl(0);
  setters.setMinContributionTl(0);
  setters.setMaxContributionTl(0);
  setters.setPricingRoadDistanceKm(null);
  setters.setPriceError(null);
  setters.setCreateGuardMessage(null);
}

function FlowHeader({
  onClose,
  closeDisabled,
}: {
  onClose: () => void | Promise<void>;
  closeDisabled?: boolean;
}) {
  return (
    <View style={styles.headerRow}>
      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.headerIconOrb}>
        <Ionicons name="flash-outline" size={22} color={PREMIUM_AUTH_CYAN} />
      </GlassSurface>
      <View style={styles.headerTextCol}>
        <GlassSurface variant="plain" borderRadius={LDS_RADIUS.full} style={styles.guardianChip}>
          <Ionicons name="compass-outline" size={14} color="rgba(34,211,238,0.82)" />
          <PremiumText variant="caption" style={styles.guardianChipText}>
            Hızlı eşleşme
          </PremiumText>
        </GlassSurface>
        <PremiumText variant="step" style={styles.headerTitle}>
          Yakın sürücülerle eşleş
        </PremiumText>
        <PremiumText variant="caption" muted style={styles.headerSubtitle}>
          Rota hazırsa isteğinizi gönderebilirsiniz
        </PremiumText>
      </View>
      <Pressable
        onPress={() => void onClose()}
        disabled={closeDisabled}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        accessibilityState={{ disabled: Boolean(closeDisabled) }}
        hitSlop={12}
        style={({ pressed }) => [
          styles.closeBtn,
          closeDisabled && styles.closeBtnDisabled,
          pressed && !closeDisabled && styles.closeBtnPressed,
        ]}
      >
        <Ionicons
          name="close"
          size={24}
          color={closeDisabled ? PREMIUM_TEXT_MUTED : PREMIUM_AUTH_CYAN}
        />
      </Pressable>
    </View>
  );
}

function RouteSummaryCard({
  pickupLabel,
  dropoffLabel,
  distanceKm,
  contributionTl,
}: {
  pickupLabel: string;
  dropoffLabel: string;
  distanceKm?: number | null;
  contributionTl?: number | null;
}) {
  const distanceText = formatDistanceKm(distanceKm);
  return (
    <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.glassCard}>
      <View style={styles.routeRow}>
        <Ionicons name="radio-button-on" size={14} color={PREMIUM_AUTH_CYAN} />
        <PremiumText variant="body" style={styles.routeLabel} numberOfLines={2}>
          {pickupLabel}
        </PremiumText>
      </View>
      <View style={styles.routeConnector} />
      <View style={styles.routeRow}>
        <Ionicons name="location" size={14} color={PREMIUM_AUTH_CYAN} />
        <PremiumText variant="body" style={styles.routeLabel} numberOfLines={2}>
          {dropoffLabel}
        </PremiumText>
      </View>
      {distanceText || contributionTl != null ? (
        <View style={styles.routeMetaRow}>
          {distanceText ? (
            <PremiumText variant="caption" style={styles.routeMetaText}>
              {distanceText}
            </PremiumText>
          ) : null}
          {contributionTl != null ? (
            <PremiumText variant="caption" style={styles.routeMetaText}>
              {contributionTl} TL katkı payı
            </PremiumText>
          ) : null}
        </View>
      ) : null}
    </GlassSurface>
  );
}

function ProgressDots() {
  return (
    <View style={styles.dotsRow} accessibilityLabel="Uygun sürücüler değerlendiriliyor">
      <View style={[styles.dot, styles.dotActive]} />
      <View style={[styles.dot, styles.dotMid]} />
      <View style={styles.dot} />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      style={({ pressed }) => [
        styles.primaryBtnOuter,
        (disabled || loading) && styles.primaryBtnDisabled,
        pressed && !disabled && !loading && styles.primaryBtnPressed,
      ]}
    >
      <LinearGradient
        colors={
          disabled || loading
            ? ['rgba(30, 58, 95, 0.65)', 'rgba(16, 26, 43, 0.85)']
            : [...PREMIUM_AUTH_CTA_GRADIENT]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtnGradient}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#F8FAFF" />
        ) : (
          <PremiumText variant="body" style={styles.primaryBtnText}>
            {label}
          </PremiumText>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.secondaryBtnWrap,
        disabled && styles.secondaryBtnDisabled,
        pressed && !disabled && styles.secondaryBtnPressed,
      ]}
    >
      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.secondaryBtn}>
        <PremiumText variant="body" muted={disabled} style={styles.secondaryBtnText}>
          {label}
        </PremiumText>
      </GlassSurface>
    </Pressable>
  );
}

export function QuickMatchPassengerFlow({
  visible,
  route,
  session,
  onClose,
  onRetry,
  onGoNormalMatch,
}: QuickMatchPassengerFlowProps) {
  const [contributionTl, setContributionTl] = useState(0);
  const [minContributionTl, setMinContributionTl] = useState(0);
  const [maxContributionTl, setMaxContributionTl] = useState(0);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pricingRoadDistanceKm, setPricingRoadDistanceKm] = useState<number | null>(null);
  const [createGuardMessage, setCreateGuardMessage] = useState<string | null>(null);
  const awaitingCreateResultRef = useRef(false);

  const guardDistanceKm = useMemo(() => {
    if (pricingRoadDistanceKm != null && Number.isFinite(pricingRoadDistanceKm)) {
      return pricingRoadDistanceKm;
    }
    if (
      typeof session.request?.distance_km === 'number' &&
      Number.isFinite(session.request.distance_km) &&
      session.request.distance_km > 0
    ) {
      return session.request.distance_km;
    }
    return route?.distance_km ?? null;
  }, [pricingRoadDistanceKm, session.request?.distance_km, route?.distance_km]);

  const distanceTooFar = useMemo(
    () => isDistanceTooFarForQuickMatch(guardDistanceKm),
    [guardDistanceKm],
  );

  useEffect(() => {
    if (!route || !visible) {
      return;
    }
    resetQuickMatchPricingLocalState({
      setContributionTl,
      setMinContributionTl,
      setMaxContributionTl,
      setPricingRoadDistanceKm,
      setPriceError,
      setCreateGuardMessage,
    });
    let cancelled = false;
    setPriceLoading(true);
    void fetchNormalMatchSuggestedContribution(route).then((pricing) => {
      if (cancelled) {
        return;
      }
      setPriceLoading(false);
      if (!pricing) {
        setPriceError('Önerilen katkı payı hesaplanamadı. Lütfen tekrar deneyin.');
        return;
      }
      setPricingRoadDistanceKm(pricing.roadDistanceKm);
      setMinContributionTl(pricing.suggested);
      setMaxContributionTl(pricing.max);
      setContributionTl(pricing.suggested);
    });
    return () => {
      cancelled = true;
    };
  }, [route, visible]);

  useEffect(() => {
    const suggested = session.request?.suggested_contribution_tl;
    if (typeof suggested === 'number' && suggested > 0) {
      setMinContributionTl(suggested);
      setMaxContributionTl(suggested * 2);
      setContributionTl((prev) => Math.max(suggested, prev));
    }
  }, [session.request?.suggested_contribution_tl]);

  useEffect(() => {
    const hint = session.validationHint;
    if (hint?.code !== 'contribution_too_low') {
      return;
    }
    const suggested =
      typeof hint.suggestedContributionTl === 'number' && hint.suggestedContributionTl > 0
        ? hint.suggestedContributionTl
        : minContributionTl;
    if (suggested > 0) {
      setMinContributionTl(suggested);
      setMaxContributionTl(
        typeof hint.maxContributionTl === 'number' && hint.maxContributionTl > 0
          ? hint.maxContributionTl
          : suggested * 2,
      );
      setContributionTl(suggested);
      setCreateGuardMessage(null);
    }
  }, [session.validationHint, minContributionTl]);

  const handleClose = useCallback(async () => {
    if (session.isCancelling) {
      return;
    }
    if (session.status === 'sequencing' || session.isCreating) {
      const cancelled = await session.cancel();
      if (!cancelled) {
        return;
      }
    }
    session.clear();
    onClose();
  }, [session, onClose]);

  const handleRetry = useCallback(() => {
    session.clear();
    onRetry?.();
  }, [session, onRetry]);

  const handleGoNormal = useCallback(() => {
    session.clear();
    onGoNormalMatch?.();
  }, [session, onGoNormalMatch]);

  const handleCreate = useCallback(async () => {
    setCreateGuardMessage(null);
    if (!route || session.isCreating || distanceTooFar) {
      return;
    }
    if (priceLoading) {
      return;
    }
    if (minContributionTl <= 0) {
      return;
    }
    if (contributionTl < minContributionTl || contributionTl > maxContributionTl) {
      setCreateGuardMessage(CONTRIBUTION_GUARD_MESSAGE);
      return;
    }
    console.log(
      '[QM] CREATE_TAP',
      JSON.stringify({
        distance_km: route.distance_km ?? null,
        offered_contribution_tl: contributionTl,
        vehicle_preference: route.vehicle_preference ?? null,
      }),
    );
    awaitingCreateResultRef.current = true;
    await session.create({
      pickup_lat: route.pickup_lat,
      pickup_lng: route.pickup_lng,
      pickup_label: route.pickup_label,
      dropoff_lat: route.dropoff_lat,
      dropoff_lng: route.dropoff_lng,
      dropoff_label: route.dropoff_label,
      offered_contribution_tl: contributionTl,
      vehicle_preference: route.vehicle_preference ?? undefined,
    });
  }, [
    route,
    session,
    contributionTl,
    distanceTooFar,
    priceLoading,
    minContributionTl,
    maxContributionTl,
  ]);

  useEffect(() => {
    if (!awaitingCreateResultRef.current) {
      return;
    }
    if (session.status === 'sequencing' && session.request?.request_id) {
      console.log(
        '[QM] CREATE_SUCCESS',
        JSON.stringify({
          request_id: session.request.request_id,
          status: session.request.status,
        }),
      );
      awaitingCreateResultRef.current = false;
      return;
    }
    if (session.status === 'matched' && session.request?.request_id) {
      console.log(
        '[QM] CREATE_SUCCESS',
        JSON.stringify({
          request_id: session.request.request_id,
          status: session.request?.status ?? 'matched',
        }),
      );
      awaitingCreateResultRef.current = false;
      return;
    }
    if (
      session.status === 'exhausted' ||
      session.status === 'expired' ||
      session.status === 'cancelled'
    ) {
      console.log(
        '[QM] CREATE_TERMINAL',
        JSON.stringify({
          terminal_status: session.status,
          request_id: session.request?.request_id ?? null,
        }),
      );
      awaitingCreateResultRef.current = false;
      return;
    }
    if (session.status === 'error' && session.errorMessage) {
      console.log(
        '[QM] CREATE_ERROR',
        JSON.stringify({ message: session.errorMessage }),
      );
      awaitingCreateResultRef.current = false;
    }
  }, [
    session.status,
    session.request?.request_id,
    session.request?.status,
    session.errorMessage,
  ]);

  const handleCancelRequest = useCallback(() => {
    if (session.isCancelling) {
      return;
    }
    void session.cancel();
  }, [session]);

  const decreaseContribution = useCallback(() => {
    setContributionTl((prev) => Math.max(minContributionTl, prev - CONTRIBUTION_STEP_TL));
  }, [minContributionTl]);

  const increaseContribution = useCallback(() => {
    setContributionTl((prev) => Math.min(maxContributionTl, prev + CONTRIBUTION_STEP_TL));
  }, [maxContributionTl]);

  if (!visible) {
    return null;
  }

  const pickupLabel =
    session.request?.pickup_label || route?.pickup_label || 'Alış noktası';
  const dropoffLabel =
    session.request?.dropoff_label || route?.dropoff_label || 'Varış noktası';
  const displayDistanceKm =
    pricingRoadDistanceKm ??
    session.request?.distance_km ??
    route?.distance_km ??
    null;
  const displayContribution =
    session.request?.offered_contribution_tl ?? contributionTl;

  const isContributionTooLowRecovery =
    session.validationHint?.code === 'contribution_too_low';

  const contributionOutOfBounds =
    minContributionTl > 0 &&
    (contributionTl < minContributionTl || contributionTl > maxContributionTl);

  const renderBody = () => {
    if (session.status === 'restoring') {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="body" style={styles.loadingTitle}>
            Eşleşme durumu güncelleniyor
          </PremiumText>
        </View>
      );
    }

    if (session.status === 'creating' || session.isCreating) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="body" style={styles.loadingTitle}>
            Hızlı eşleşme isteğiniz hazırlanıyor
          </PremiumText>
        </View>
      );
    }

    if (session.status === 'matched') {
      return (
        <View style={styles.centerCard}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={PREMIUM_AUTH_CYAN} />
          </View>
          <PremiumText variant="title" style={styles.title}>
            Eşleşme bulundu
          </PremiumText>
          <PremiumText variant="body" muted style={styles.bodyMuted}>
            Yolculuk ekranınız hazırlanıyor.
          </PremiumText>
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} style={styles.matchedSpinner} />
        </View>
      );
    }

    if (session.status === 'sequencing') {
      return (
        <View style={styles.section}>
          <ProgressDots />
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.full} style={styles.statusChip}>
            <PremiumText variant="caption" style={styles.statusChipText}>
              Eşleşme aranıyor
            </PremiumText>
          </GlassSurface>
          <PremiumText variant="title" style={styles.title}>
            Uygun sürücüler değerlendiriliyor
          </PremiumText>
          <PremiumText variant="body" muted style={styles.bodyMuted}>
            Uygun sürücüler sırayla değerlendiriliyor.
          </PremiumText>
          <PremiumText variant="caption" muted style={styles.statusHint}>
            İlk onaylayan sürücüyle eşleşirsiniz.
          </PremiumText>
          <RouteSummaryCard
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            distanceKm={displayDistanceKm}
            contributionTl={displayContribution}
          />
          {session.pollErrorMessage ? (
            <PremiumText variant="caption" style={styles.pollWarning}>
              Bağlantı zayıf. Kısa süre sonra tekrar denenecek.
            </PremiumText>
          ) : null}
          <SecondaryButton
            label="İsteği iptal et"
            onPress={handleCancelRequest}
            disabled={session.isCancelling}
          />
          {session.isCancelling ? (
            <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
          ) : null}
        </View>
      );
    }

    if (session.status === 'exhausted') {
      return (
        <View style={styles.section}>
          <PremiumText variant="title" style={styles.title}>
            Yakınınızda uygun sürücü bulunamadı
          </PremiumText>
          <PremiumText variant="body" muted style={styles.bodyMuted}>
            İsterseniz tekrar deneyebilir veya normal eşleşme ile devam edebilirsiniz.
          </PremiumText>
          <RouteSummaryCard
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            distanceKm={displayDistanceKm}
            contributionTl={displayContribution}
          />
          <PrimaryButton label="Tekrar dene" onPress={handleRetry} />
          <SecondaryButton label="Normal eşleşmeye geç" onPress={handleGoNormal} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'expired') {
      return (
        <View style={styles.section}>
          <PremiumText variant="title" style={styles.title}>
            İstek süresi doldu
          </PremiumText>
          <PremiumText variant="body" muted style={styles.bodyMuted}>
            İsterseniz tekrar deneyebilir veya normal eşleşme ile devam edebilirsiniz.
          </PremiumText>
          <PrimaryButton label="Tekrar dene" onPress={handleRetry} />
          <SecondaryButton label="Normal eşleşmeye geç" onPress={handleGoNormal} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'cancelled') {
      return (
        <View style={styles.section}>
          <PremiumText variant="title" style={styles.title}>
            İstek iptal edildi
          </PremiumText>
          <PrimaryButton label="Tekrar dene" onPress={handleRetry} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (
      (session.status === 'error' || session.errorMessage) &&
      !isContributionTooLowRecovery
    ) {
      return (
        <View style={styles.section}>
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#F87171" />
            <PremiumText variant="title" style={styles.errorTitle}>
              İşlem tamamlanamadı
            </PremiumText>
            <PremiumText variant="body" muted style={styles.errorBody}>
              {session.errorMessage || 'Bir sorun oluştu. Lütfen tekrar deneyin.'}
            </PremiumText>
          </GlassSurface>
          <PrimaryButton label="Tekrar dene" onPress={handleRetry} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (distanceTooFar) {
      return (
        <View style={styles.section}>
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.errorCard}>
            <Ionicons name="map-outline" size={28} color={PREMIUM_AUTH_CYAN} />
            <PremiumText variant="title" style={styles.errorTitle}>
              Bu rota hızlı eşleşme için uygun değil
            </PremiumText>
            <PremiumText variant="body" muted style={styles.errorBody}>
              Hızlı eşleşme en fazla {QUICK_MATCH_MAX_DISTANCE_KM} km mesafede kullanılabilir.
              Normal eşleşme ile devam edebilirsiniz.
            </PremiumText>
          </GlassSurface>
          <RouteSummaryCard
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            distanceKm={displayDistanceKm}
          />
          <SecondaryButton label="Normal eşleşmeye geç" onPress={handleGoNormal} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (!route) {
      return (
        <View style={styles.centerCard}>
          <PremiumText variant="title" style={styles.title}>
            Rota bilgisi gerekli
          </PremiumText>
          <PremiumText variant="body" muted style={styles.bodyMuted}>
            Hızlı eşleşme için alış ve varış noktası seçilmelidir.
          </PremiumText>
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    const canDecrease = contributionTl > minContributionTl;
    const canIncrease = maxContributionTl > 0 && contributionTl < maxContributionTl;

    return (
      <View style={styles.section}>
        <RouteSummaryCard
          pickupLabel={pickupLabel}
          dropoffLabel={dropoffLabel}
          distanceKm={displayDistanceKm}
        />
        <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.glassCard}>
          <PremiumText variant="caption" muted style={styles.contributionLabel}>
            Hızlı eşleşme katkı payı
          </PremiumText>
          {priceLoading ? (
            <View style={styles.priceLoadingRow}>
              <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
              <PremiumText variant="body" muted style={styles.bodyMuted}>
                Önerilen katkı hesaplanıyor
              </PremiumText>
            </View>
          ) : (
            <>
              <PremiumText variant="caption" muted style={styles.contributionSubLabel}>
                Önerilen katkı
              </PremiumText>
              <View style={styles.stepperRow}>
            <Pressable
              onPress={decreaseContribution}
              disabled={!canDecrease}
              accessibilityRole="button"
              accessibilityLabel="Katkıyı azalt"
              accessibilityState={{ disabled: !canDecrease }}
              style={({ pressed }) => [
                styles.stepperBtn,
                !canDecrease && styles.stepperBtnDisabled,
                pressed && canDecrease && styles.stepperBtnPressed,
              ]}
            >
              <Ionicons
                name="remove"
                size={22}
                color={canDecrease ? PREMIUM_AUTH_CYAN : PREMIUM_TEXT_MUTED}
              />
            </Pressable>
            <PremiumText variant="title" style={styles.contributionValue}>
              {contributionTl} TL
            </PremiumText>
            <Pressable
              onPress={increaseContribution}
              disabled={!canIncrease}
              accessibilityRole="button"
              accessibilityLabel="Katkıyı artır"
              accessibilityState={{ disabled: !canIncrease }}
              style={({ pressed }) => [
                styles.stepperBtn,
                !canIncrease && styles.stepperBtnDisabled,
                pressed && canIncrease && styles.stepperBtnPressed,
              ]}
            >
              <Ionicons
                name="add"
                size={22}
                color={canIncrease ? PREMIUM_AUTH_CYAN : PREMIUM_TEXT_MUTED}
              />
            </Pressable>
          </View>
          <PremiumText variant="caption" muted style={styles.bodyMuted}>
            Önerilen katkı payının 2 katına kadar artırabilirsiniz.
          </PremiumText>
          <PremiumText variant="caption" muted style={styles.disclaimer}>
            LeylekTAG katkı payını tahsil etmez.{'\n'}
            Katkı payı yolculuk sonrası sürücüyle aranızda.
          </PremiumText>
            </>
          )}
        </GlassSurface>
        {priceError ? (
          <PremiumText variant="caption" style={styles.inlineError}>
            {priceError}
          </PremiumText>
        ) : null}
        {createGuardMessage ? (
          <PremiumText variant="caption" style={styles.inlineError}>
            {createGuardMessage}
          </PremiumText>
        ) : null}
        {isContributionTooLowRecovery && session.errorMessage ? (
          <PremiumText variant="caption" style={styles.inlineError}>
            {session.errorMessage}
          </PremiumText>
        ) : null}
        <PremiumText variant="caption" muted style={styles.ctaPreface}>
          Rota hazır. İsteğinizi göndermek için aşağıdaki düğmeye dokunun.
        </PremiumText>
        <PrimaryButton
          label="Hızlı eşleşme isteği gönder"
          onPress={() => void handleCreate()}
          disabled={
            session.isCreating ||
            distanceTooFar ||
            priceLoading ||
            minContributionTl <= 0 ||
            contributionOutOfBounds
          }
          loading={session.isCreating}
        />
        <SecondaryButton label="Kapat" onPress={handleClose} />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => void handleClose()}
    >
      <View style={styles.modalRoot}>
        <CockpitBackground />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <FlowHeader onClose={handleClose} closeDisabled={session.isCancelling} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderBody()}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default memo(QuickMatchPassengerFlow);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    paddingVertical: LDS_SPACING.sm,
    borderBottomWidth: LDS_BORDER_WIDTH.hairline,
    borderBottomColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  },
  headerIconOrb: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: 'rgba(34, 211, 238, 0.32)',
    ...LDS_ELEVATION.chip,
  },
  guardianChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  guardianChipText: {
    fontWeight: '700',
    letterSpacing: 0.2,
    color: 'rgba(186, 230, 253, 0.92)',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  headerTitle: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontWeight: '600',
  },
  closeBtn: {
    padding: LDS_SPACING.xxs,
    borderRadius: LDS_RADIUS.md,
  },
  closeBtnDisabled: {
    opacity: 0.45,
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  section: {
    gap: LDS_SPACING.md,
    paddingTop: LDS_SPACING.xs,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xxxl,
    paddingHorizontal: LDS_SPACING.xs,
  },
  glassCard: {
    padding: LDS_SPACING.md,
    gap: LDS_SPACING.sm,
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    ...LDS_ELEVATION.chip,
  },
  statusChip: {
    alignSelf: 'center',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  statusChipText: {
    fontWeight: '700',
    color: 'rgba(186, 230, 253, 0.92)',
    letterSpacing: 0.2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeConnector: {
    marginLeft: 6,
    width: 2,
    height: 14,
    backgroundColor: PREMIUM_BORDER_SLATE,
    borderRadius: 1,
  },
  routeLabel: {
    flex: 1,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
    lineHeight: 20,
  },
  routeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LDS_SPACING.sm,
    marginTop: LDS_SPACING.xxs,
  },
  routeMetaText: {
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
  },
  title: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bodyMuted: {
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  ctaPreface: {
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  statusHint: {
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingTitle: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
    marginTop: LDS_SPACING.xs,
  },
  contributionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: LDS_SPACING.xs,
  },
  contributionSubLabel: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: LDS_SPACING.xs,
  },
  priceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    backgroundColor: 'rgba(30, 58, 95, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.45,
  },
  stepperBtnPressed: {
    opacity: 0.88,
  },
  contributionValue: {
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  disclaimer: {
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: LDS_SPACING.xxs,
  },
  inlineError: {
    fontWeight: '600',
    color: '#F87171',
    textAlign: 'center',
  },
  pollWarning: {
    fontWeight: '600',
    color: 'rgba(251, 191, 36, 0.92)',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(30, 58, 95, 0.9)',
  },
  dotMid: {
    backgroundColor: 'rgba(34, 211, 238, 0.35)',
  },
  dotActive: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    shadowColor: PREMIUM_AUTH_CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnOuter: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  primaryBtnDisabled: {
    opacity: 0.72,
  },
  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  primaryBtnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryBtnText: {
    fontWeight: '700',
    color: '#F8FAFF',
    letterSpacing: -0.2,
  },
  secondaryBtnWrap: {
    width: '100%',
  },
  secondaryBtn: {
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    alignItems: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
    borderColor: PREMIUM_BORDER_SLATE,
    ...LDS_ELEVATION.chip,
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  secondaryBtnText: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
  },
  errorCard: {
    padding: LDS_SPACING.md,
    gap: LDS_SPACING.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.92)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
    ...LDS_ELEVATION.chip,
  },
  errorTitle: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
  },
  errorBody: {
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  successIconWrap: {
    marginBottom: 4,
  },
  matchedSpinner: {
    marginTop: 8,
  },
});
