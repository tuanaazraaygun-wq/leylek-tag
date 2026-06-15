import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { CockpitBackground, GlassSurface, PremiumText } from '../../design-system/primitives';
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

function InviteHeader({
  onClose,
  closeDisabled,
}: {
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  return (
    <View style={styles.headerRow}>
      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.sm} style={styles.headerIconOrb}>
        <Ionicons name="flash-outline" size={20} color={PREMIUM_AUTH_CYAN} />
      </GlassSurface>
      <View style={styles.headerTextCol}>
        <PremiumText variant="step" style={styles.headerTitle}>
          Hızlı eşleşme isteği
        </PremiumText>
        <PremiumText variant="caption" muted style={styles.headerSubtitle}>
          Yakındaki yolcu değerlendiriliyor
        </PremiumText>
      </View>
      <Pressable
        onPress={onClose}
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
          color={closeDisabled ? 'rgba(186,201,222,0.55)' : PREMIUM_AUTH_CYAN}
        />
      </Pressable>
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
        styles.primaryBtnOuter,
        (disabled || loading) && styles.primaryBtnDisabled,
        pressed && !disabled && !loading && styles.primaryBtnPressed,
      ]}
    >
      <GlassSurface
        variant="plain"
        borderRadius={LDS_RADIUS.md}
        style={[
          styles.primaryBtnSurface,
          (disabled || loading) && styles.primaryBtnSurfaceDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
        ) : (
          <PremiumText variant="body" style={styles.primaryBtnText}>
            {label}
          </PremiumText>
        )}
      </GlassSurface>
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
        styles.secondaryBtnOuter,
        (disabled || loading) && styles.secondaryBtnDisabled,
        pressed && !disabled && !loading && styles.secondaryBtnPressed,
      ]}
    >
      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={styles.secondaryBtnSurface}>
        {loading ? (
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
        ) : (
          <PremiumText variant="body" muted style={styles.secondaryBtnText}>
            {label}
          </PremiumText>
        )}
      </GlassSurface>
    </Pressable>
  );
}

function InviteDetailsCard({
  pickupLabel,
  contributionTl,
  distanceBand,
  countdownSec,
  sequenceNo,
}: {
  pickupLabel: string;
  contributionTl: number;
  distanceBand: string | null | undefined;
  countdownSec: number | null;
  sequenceNo?: number | null;
}) {
  const countdownLabel = formatCountdownLabel(countdownSec);
  const countdownExpired = countdownSec != null && countdownSec <= 0;
  const countdownUrgent =
    countdownSec != null && countdownSec > 0 && countdownSec <= 15;

  return (
    <GlassSurface variant="panel" borderRadius={LDS_RADIUS.md} style={styles.glassCard}>
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

      <View style={styles.fieldBlock}>
        <PremiumText variant="caption" muted style={styles.fieldLabel}>
          Mesafe bandı
        </PremiumText>
        <View style={styles.inlineValueRow}>
          <Ionicons name="navigate-outline" size={14} color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="body" style={styles.fieldValue}>
            {formatDistanceBand(distanceBand)}
          </PremiumText>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <PremiumText variant="caption" muted style={styles.fieldLabel}>
          Katkı teklifi
        </PremiumText>
        <View style={styles.inlineValueRow}>
          <Ionicons name="cash-outline" size={14} color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="title" style={styles.contributionValue}>
            {contributionTl} TL
          </PremiumText>
        </View>
        <PremiumText variant="caption" muted style={styles.disclaimer}>
          {CONTRIBUTION_DISCLAIMER}
        </PremiumText>
      </View>

      <View style={styles.fieldBlock}>
        <PremiumText variant="caption" muted style={styles.fieldLabel}>
          Kalan süre
        </PremiumText>
        <GlassSurface variant="plain" borderRadius={LDS_RADIUS.sm} style={styles.countdownChip}>
          <Ionicons
            name="timer-outline"
            size={18}
            color={countdownExpired ? LDS_COLOR_ERROR : countdownUrgent ? '#FBBF24' : PREMIUM_AUTH_CYAN}
          />
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
        </GlassSurface>
      </View>

      {sequenceNo != null && sequenceNo > 0 ? (
        <PremiumText variant="caption" muted style={styles.sequenceMuted}>
          Sıra {sequenceNo}
        </PremiumText>
      ) : null}
    </GlassSurface>
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

  const closeDisabled = session.isAccepting || session.isDeclining;

  const handleClose = useCallback(() => {
    if (closeDisabled) {
      return;
    }
    onClose();
  }, [closeDisabled, onClose]);

  const handleAccept = useCallback(() => {
    void onAccept();
  }, [onAccept]);

  const handleDecline = useCallback(() => {
    void onDecline();
  }, [onDecline]);

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
            <Ionicons name="checkmark-circle" size={52} color={PREMIUM_AUTH_CYAN} />
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
          <PremiumText variant="caption" muted style={styles.decisionHint}>
            Kabul edersen buluşma ekranına geçeceksin
          </PremiumText>
          <InviteDetailsCard
            pickupLabel={pickupLabel}
            contributionTl={contributionTl}
            distanceBand={invite.distance_band}
            countdownSec={countdownSec}
            sequenceNo={invite.sequence_no}
          />
          <PrimaryButton
            label="Kabul et"
            onPress={handleAccept}
            disabled={session.isDeclining || inviteExpired}
            loading={session.isAccepting}
          />
          <SecondaryButton
            label="Reddet"
            onPress={handleDecline}
            disabled={session.isAccepting}
            loading={session.isDeclining}
          />
        </View>
      );
    }

    return null;
  };

  const body = renderBody();
  if (body == null) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <InviteHeader onClose={handleClose} closeDisabled={closeDisabled} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default memo(DriverQuickMatchInviteCard);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm + LDS_SPACING.xxs,
    paddingVertical: LDS_SPACING.sm,
    borderBottomWidth: LDS_BORDER_WIDTH.hairline,
    borderBottomColor: LDS_BORDER_COLOR.cardTopCyan,
  },
  headerIconOrb: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  headerTitle: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    lineHeight: 16,
  },
  closeBtn: {
    padding: LDS_SPACING.xxs,
    borderRadius: LDS_RADIUS.sm,
  },
  closeBtnDisabled: {
    opacity: 0.45,
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  section: {
    gap: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xs,
  },
  decisionHint: {
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xl + LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.sm,
  },
  glassCard: {
    padding: LDS_SPACING.sm + LDS_SPACING.xxs,
    gap: LDS_SPACING.sm,
    ...LDS_ELEVATION.panel,
  },
  fieldBlock: {
    gap: LDS_SPACING.xs,
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
  inlineValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
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
    marginTop: LDS_SPACING.xxs,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    borderColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
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
  sequenceMuted: {
    textAlign: 'center',
    marginTop: LDS_SPACING.xxs,
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
    marginTop: LDS_SPACING.xs,
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
  primaryBtnOuter: {
    borderRadius: LDS_RADIUS.md,
    overflow: 'hidden',
  },
  primaryBtnDisabled: {
    opacity: 0.72,
  },
  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  primaryBtnSurface: {
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  primaryBtnSurfaceDisabled: {
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
  },
  primaryBtnText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtnOuter: {
    borderRadius: LDS_RADIUS.md,
    overflow: 'hidden',
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  secondaryBtnSurface: {
    paddingVertical: LDS_SPACING.sm + LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  secondaryBtnText: {
    fontWeight: '700',
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
    marginTop: LDS_SPACING.xs,
  },
});
