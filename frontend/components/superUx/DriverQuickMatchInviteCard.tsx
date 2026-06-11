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
      <View style={styles.headerIconOrb}>
        <Text style={styles.headerEmoji}>⚡</Text>
      </View>
      <View style={styles.headerTextCol}>
        <Text style={styles.headerTitle}>⚡ Yakınınızda Hızlı Eşleşme</Text>
        <Text style={styles.headerSubtitle}>Yolcu size çok yakın.</Text>
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
          color={closeDisabled ? PREMIUM_TEXT_MUTED : PREMIUM_AUTH_CYAN}
        />
      </Pressable>
    </View>
  );
}

function PollWarningBanner() {
  return (
    <View style={styles.pollWarningBanner}>
      <Ionicons name="cloud-offline-outline" size={16} color="rgba(251, 191, 36, 0.95)" />
      <Text style={styles.pollWarningText}>{POLL_WARNING_COPY}</Text>
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
        styles.secondaryBtn,
        (disabled || loading) && styles.secondaryBtnDisabled,
        pressed && !disabled && !loading && styles.secondaryBtnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
      ) : (
        <Text style={styles.secondaryBtnText}>{label}</Text>
      )}
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
    <View style={styles.glassCard}>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Alış noktası</Text>
        <View style={styles.pickupRow}>
          <Ionicons name="radio-button-on" size={14} color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.fieldValue} numberOfLines={3}>
            {pickupLabel}
          </Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Mesafe bandı</Text>
        <View style={styles.inlineValueRow}>
          <Ionicons name="navigate-outline" size={14} color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.fieldValue}>{formatDistanceBand(distanceBand)}</Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Katkı teklifi</Text>
        <View style={styles.inlineValueRow}>
          <Ionicons name="cash-outline" size={14} color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.contributionValue}>{contributionTl} TL</Text>
        </View>
        <Text style={styles.disclaimer}>{CONTRIBUTION_DISCLAIMER}</Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Kalan süre</Text>
        <View style={styles.countdownRow}>
          <Ionicons
            name="timer-outline"
            size={18}
            color={countdownExpired ? '#F87171' : countdownUrgent ? '#FBBF24' : PREMIUM_AUTH_CYAN}
          />
          <Text
            style={[
              styles.countdownText,
              countdownExpired && styles.countdownExpired,
              countdownUrgent && styles.countdownUrgent,
            ]}
          >
            {countdownLabel}
          </Text>
        </View>
      </View>

      {sequenceNo != null && sequenceNo > 0 ? (
        <Text style={styles.sequenceMuted}>Sıra {sequenceNo}</Text>
      ) : null}
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

  const renderPollWarning = () =>
    session.pollErrorMessage ? <PollWarningBanner /> : null;

  const renderBody = () => {
    if (session.status === 'restoring' || session.isRestoring) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.loadingTitle}>Davet kontrol ediliyor…</Text>
        </View>
      );
    }

    if (session.status === 'accepting' || session.isAccepting) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.loadingTitle}>Eşleşme hazırlanıyor…</Text>
        </View>
      );
    }

    if (session.status === 'matched') {
      return (
        <View style={styles.centerCard}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={52} color={PREMIUM_AUTH_CYAN} />
          </View>
          <Text style={styles.title}>Eşleşme tamamlandı</Text>
          <Text style={styles.bodyMuted}>Yolculuk ekranınız hazırlanıyor.</Text>
          <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} style={styles.matchedSpinner} />
        </View>
      );
    }

    if (session.status === 'error' || session.errorMessage) {
      return (
        <View style={styles.section}>
          {renderPollWarning()}
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#F87171" />
            <Text style={styles.errorBody}>
              {session.errorMessage || 'Hızlı Eşleşme şu an kullanılamıyor.'}
            </Text>
          </View>
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
          <InviteDetailsCard
            pickupLabel={pickupLabel}
            contributionTl={contributionTl}
            distanceBand={invite.distance_band}
            countdownSec={countdownSec}
            sequenceNo={invite.sequence_no}
          />
          <PrimaryButton
            label="Kabul Et"
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
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, '#0B1220', PREMIUM_NAVY_CARD]}
        style={styles.modalRoot}
      >
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
      </LinearGradient>
    </Modal>
  );
}

export default memo(DriverQuickMatchInviteCard);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  },
  headerIconOrb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PREMIUM_AUTH_CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  headerEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
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
    gap: 14,
    paddingTop: 6,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 40,
    paddingHorizontal: 8,
  },
  glassCard: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: PREMIUM_TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  inlineValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    lineHeight: 20,
  },
  contributionValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    letterSpacing: -0.3,
  },
  disclaimer: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.92)',
    lineHeight: 16,
    marginTop: 2,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
  },
  countdownUrgent: {
    color: '#FBBF24',
  },
  countdownExpired: {
    color: '#F87171',
  },
  sequenceMuted: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.75)',
    textAlign: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bodyMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    lineHeight: 19,
    textAlign: 'center',
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    textAlign: 'center',
    marginTop: 6,
  },
  pollWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.28)',
  },
  pollWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(251, 191, 36, 0.95)',
    lineHeight: 17,
  },
  primaryBtnOuter: {
    borderRadius: 14,
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
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFF',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  errorCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.92)',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  errorBody: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  successIconWrap: {
    marginBottom: 2,
  },
  matchedSpinner: {
    marginTop: 6,
  },
});
