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
import { GlassSurface, PremiumText } from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { useQrPaymentTrustTheme } from '../../lib/theme/useQrPaymentTrustTheme';
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
  return phase === 'pending' || phase === 'matching';
}

function TrustedDirectWaitingOverlay({
  visible,
  phase,
  responderLabel,
  pollErrorMessage,
  isCancelling = false,
  onCancel,
}: TrustedDirectWaitingOverlayProps) {
  const { tdmModalSurfaces: tdmLt, ui } = useQrPaymentTrustTheme('trust');
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
        <View style={[styles.scrim, tdmLt?.scrim]} pointerEvents="none" />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <GlassSurface
            variant="panel"
            borderRadius={LDS_RADIUS.xl}
            style={[styles.card, tdmLt?.card]}
          >
            <View style={[styles.iconOrb, tdmLt?.iconOrb]}>
              <ActivityIndicator size="large" color={ui.activity} />
            </View>

            <PremiumText
              variant="title"
              style={[styles.title, { color: ui.textSoft }]}
            >
              {copy.title}
            </PremiumText>

            <PremiumText
              variant="body"
              muted
              style={[styles.body, { color: ui.textMuted }]}
            >
              {copy.body}
            </PremiumText>

            {phase === 'creating' ? (
              <PremiumText
                variant="caption"
                muted
                style={[styles.phaseHint, { color: ui.textMuted }]}
              >
                {TDM_WAITING_CREATING_HINT}
              </PremiumText>
            ) : null}

            {pollErrorMessage ? (
              <GlassSurface
                variant="plain"
                borderRadius={LDS_RADIUS.sm}
                style={[styles.pollWarning, tdmLt?.pollWarning]}
              >
                <Ionicons name="cloud-offline-outline" size={16} color="#FBBF24" />
                <PremiumText variant="caption" style={styles.pollErrorText}>
                  {pollErrorMessage}
                </PremiumText>
              </GlassSurface>
            ) : null}

            {showCancel ? (
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  tdmLt?.cancelBtn,
                  isCancelling && styles.cancelBtnDisabled,
                  pressed && !isCancelling && styles.cancelBtnPressed,
                ]}
                onPress={onCancel}
                disabled={isCancelling}
                accessibilityRole="button"
                accessibilityLabel={TDM_WAITING_CANCEL}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={ui.activity} />
                ) : (
                  <>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color={ui.errorIcon}
                    />
                    <PremiumText
                      variant="label"
                      style={[styles.cancelText, tdmLt?.cancelBtnText, { color: ui.errorIcon }]}
                    >
                      {TDM_WAITING_CANCEL}
                    </PremiumText>
                  </>
                )}
              </Pressable>
            ) : null}

            {phase === 'matching' ? (
              <PremiumText
                variant="caption"
                muted
                style={[styles.matchingHint, { color: ui.textMuted }]}
              >
                {TDM_WAITING_MATCHING_HINT}
              </PremiumText>
            ) : null}
          </GlassSurface>
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
    paddingHorizontal: LDS_SPACING.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.82)',
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    paddingHorizontal: LDS_SPACING.lg,
    paddingVertical: LDS_SPACING.xl,
    gap: LDS_SPACING.sm,
    ...LDS_ELEVATION.cockpit,
  },
  iconOrb: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 11, 24, 0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    marginBottom: LDS_SPACING.xxs,
    ...LDS_ELEVATION.flat,
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  phaseHint: {
    textAlign: 'center',
    lineHeight: 18,
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
  pollErrorText: {
    flex: 1,
    color: 'rgba(251, 191, 36, 0.95)',
    lineHeight: 17,
  },
  cancelBtn: {
    marginTop: LDS_SPACING.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: 12,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.thin,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    minHeight: 48,
  },
  cancelBtnDisabled: {
    opacity: 0.55,
  },
  cancelBtnPressed: {
    opacity: 0.88,
  },
  cancelText: {
    fontWeight: '800',
  },
  matchingHint: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
