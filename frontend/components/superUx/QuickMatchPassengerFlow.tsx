import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_AUTH_CTA_GRADIENT,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import type { useQuickMatchPassengerSession } from '../../hooks/useQuickMatchPassengerSession';

const CONTRIBUTION_STEP_TL = 10;
const DEFAULT_MIN_CONTRIBUTION_TL = 90;
const MAX_CONTRIBUTION_TL = 500;
const QUICK_MATCH_MAX_DISTANCE_KM = 20;

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

export type QuickMatchPassengerFlowProps = {
  visible: boolean;
  route: QuickMatchRouteContext | null;
  session: QuickMatchPassengerSessionView;
  onClose: () => void;
  onRetry?: () => void;
  onGoNormalMatch?: () => void;
};

function minContributionFromDistanceKm(distanceKm: number | null | undefined): number {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km <= 0) {
    return DEFAULT_MIN_CONTRIBUTION_TL;
  }
  if (km <= 5) {
    return 90;
  }
  if (km <= 10) {
    return 130;
  }
  if (km <= 20) {
    return 170;
  }
  return DEFAULT_MIN_CONTRIBUTION_TL;
}

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

function FlowHeader({
  onClose,
  closeDisabled,
}: {
  onClose: () => void | Promise<void>;
  closeDisabled?: boolean;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerIconOrb}>
        <Text style={styles.headerEmoji}>⚡</Text>
      </View>
      <View style={styles.headerTextCol}>
        <Text style={styles.headerTitle}>Hızlı Eşleşme</Text>
        <Text style={styles.headerSubtitle}>Yakın sürücülerle hızlı bağlantı</Text>
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
    <View style={styles.glassCard}>
      <View style={styles.routeRow}>
        <Ionicons name="radio-button-on" size={14} color={PREMIUM_AUTH_CYAN} />
        <Text style={styles.routeLabel} numberOfLines={2}>
          {pickupLabel}
        </Text>
      </View>
      <View style={styles.routeConnector} />
      <View style={styles.routeRow}>
        <Ionicons name="location" size={14} color={PREMIUM_AUTH_CYAN} />
        <Text style={styles.routeLabel} numberOfLines={2}>
          {dropoffLabel}
        </Text>
      </View>
      {distanceText || contributionTl != null ? (
        <View style={styles.routeMetaRow}>
          {distanceText ? <Text style={styles.routeMetaText}>{distanceText}</Text> : null}
          {contributionTl != null ? (
            <Text style={styles.routeMetaText}>{contributionTl} TL katkı</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ProgressDots() {
  return (
    <View style={styles.dotsRow} accessibilityLabel="Aranıyor">
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
          <Text style={styles.primaryBtnText}>{label}</Text>
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
        styles.secondaryBtn,
        disabled && styles.secondaryBtnDisabled,
        pressed && !disabled && styles.secondaryBtnPressed,
      ]}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
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
  const [contributionTl, setContributionTl] = useState(DEFAULT_MIN_CONTRIBUTION_TL);
  const [minContributionTl, setMinContributionTl] = useState(DEFAULT_MIN_CONTRIBUTION_TL);
  const awaitingCreateResultRef = useRef(false);

  const distanceTooFar = useMemo(
    () =>
      isDistanceTooFarForQuickMatch(
        session.request?.distance_km ?? route?.distance_km,
      ),
    [session.request?.distance_km, route?.distance_km],
  );

  useEffect(() => {
    if (!route) {
      return;
    }
    const min = minContributionFromDistanceKm(route.distance_km);
    setMinContributionTl(min);
    setContributionTl((prev) => {
      const next = prev < min ? min : prev;
      return Math.min(next, MAX_CONTRIBUTION_TL);
    });
  }, [route]);

  useEffect(() => {
    const suggested = session.request?.suggested_contribution_tl;
    if (typeof suggested === 'number' && suggested > 0) {
      setMinContributionTl(suggested);
      setContributionTl((prev) => Math.max(suggested, prev));
    }
  }, [session.request?.suggested_contribution_tl]);

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
    if (route) {
      const min = minContributionFromDistanceKm(route.distance_km);
      setMinContributionTl(min);
      setContributionTl(min);
    }
  }, [session, onRetry, route]);

  const handleGoNormal = useCallback(() => {
    session.clear();
    onGoNormalMatch?.();
  }, [session, onGoNormalMatch]);

  const handleCreate = useCallback(async () => {
    if (!route || session.isCreating || distanceTooFar) {
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
  }, [route, session, contributionTl, distanceTooFar]);

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
    setContributionTl((prev) => Math.min(MAX_CONTRIBUTION_TL, prev + CONTRIBUTION_STEP_TL));
  }, []);

  if (!visible) {
    return null;
  }

  const pickupLabel =
    session.request?.pickup_label || route?.pickup_label || 'Alış noktası';
  const dropoffLabel =
    session.request?.dropoff_label || route?.dropoff_label || 'Varış noktası';
  const displayDistanceKm =
    session.request?.distance_km ?? route?.distance_km ?? null;
  const displayContribution =
    session.request?.offered_contribution_tl ?? contributionTl;

  const renderBody = () => {
    if (session.status === 'restoring') {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.loadingTitle}>Quick Match durumu kontrol ediliyor…</Text>
        </View>
      );
    }

    if (session.status === 'creating' || session.isCreating) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.loadingTitle}>Hızlı Eşleşme isteğiniz hazırlanıyor…</Text>
        </View>
      );
    }

    if (session.status === 'matched') {
      return (
        <View style={styles.centerCard}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={PREMIUM_AUTH_CYAN} />
          </View>
          <Text style={styles.title}>Eşleşme bulundu</Text>
          <Text style={styles.bodyMuted}>Yolculuk ekranınız hazırlanıyor.</Text>
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} style={styles.matchedSpinner} />
        </View>
      );
    }

    if (session.status === 'sequencing') {
      return (
        <View style={styles.section}>
          <ProgressDots />
          <Text style={styles.title}>Yakınınızdaki sürücüler aranıyor</Text>
          <Text style={styles.bodyMuted}>
            İsteğiniz uygun sürücülere sırayla iletiliyor.
          </Text>
          <Text style={styles.statusHint}>
            İlk kabul eden sürücüyle eşleşeceksiniz.
          </Text>
          <RouteSummaryCard
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            distanceKm={displayDistanceKm}
            contributionTl={displayContribution}
          />
          {session.request?.attempt_count != null && session.request.attempt_count > 0 ? (
            <Text style={styles.attemptMuted}>
              Deneme {session.request.attempt_count}
            </Text>
          ) : null}
          {session.pollErrorMessage ? (
            <Text style={styles.pollWarning}>
              Bağlantı zayıf, yeniden deneniyor.
            </Text>
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
          <Text style={styles.title}>Yakınınızda uygun sürücü bulunamadı.</Text>
          <Text style={styles.bodyMuted}>
            İsterseniz tekrar deneyebilir veya Normal Eşleşme ile devam edebilirsiniz.
          </Text>
          <RouteSummaryCard
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            distanceKm={displayDistanceKm}
            contributionTl={displayContribution}
          />
          <PrimaryButton label="Tekrar Dene" onPress={handleRetry} />
          <SecondaryButton label="Normal Eşleşmeye Geç" onPress={handleGoNormal} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'expired') {
      return (
        <View style={styles.section}>
          <Text style={styles.title}>İstek süresi doldu.</Text>
          <Text style={styles.bodyMuted}>
            İsterseniz tekrar deneyebilir veya Normal Eşleşme ile devam edebilirsiniz.
          </Text>
          <PrimaryButton label="Tekrar Dene" onPress={handleRetry} />
          <SecondaryButton label="Normal Eşleşmeye Geç" onPress={handleGoNormal} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'cancelled') {
      return (
        <View style={styles.section}>
          <Text style={styles.title}>İstek iptal edildi.</Text>
          <PrimaryButton label="Tekrar Dene" onPress={handleRetry} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'error' || session.errorMessage) {
      return (
        <View style={styles.section}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#F87171" />
            <Text style={styles.errorTitle}>İşlem tamamlanamadı</Text>
            <Text style={styles.errorBody}>
              {session.errorMessage || 'Bir sorun oluştu. Lütfen tekrar deneyin.'}
            </Text>
          </View>
          <PrimaryButton label="Tekrar Dene" onPress={handleRetry} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (distanceTooFar) {
      return (
        <View style={styles.section}>
          <View style={styles.errorCard}>
            <Ionicons name="map-outline" size={28} color={PREMIUM_AUTH_CYAN} />
            <Text style={styles.errorTitle}>Bu rota Hızlı Eşleşme için uygun değil</Text>
            <Text style={styles.errorBody}>
              Hızlı Eşleşme en fazla {QUICK_MATCH_MAX_DISTANCE_KM} km mesafede kullanılabilir.
              Normal Eşleşme ile devam edebilirsiniz.
            </Text>
          </View>
          <RouteSummaryCard
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            distanceKm={displayDistanceKm}
          />
          <SecondaryButton label="Normal Eşleşmeye Geç" onPress={handleGoNormal} />
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (!route) {
      return (
        <View style={styles.centerCard}>
          <Text style={styles.title}>Rota bilgisi gerekli</Text>
          <Text style={styles.bodyMuted}>
            Hızlı Eşleşme için alış ve varış noktası seçilmelidir.
          </Text>
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    const canDecrease = contributionTl > minContributionTl;
    const canIncrease = contributionTl < MAX_CONTRIBUTION_TL;

    return (
      <View style={styles.section}>
        <RouteSummaryCard
          pickupLabel={pickupLabel}
          dropoffLabel={dropoffLabel}
          distanceKm={displayDistanceKm}
        />
        <View style={styles.glassCard}>
          <Text style={styles.contributionLabel}>Önerilen katkı</Text>
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
            <Text style={styles.contributionValue}>{contributionTl} TL</Text>
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
          <Text style={styles.bodyMuted}>İsterseniz artırabilirsiniz</Text>
          <Text style={styles.disclaimer}>
            LeylekTAG katkıyı tahsil etmez.{'\n'}
            Katkı yolculuk sonrası sürücüyle aranızda.
          </Text>
        </View>
        {session.errorMessage ? (
          <Text style={styles.inlineError}>{session.errorMessage}</Text>
        ) : null}
        <Text style={styles.ctaPreface}>
          Rota hazır. Sürücülere hızlı eşleşme isteği göndermek için aşağıdaki butona basın.
        </Text>
        <PrimaryButton
          label="Hızlı eşleşme isteği gönder"
          onPress={() => void handleCreate()}
          disabled={session.isCreating}
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
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, '#0B1220', PREMIUM_NAVY_CARD]}
        style={styles.modalRoot}
      >
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
      </LinearGradient>
    </Modal>
  );
}

export default memo(QuickMatchPassengerFlow);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  },
  headerIconOrb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
  },
  closeBtnDisabled: {
    opacity: 0.45,
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  section: {
    gap: 16,
    paddingTop: 8,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 48,
    paddingHorizontal: 8,
  },
  glassCard: {
    borderRadius: 18,
    padding: 16,
    gap: 10,
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
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
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
    lineHeight: 20,
  },
  routeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  routeMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bodyMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 20,
    textAlign: 'center',
  },
  ctaPreface: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statusHint: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(186, 201, 222, 0.75)',
    textAlign: 'center',
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
    marginTop: 8,
  },
  contributionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: PREMIUM_TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
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
    fontSize: 32,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  disclaimer: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.92)',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  inlineError: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
    textAlign: 'center',
  },
  attemptMuted: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(148, 163, 184, 0.85)',
    textAlign: 'center',
  },
  pollWarning: {
    fontSize: 12,
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
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFF',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
    alignItems: 'center',
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  errorCard: {
    borderRadius: 18,
    padding: 18,
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.92)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
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
  successIconWrap: {
    marginBottom: 4,
  },
  matchedSpinner: {
    marginTop: 8,
  },
});
