import React, { memo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CockpitBackground, PremiumText } from '../../design-system/primitives';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  PREMIUM_TEXT_SOFT,
} from '../auth/premiumAuthStyles';
import {
  TDM_WAITING_CANCEL,
  TDM_WAITING_CREATING_HINT,
  TDM_WAITING_MATCHING_BODY,
  TDM_WAITING_MATCHING_HINT,
  TDM_WAITING_MATCHING_TITLE,
  TDM_WAITING_PENDING_BODY,
  TDM_WAITING_PENDING_TITLE,
  TDM_WAITING_SENDING_TITLE,
} from '../../lib/trustedHubCopy';
import type { TrustedDirectPassengerSessionStatus } from '../../hooks/useTrustedDirectPassengerSession';

export type TrustedDirectWaitingOverlayProps = {
  visible: boolean;
  phase: TrustedDirectPassengerSessionStatus;
  responderLabel?: string | null;
  pollErrorMessage?: string | null;
  isCancelling?: boolean;
  onCancel: () => void;
};

function resolveCopy(
  phase: TrustedDirectPassengerSessionStatus,
  responderLabel?: string | null,
): { title: string; body: string } {
  if (phase === 'creating') {
    return {
      title: TDM_WAITING_SENDING_TITLE,
      body: responderLabel
        ? `${responderLabel} için istek hazırlanıyor…`
        : 'İstek gönderiliyor…',
    };
  }
  if (phase === 'matching') {
    return {
      title: TDM_WAITING_MATCHING_TITLE,
      body: TDM_WAITING_MATCHING_BODY,
    };
  }
  const name = (responderLabel || '').trim();
  return {
    title: TDM_WAITING_PENDING_TITLE,
    body: name
      ? TDM_WAITING_PENDING_BODY.replace('{name}', name)
      : 'Sürücünün yanıtını bekliyoruz.',
  };
}

function canCancelPhase(phase: TrustedDirectPassengerSessionStatus): boolean {
  return phase === 'pending';
}

function TrustedDirectWaitingOverlay({
  visible,
  phase,
  responderLabel,
  pollErrorMessage,
  isCancelling = false,
  onCancel,
}: TrustedDirectWaitingOverlayProps) {
  const copy = resolveCopy(phase, responderLabel);
  const showCancel = canCancelPhase(phase);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!isCancelling && showCancel) {
          onCancel();
        }
      }}
    >
      <View style={styles.backdrop}>
        <LinearGradient
          colors={['rgba(5, 11, 24, 0.92)', 'rgba(11, 18, 32, 0.96)']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.card}>
            <CockpitBackground />
            <View style={styles.iconOrb}>
              <ActivityIndicator size="large" color={PREMIUM_AUTH_CYAN} />
            </View>
            <PremiumText variant="title" style={styles.title}>
              {copy.title}
            </PremiumText>
            <PremiumText variant="body" muted style={styles.body}>
              {copy.body}
            </PremiumText>
            {phase === 'creating' ? (
              <PremiumText variant="caption" muted style={styles.phaseHint}>
                {TDM_WAITING_CREATING_HINT}
              </PremiumText>
            ) : null}
            {pollErrorMessage ? (
              <PremiumText variant="caption" style={styles.pollError}>
                {pollErrorMessage}
              </PremiumText>
            ) : null}
            {showCancel ? (
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  isCancelling && styles.cancelBtnDisabled,
                  pressed && !isCancelling && styles.cancelBtnPressed,
                ]}
                onPress={onCancel}
                disabled={isCancelling}
                accessibilityRole="button"
                accessibilityLabel={TDM_WAITING_CANCEL}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
                ) : (
                  <>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="rgba(252, 165, 165, 0.92)"
                    />
                    <PremiumText variant="label" style={styles.cancelText}>
                      {TDM_WAITING_CANCEL}
                    </PremiumText>
                  </>
                )}
              </Pressable>
            ) : null}
            {phase === 'matching' ? (
              <PremiumText variant="caption" muted style={styles.matchingHint}>
                {TDM_WAITING_MATCHING_HINT}
              </PremiumText>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default memo(TrustedDirectWaitingOverlay);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
  },
  iconOrb: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
    color: PREMIUM_TEXT_SOFT,
    fontWeight: '800',
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  phaseHint: {
    textAlign: 'center',
    lineHeight: 18,
  },
  pollError: {
    textAlign: 'center',
    color: 'rgba(251, 191, 36, 0.92)',
  },
  cancelBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
  },
  cancelBtnDisabled: {
    opacity: 0.55,
  },
  cancelBtnPressed: {
    opacity: 0.88,
  },
  cancelText: {
    color: 'rgba(252, 165, 165, 0.92)',
    fontWeight: '800',
  },
  matchingHint: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
