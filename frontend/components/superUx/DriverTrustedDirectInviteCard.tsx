import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_COLOR_ERROR, PREMIUM_AUTH_CYAN } from '../../design-system/tokens/color';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import type { useTrustedDirectDriverSession } from '../../hooks/useTrustedDirectDriverSession';
import { useDriverTheme } from '../../lib/theme/useDriverTheme';
import {
  ACTION_ACCEPT,
  ACTION_DECLINE,
  TDM_CONTRIBUTION_DISCLAIMER,
  TDM_DRIVER_INVITE_POLL_WARNING,
  TDM_DRIVER_INVITE_SUBTITLE,
  TDM_DRIVER_INVITE_TITLE,
  formatTdmDriverDistanceLabel,
  formatTdmVehiclePreference,
} from '../../lib/trustedHubCopy';

export type DriverTrustedDirectSessionView = Pick<
  ReturnType<typeof useTrustedDirectDriverSession>,
  | 'status'
  | 'invite'
  | 'errorMessage'
  | 'pollErrorMessage'
  | 'isRestoring'
  | 'isAccepting'
  | 'isDeclining'
  | 'isPolling'
>;

export type DriverTrustedDirectInviteCardProps = {
  visible: boolean;
  session: DriverTrustedDirectSessionView;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  onClose: () => void;
};

function secondsUntilExpiry(
  expiresAt: string | null | undefined,
  fallbackSec: number | null | undefined,
): number | null {
  if (expiresAt) {
    const targetMs = Date.parse(expiresAt);
    if (Number.isFinite(targetMs)) {
      return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
    }
  }
  const fallback = Number(fallbackSec);
  if (Number.isFinite(fallback) && fallback >= 0) {
    return Math.floor(fallback);
  }
  return null;
}

function formatCountdownLabel(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds <= 0) return 'Süre doldu';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs} sn`;
}

function formatCountdownHint(seconds: number | null): string {
  if (seconds == null) return 'Yanıt süresi hesaplanıyor';
  if (seconds <= 0) return 'Yanıt süresi doldu';
  return `${seconds} saniye içinde yanıtla`;
}

function useInviteCountdown(
  expiresAt: string | null | undefined,
  fallbackSec: number | null | undefined,
  active: boolean,
): number | null {
  const [remainingSec, setRemainingSec] = useState<number | null>(() =>
    active ? secondsUntilExpiry(expiresAt, fallbackSec) : null,
  );

  useEffect(() => {
    if (!active) {
      setRemainingSec(null);
      return;
    }

    const hasExpiresAt =
      expiresAt != null && Number.isFinite(Date.parse(expiresAt));

    if (hasExpiresAt) {
      const tick = () => {
        setRemainingSec(secondsUntilExpiry(expiresAt, fallbackSec));
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }

    if (fallbackSec != null && Number.isFinite(fallbackSec)) {
      setRemainingSec(Math.max(0, Math.floor(fallbackSec)));
      const id = setInterval(() => {
        setRemainingSec((prev) => {
          if (prev == null) return null;
          return Math.max(0, prev - 1);
        });
      }, 1000);
      return () => clearInterval(id);
    }

    setRemainingSec(null);
    return undefined;
  }, [active, expiresAt, fallbackSec]);

  return remainingSec;
}

function PollWarningBanner() {
  const { quickMatchSurfaces: qmLt } = useDriverTheme();
  return (
    <GlassSurface
      variant="plain"
      borderRadius={LDS_RADIUS.sm}
      style={[styles.pollWarning, qmLt?.pollWarningBanner]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#FBBF24" />
      <PremiumText variant="caption" style={styles.pollWarningText}>
        {TDM_DRIVER_INVITE_POLL_WARNING}
      </PremiumText>
    </GlassSurface>
  );
}

function DecisionHeader() {
  const { quickMatchSurfaces: qmLt, ui } = useDriverTheme();
  return (
    <View style={styles.phaseBlock}>
      <View style={[styles.iconRing, qmLt?.iconRing]}>
        <Ionicons name="people-outline" size={26} color={ui.trustIcon} />
      </View>
      <PremiumText variant="step" style={[styles.phaseStep, { color: ui.accent }]}>
        {TDM_DRIVER_INVITE_TITLE}
      </PremiumText>
      <PremiumText variant="caption" muted style={styles.phaseCaption}>
        {TDM_DRIVER_INVITE_SUBTITLE}
      </PremiumText>
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
  const { quickMatchSurfaces: qmLt, ui } = useDriverTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryBtn,
        qmLt?.primaryBtnWrap,
        !qmLt && styles.primaryBtnDark,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && !loading && styles.primaryBtnPressed,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={qmLt ? ui.activity : ui.acceptText} />
      ) : (
        <PremiumText
          variant="body"
          style={[styles.primaryBtnText, qmLt?.primaryBtnText, !qmLt && styles.primaryBtnTextDark]}
        >
          {label}
        </PremiumText>
      )}
    </Pressable>
  );
}

function SecondaryButton({
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
  const { quickMatchSurfaces: qmLt, ui } = useDriverTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryBtn,
        qmLt?.secondaryBtnWrap,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && !loading && styles.secondaryBtnPressed,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={ui.activity} />
      ) : (
        <PremiumText variant="body" muted style={styles.secondaryBtnText}>
          {label}
        </PremiumText>
      )}
    </Pressable>
  );
}

function InviteDetailsBlock({
  pickupLabel,
  dropoffLabel,
  contributionTl,
  distanceLabel,
  vehicleLabel,
  countdownSec,
}: {
  pickupLabel: string;
  dropoffLabel: string;
  contributionTl: number;
  distanceLabel: string;
  vehicleLabel: string;
  countdownSec: number | null;
}) {
  const { quickMatchSurfaces: qmLt, ui } = useDriverTheme();
  const countdownLabel = formatCountdownLabel(countdownSec);
  const countdownHint = formatCountdownHint(countdownSec);
  const countdownExpired = countdownSec != null && countdownSec <= 0;
  const countdownUrgent =
    countdownSec != null && countdownSec > 0 && countdownSec <= 15;

  return (
    <View style={styles.detailsBlock}>
      <View style={styles.fieldBlock}>
        <PremiumText variant="caption" muted style={styles.fieldLabel}>
          Alış noktası
        </PremiumText>
        <View style={styles.routeRow}>
          <Ionicons name="radio-button-on" size={14} color={ui.activity} />
          <PremiumText variant="body" style={styles.fieldValue} numberOfLines={3}>
            {pickupLabel}
          </PremiumText>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <PremiumText variant="caption" muted style={styles.fieldLabel}>
          Varış noktası
        </PremiumText>
        <View style={styles.routeRow}>
          <Ionicons name="location-outline" size={14} color={ui.activity} />
          <PremiumText variant="body" style={styles.fieldValue} numberOfLines={3}>
            {dropoffLabel}
          </PremiumText>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCell}>
          <PremiumText variant="caption" muted style={styles.fieldLabel}>
            Mesafe
          </PremiumText>
          <View style={styles.inlineValueRow}>
            <Ionicons name="navigate-outline" size={14} color={ui.activity} />
            <PremiumText variant="body" style={styles.fieldValue}>
              {distanceLabel}
            </PremiumText>
          </View>
        </View>
        <View style={styles.metricCell}>
          <PremiumText variant="caption" muted style={styles.fieldLabel}>
            Katkı
          </PremiumText>
          <View style={styles.inlineValueRow}>
            <Ionicons name="cash-outline" size={14} color={ui.activity} />
            <PremiumText
              variant="body"
              style={[styles.contributionValue, qmLt?.contributionValue]}
            >
              {contributionTl} TL
            </PremiumText>
          </View>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <PremiumText variant="caption" muted style={styles.fieldLabel}>
          Araç tercihi
        </PremiumText>
        <View style={styles.inlineValueRow}>
          <Ionicons name="car-outline" size={14} color={ui.activity} />
          <PremiumText variant="body" style={styles.fieldValue}>
            {vehicleLabel}
          </PremiumText>
        </View>
      </View>

      <PremiumText variant="caption" muted style={styles.disclaimer}>
        {TDM_CONTRIBUTION_DISCLAIMER}
      </PremiumText>

      <GlassSurface
        variant="plain"
        borderRadius={LDS_RADIUS.sm}
        style={[styles.countdownChip, qmLt?.countdownChip]}
      >
        <Ionicons
          name="timer-outline"
          size={18}
          color={countdownExpired ? LDS_COLOR_ERROR : countdownUrgent ? '#FBBF24' : ui.activity}
        />
        <View style={styles.countdownTextCol}>
          <PremiumText
            variant="caption"
            muted
            style={[
              styles.countdownHint,
              countdownExpired && styles.countdownExpired,
              countdownUrgent && styles.countdownUrgent,
            ]}
          >
            {countdownHint}
          </PremiumText>
          <PremiumText
            variant="body"
            style={[
              styles.countdownValue,
              qmLt?.countdownText,
              countdownExpired && styles.countdownExpired,
              countdownUrgent && styles.countdownUrgent,
            ]}
          >
            {countdownLabel}
          </PremiumText>
        </View>
      </GlassSurface>
    </View>
  );
}

export function DriverTrustedDirectInviteCard({
  visible,
  session,
  onAccept,
  onDecline,
  onClose,
}: DriverTrustedDirectInviteCardProps) {
  const { quickMatchSurfaces: qmLt, ui } = useDriverTheme();
  const invite = session.invite;
  const request = invite?.request;
  const countdownActive = visible && session.status === 'pending' && invite != null;
  const countdownSec = useInviteCountdown(
    invite?.expires_at,
    invite?.invite_expires_in_sec,
    countdownActive,
  );

  const pickupLabel = useMemo(
    () => request?.pickup_label?.trim() || 'Alış noktası',
    [request?.pickup_label],
  );
  const dropoffLabel = useMemo(
    () => request?.dropoff_label?.trim() || 'Varış noktası',
    [request?.dropoff_label],
  );
  const contributionTl = request?.offered_contribution_tl ?? 0;
  const distanceLabel = useMemo(
    () =>
      formatTdmDriverDistanceLabel(request?.distance_km, request?.distance_band),
    [request?.distance_km, request?.distance_band],
  );
  const vehicleLabel = useMemo(
    () => formatTdmVehiclePreference(request?.vehicle_preference),
    [request?.vehicle_preference],
  );
  const inviteExpired = countdownSec != null && countdownSec <= 0;

  const actionLocked = session.isAccepting || session.isDeclining;
  const canDeclineViaScrim =
    session.status === 'pending' && !actionLocked && !inviteExpired;

  const handleClose = useCallback(() => {
    if (actionLocked) return;
    onClose();
  }, [actionLocked, onClose]);

  const handleAccept = useCallback(() => {
    void onAccept();
  }, [onAccept]);

  const handleDecline = useCallback(() => {
    void onDecline();
  }, [onDecline]);

  const handleScrimPress = useCallback(() => {
    if (canDeclineViaScrim) {
      handleDecline();
      return;
    }
    if (session.status === 'error' && !actionLocked) {
      handleClose();
    }
  }, [canDeclineViaScrim, session.status, actionLocked, handleDecline, handleClose]);

  if (!visible || session.status === 'idle') {
    return null;
  }

  if (
    (session.status === 'restoring' || session.isRestoring) &&
    !session.invite
  ) {
    return null;
  }

  const renderPollWarning = () =>
    session.pollErrorMessage ? <PollWarningBanner /> : null;

  const renderBody = () => {
    if (session.status === 'restoring' || session.isRestoring) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={ui.activity} />
          <PremiumText variant="body" style={styles.loadingTitle}>
            Davet kontrol ediliyor…
          </PremiumText>
        </View>
      );
    }

    if (session.status === 'accepting' || session.isAccepting) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={ui.activity} />
          <PremiumText variant="body" style={styles.loadingTitle}>
            Eşleşme hazırlanıyor…
          </PremiumText>
        </View>
      );
    }

    if (session.status === 'matched') {
      return (
        <View style={styles.centerCard}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={48} color={ui.accent} />
          </View>
          <PremiumText variant="step" style={[styles.title, { color: ui.accent }]}>
            Eşleşme tamamlandı
          </PremiumText>
          <PremiumText variant="caption" muted style={styles.bodyMuted}>
            Buluşma ekranı hazırlanıyor
          </PremiumText>
          <ActivityIndicator size="small" color={ui.activity} style={styles.matchedSpinner} />
        </View>
      );
    }

    if (session.status === 'error' || session.errorMessage) {
      return (
        <View style={styles.section}>
          {renderPollWarning()}
          <GlassSurface
            variant="plain"
            borderRadius={LDS_RADIUS.md}
            style={[styles.errorCard, qmLt?.errorCard]}
          >
            <Ionicons name="alert-circle-outline" size={28} color={LDS_COLOR_ERROR} />
            <PremiumText variant="body" muted style={styles.errorBody}>
              {session.errorMessage || 'Doğrudan eşleşme şu an kullanılamıyor.'}
            </PremiumText>
          </GlassSurface>
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'pending') {
      if (!invite || !request) {
        return null;
      }

      return (
        <View style={styles.section}>
          {renderPollWarning()}
          <InviteDetailsBlock
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            contributionTl={contributionTl}
            distanceLabel={distanceLabel}
            vehicleLabel={vehicleLabel}
            countdownSec={countdownSec}
          />
          <View style={styles.ctaRow}>
            <SecondaryButton
              label={ACTION_DECLINE}
              onPress={handleDecline}
              disabled={session.isAccepting}
              loading={session.isDeclining}
            />
            <PrimaryButton
              label={ACTION_ACCEPT}
              onPress={handleAccept}
              disabled={session.isDeclining || inviteExpired}
              loading={session.isAccepting}
            />
          </View>
        </View>
      );
    }

    return null;
  };

  const body = renderBody();
  if (body == null) {
    return null;
  }

  const showDecisionHeader =
    session.status === 'pending' ||
    session.status === 'restoring' ||
    session.isRestoring ||
    session.status === 'accepting' ||
    session.isAccepting;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleScrimPress}
    >
      <Pressable style={styles.overlay} onPress={handleScrimPress}>
        <View style={[styles.scrim, qmLt?.scrim]} pointerEvents="none" />

        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <GlassSurface
            variant="panel"
            borderRadius={LDS_RADIUS.xl}
            style={[styles.card, qmLt?.card]}
          >
            {showDecisionHeader ? <DecisionHeader /> : null}
            {body}
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default memo(DriverTrustedDirectInviteCard);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: LDS_SPACING.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.82)',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    ...LDS_ELEVATION.cockpit,
  },
  phaseBlock: {
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  iconRing: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 24, 0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    marginBottom: LDS_SPACING.xs,
    ...LDS_ELEVATION.flat,
  },
  phaseStep: {
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  phaseCaption: {
    textAlign: 'center',
    lineHeight: 18,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  subtitle: {
    textAlign: 'center',
  },
  section: {
    gap: LDS_SPACING.md,
  },
  centerCard: {
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
  },
  loadingTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  bodyMuted: {
    textAlign: 'center',
    lineHeight: 18,
  },
  successIconWrap: {
    marginBottom: LDS_SPACING.xxs,
  },
  matchedSpinner: {
    marginTop: LDS_SPACING.sm,
  },
  pollWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    borderWidth: LDS_BORDER_WIDTH.thin,
    borderColor: 'rgba(251, 191, 36, 0.28)',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  pollWarningText: {
    flex: 1,
    color: 'rgba(251, 191, 36, 0.95)',
    lineHeight: 17,
  },
  detailsBlock: {
    gap: LDS_SPACING.md,
  },
  fieldBlock: {
    gap: LDS_SPACING.xxs,
  },
  fieldLabel: {
    letterSpacing: 0.4,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.xs,
  },
  inlineValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
  },
  fieldValue: {
    flex: 1,
    fontWeight: '600',
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: LDS_SPACING.md,
  },
  metricCell: {
    flex: 1,
    gap: LDS_SPACING.xxs,
  },
  contributionValue: {
    color: PREMIUM_AUTH_CYAN,
    fontWeight: '700',
  },
  disclaimer: {
    lineHeight: 18,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    borderWidth: LDS_BORDER_WIDTH.thin,
    borderColor: LDS_BORDER_COLOR.subtle,
    ...LDS_ELEVATION.chip,
  },
  countdownTextCol: {
    flex: 1,
    gap: 2,
  },
  countdownHint: {
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  countdownValue: {
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
    fontVariant: ['tabular-nums'],
  },
  countdownExpired: {
    color: LDS_COLOR_ERROR,
  },
  countdownUrgent: {
    color: '#FBBF24',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
    width: '100%',
  },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: LDS_RADIUS.md,
    paddingHorizontal: LDS_SPACING.sm,
    borderWidth: LDS_BORDER_WIDTH.thin,
  },
  primaryBtnDark: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderColor: PREMIUM_AUTH_CYAN,
  },
  primaryBtnText: {
    fontWeight: '700',
  },
  primaryBtnTextDark: {
    color: '#08111F',
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.thin,
    borderColor: LDS_BORDER_COLOR.subtle,
    paddingHorizontal: LDS_SPACING.sm,
  },
  secondaryBtnText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorCard: {
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    padding: LDS_SPACING.md,
    borderWidth: LDS_BORDER_WIDTH.thin,
    borderColor: LDS_BORDER_COLOR.subtle,
  },
  errorBody: {
    textAlign: 'center',
  },
});
