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
import { PREMIUM_AUTH_CYAN, LDS_COLOR_ERROR } from '../../design-system/tokens/color';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import type { useQuickMatchDriverSession } from '../../hooks/useQuickMatchDriverSession';

export type DriverQuickMatchSessionView = Pick<
  ReturnType<typeof useQuickMatchDriverSession>,
  | 'status'
  | 'invite'
  | 'errorMessage'
  | 'pollErrorMessage'
  | 'isRestoring'
  | 'isAccepting'
  | 'isDeclining'
  | 'isPolling'
>;

export type DriverQuickMatchInviteCardProps = {
  visible: boolean;
  session: DriverQuickMatchSessionView;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  onClose: () => void;
};

const TITLE_COPY = 'Hızlı Eşleşme Teklifi';
const SUBTITLE_COPY = 'Yakındaki yolcu hızlı eşleşme bekliyor.';
const POLL_WARNING_COPY = 'Bağlantı zayıf, yeniden deneniyor.';
const CONTRIBUTION_DISCLAIMER = 'LeylekTAG katkıyı tahsil etmez.';

function formatDistanceBand(band: string | null | undefined): string {
  switch (band) {
    case '0_5':
      return '0–5 km';
    case '5_10':
      return '5–10 km';
    case '10_20':
      return '10–20 km';
    default:
      return 'Yakın mesafe';
  }
}

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
  if (seconds == null) {
    return '—';
  }
  if (seconds <= 0) {
    return 'Süre doldu';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs} sn`;
}

function formatCountdownHint(seconds: number | null): string {
  if (seconds == null) {
    return 'Yanıt süresi hesaplanıyor';
  }
  if (seconds <= 0) {
    return 'Yanıt süresi doldu';
  }
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
      const intervalId = setInterval(tick, 1000);
      return () => clearInterval(intervalId);
    }

    const initial = Number(fallbackSec);
    if (!Number.isFinite(initial) || initial < 0) {
      setRemainingSec(null);
      return;
    }

    let current = Math.floor(initial);
    setRemainingSec(current);
    const intervalId = setInterval(() => {
      current = Math.max(0, current - 1);
      setRemainingSec(current);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [active, expiresAt, fallbackSec]);

  return remainingSec;
}

function DecisionHeader() {
  return (
    <View style={styles.phaseBlock}>
      <View style={styles.iconRing}>
        <Ionicons name="flash-outline" size={26} color="rgba(34,211,238,0.92)" />
      </View>
      <PremiumText variant="step" style={styles.phaseStep}>
        {TITLE_COPY}
      </PremiumText>
      <PremiumText variant="caption" muted style={styles.phaseCaption}>
        {SUBTITLE_COPY}
      </PremiumText>
    </View>
  );
}

function PollWarningBanner() {
  return (
    <GlassSurface variant="plain" borderRadius={LDS_RADIUS.sm} style={styles.pollWarningBanner}>
      <Ionicons name="cloud-offline-outline" size={16} color="rgba(251, 191, 36, 0.95)" />
      <PremiumText variant="caption" style={styles.pollWarningText}>
        {POLL_WARNING_COPY}
      </PremiumText>
    </GlassSurface>
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
        styles.primaryBtnWrap,
        (disabled || loading) && styles.primaryBtnDisabled,
        pressed && !disabled && !loading && styles.primaryBtnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
      ) : (
        <PremiumText variant="body" style={styles.primaryBtnText}>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      style={({ pressed }) => [
        styles.secondaryBtnWrap,
        (disabled || loading) && styles.secondaryBtnDisabled,
        pressed && !disabled && !loading && styles.secondaryBtnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
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
  contributionTl,
  distanceBand,
  countdownSec,
}: {
  pickupLabel: string;
  contributionTl: number;
  distanceBand: string | null | undefined;
  countdownSec: number | null;
}) {
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
        <View style={styles.pickupRow}>
          <Ionicons name="radio-button-on" size={14} color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="body" style={styles.fieldValue} numberOfLines={3}>
            {pickupLabel}
          </PremiumText>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCell}>
          <PremiumText variant="caption" muted style={styles.fieldLabel}>
            Mesafe
          </PremiumText>
          <View style={styles.inlineValueRow}>
            <Ionicons name="navigate-outline" size={14} color={PREMIUM_AUTH_CYAN} />
            <PremiumText variant="body" style={styles.fieldValue}>
              {formatDistanceBand(distanceBand)}
            </PremiumText>
          </View>
        </View>
        <View style={styles.metricCell}>
          <PremiumText variant="caption" muted style={styles.fieldLabel}>
            Katkı
          </PremiumText>
          <View style={styles.inlineValueRow}>
            <Ionicons name="cash-outline" size={14} color={PREMIUM_AUTH_CYAN} />
            <PremiumText variant="body" style={styles.contributionValue}>
              {contributionTl} TL
            </PremiumText>
          </View>
        </View>
      </View>

      <PremiumText variant="caption" muted style={styles.disclaimer}>
        {CONTRIBUTION_DISCLAIMER}
      </PremiumText>

      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.sm} style={styles.countdownChip}>
        <Ionicons
          name="timer-outline"
          size={18}
          color={countdownExpired ? LDS_COLOR_ERROR : countdownUrgent ? '#FBBF24' : PREMIUM_AUTH_CYAN}
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
              styles.countdownText,
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

export function DriverQuickMatchInviteCard({
  visible,
  session,
  onAccept,
  onDecline,
  onClose,
}: DriverQuickMatchInviteCardProps) {
  const invite = session.invite;
  const countdownActive = visible && session.status === 'pending' && invite != null;
  const countdownSec = useInviteCountdown(
    invite?.expires_at,
    invite?.invite_expires_in_sec,
    countdownActive,
  );

  const pickupLabel = useMemo(
    () => invite?.pickup_label?.trim() || 'Alış noktası',
    [invite?.pickup_label],
  );
  const contributionTl = invite?.offered_contribution_tl ?? 0;
  const inviteExpired = countdownSec != null && countdownSec <= 0;

  const actionLocked = session.isAccepting || session.isDeclining;
  const canDeclineViaScrim =
    session.status === 'pending' && !actionLocked && !inviteExpired;

  const handleClose = useCallback(() => {
    if (actionLocked) {
      return;
    }
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
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="body" style={styles.loadingTitle}>
            Davet kontrol ediliyor…
          </PremiumText>
        </View>
      );
    }

    if (session.status === 'accepting' || session.isAccepting) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
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
            <Ionicons name="checkmark-circle" size={48} color={PREMIUM_AUTH_CYAN} />
          </View>
          <PremiumText variant="step" style={styles.title}>
            Eşleşme tamamlandı
          </PremiumText>
          <PremiumText variant="caption" muted style={styles.bodyMuted}>
            Buluşma ekranı hazırlanıyor
          </PremiumText>
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} style={styles.matchedSpinner} />
        </View>
      );
    }

    if (session.status === 'error' || session.errorMessage) {
      return (
        <View style={styles.section}>
          {renderPollWarning()}
          <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color={LDS_COLOR_ERROR} />
            <PremiumText variant="body" muted style={styles.errorBody}>
              {session.errorMessage || 'Hızlı eşleşme şu an kullanılamıyor.'}
            </PremiumText>
          </GlassSurface>
          <SecondaryButton label="Kapat" onPress={handleClose} />
        </View>
      );
    }

    if (session.status === 'pending') {
      if (!invite) {
        return null;
      }

      return (
        <View style={styles.section}>
          {renderPollWarning()}
          <InviteDetailsBlock
            pickupLabel={pickupLabel}
            contributionTl={contributionTl}
            distanceBand={invite.distance_band}
            countdownSec={countdownSec}
          />
          <View style={styles.ctaRow}>
            <SecondaryButton
              label="Müsait Değilim"
              onPress={handleDecline}
              disabled={session.isAccepting}
              loading={session.isDeclining}
            />
            <PrimaryButton
              label="Kabul Et"
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
        <View style={styles.scrim} pointerEvents="none" />

        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <GlassSurface variant="panel" borderRadius={LDS_RADIUS.xl} style={styles.card}>
            {showDecisionHeader ? <DecisionHeader /> : null}
            {body}
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default memo(DriverQuickMatchInviteCard);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: LDS_SPACING.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.78)',
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
  phaseStep: {
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  phaseCaption: {
    textAlign: 'center',
    lineHeight: 18,
  },
  iconRing: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    marginBottom: LDS_SPACING.xs,
    ...LDS_ELEVATION.flat,
  },
  section: {
    gap: LDS_SPACING.sm,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
  },
  detailsBlock: {
    gap: LDS_SPACING.sm,
    width: '100%',
  },
  fieldBlock: {
    gap: LDS_SPACING.xxs,
  },
  fieldLabel: {
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
  },
  metricCell: {
    flex: 1,
    gap: LDS_SPACING.xxs,
  },
  inlineValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
  },
  fieldValue: {
    flex: 1,
    fontWeight: '700',
    lineHeight: 20,
  },
  contributionValue: {
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    letterSpacing: -0.3,
  },
  disclaimer: {
    lineHeight: 16,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    borderColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
  },
  countdownTextCol: {
    flex: 1,
    gap: 2,
  },
  countdownHint: {
    lineHeight: 16,
  },
  countdownText: {
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
    fontVariant: ['tabular-nums'],
  },
  countdownUrgent: {
    color: '#FBBF24',
  },
  countdownExpired: {
    color: LDS_COLOR_ERROR,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bodyMuted: {
    lineHeight: 18,
    textAlign: 'center',
  },
  loadingTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: LDS_SPACING.xxs,
  },
  pollWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.28)',
    ...LDS_ELEVATION.flat,
  },
  pollWarningText: {
    flex: 1,
    color: 'rgba(251, 191, 36, 0.95)',
    lineHeight: 17,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
    width: '100%',
    marginTop: LDS_SPACING.xxs,
  },
  primaryBtnWrap: {
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  primaryBtnDisabled: {
    opacity: 0.72,
  },
  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  primaryBtnText: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  secondaryBtnWrap: {
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  secondaryBtnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  errorCard: {
    padding: LDS_SPACING.md,
    gap: LDS_SPACING.sm,
    alignItems: 'center',
    borderColor: 'rgba(248, 113, 113, 0.35)',
    borderTopColor: 'rgba(248, 113, 113, 0.42)',
    ...LDS_ELEVATION.flat,
  },
  errorBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  successIconWrap: {
    marginBottom: LDS_SPACING.xxs,
  },
  matchedSpinner: {
    marginTop: LDS_SPACING.xxs,
  },
});
