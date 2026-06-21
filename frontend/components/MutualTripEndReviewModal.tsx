import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { useTheme } from '../hooks/useTheme';
import { lightThemeEnabled } from '../lib/featureFlags';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type MutualTripEndRequesterRole = 'driver' | 'passenger' | null;

export type MutualTripEndReviewModalProps = {
  visible: boolean;
  requesterRole: MutualTripEndRequesterRole;
  submitting?: boolean;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  onClose: () => void;
};

function resolveBodyCopy(requesterRole: MutualTripEndRequesterRole): string {
  if (requesterRole === 'driver') {
    return 'Sürücü yolculuğu bitirmek istiyor. Onaylıyor musun?';
  }
  if (requesterRole === 'passenger') {
    return 'Yolcu yolculuğu bitirmek istiyor. Onaylıyor musun?';
  }
  return 'Karşı taraf yolculuğu bitirmek istiyor. Onaylıyor musun?';
}

export default function MutualTripEndReviewModal({
  visible,
  requesterRole,
  submitting = false,
  onApprove,
  onReject,
  onClose,
}: MutualTripEndReviewModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { isLight, tokens } = useTheme();
  const isModalLight = lightThemeEnabled && isLight;

  const lightStyles = useMemo(() => {
    if (!isModalLight) return null;
    const t = tokens;
    return {
      scrim: { backgroundColor: t.shadow.modal },
      iconOrb: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      iconColor: t.accent.secondary,
      guardianChip: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      chipIconColor: t.accent.secondary,
      guardianChipText: { color: t.text.primary },
      primaryBtn: {
        backgroundColor: t.accent.primary,
        borderColor: t.borderColors.selected,
        borderTopColor: t.borderColors.selectedTop,
      },
      primaryBtnText: { color: t.text.inverse },
      secondaryBtn: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
      },
      secondaryBtnText: { color: t.text.primary },
    };
  }, [isModalLight, tokens]);

  const bodyCopy = useMemo(() => resolveBodyCopy(requesterRole), [requesterRole]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={[styles.scrim, lightStyles?.scrim]} pointerEvents="none" />
        <Animated.View
          style={[
            styles.modalWrap,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GlassSurface variant="panel" borderRadius={LDS_RADIUS.xl} style={styles.modalContainer}>
            <View style={styles.iconContainer}>
              <View style={[styles.iconOrb, lightStyles?.iconOrb]}>
                <Ionicons
                  name="hand-left-outline"
                  size={30}
                  color={lightStyles?.iconColor ?? 'rgba(34,211,238,0.92)'}
                />
              </View>
            </View>

            <GlassSurface
              variant="plain"
              style={[styles.guardianChip, lightStyles?.guardianChip]}
              borderRadius={LDS_RADIUS.full}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={lightStyles?.chipIconColor ?? 'rgba(34,211,238,0.82)'}
              />
              <PremiumText
                variant="caption"
                style={[styles.guardianChipText, lightStyles?.guardianChipText]}
              >
                Bitiş onayı
              </PremiumText>
            </GlassSurface>

            <PremiumText variant="step" style={styles.phaseTitle}>
              Yolculuk bitirme isteği
            </PremiumText>

            <PremiumText variant="body" muted style={styles.bodyCopy}>
              {bodyCopy}
            </PremiumText>

            <PremiumText variant="caption" muted style={styles.hintCopy}>
              Onayın yolculuk kaydına işlenir.
            </PremiumText>

            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={[styles.primaryBtn, lightStyles?.primaryBtn, submitting && styles.btnDisabled]}
                onPress={() => void onApprove()}
                activeOpacity={0.88}
                disabled={submitting}
              >
                <PremiumText variant="body" style={[styles.primaryBtnText, lightStyles?.primaryBtnText]}>
                  {submitting ? 'Gönderiliyor…' : 'Onaylıyorum'}
                </PremiumText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, lightStyles?.secondaryBtn, submitting && styles.btnDisabled]}
                onPress={() => void onReject()}
                activeOpacity={0.88}
                disabled={submitting}
              >
                <PremiumText
                  variant="body"
                  muted={!isModalLight}
                  style={[styles.secondaryBtnText, lightStyles?.secondaryBtnText]}
                >
                  {submitting ? 'Gönderiliyor…' : 'Onaylamıyorum'}
                </PremiumText>
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.md,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  modalWrap: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 380,
    alignSelf: 'center',
  },
  modalContainer: {
    width: '100%',
    paddingVertical: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    alignItems: 'center',
    ...LDS_ELEVATION.cockpit,
  },
  iconContainer: {
    marginBottom: LDS_SPACING.sm,
  },
  iconOrb: {
    width: 64,
    height: 64,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cardTopCyan,
    borderTopColor: 'rgba(34,211,238,0.42)',
    ...LDS_ELEVATION.flat,
  },
  guardianChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.sm,
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
  phaseTitle: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.xxs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bodyCopy: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.xxs,
    lineHeight: 22,
  },
  hintCopy: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.xs,
    lineHeight: 18,
  },
  buttonColumn: {
    width: '100%',
    gap: LDS_SPACING.sm,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: LDS_SPACING.sm + 2,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  primaryBtnText: {
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: LDS_SPACING.sm + 2,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  secondaryBtnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
