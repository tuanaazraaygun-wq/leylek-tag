/**
 * ForceEndConfirmModal.tsx - Zorla bitir onay modalı
 */

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
import { LDS_COLOR_ERROR, PREMIUM_AUTH_CYAN, PREMIUM_TEXT_SOFT } from '../design-system/tokens/color';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ForceEndConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ForceEndConfirmModal({
  visible,
  onClose,
  onConfirm,
}: ForceEndConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { isLight, tokens } = useTheme();
  const isModalLight = lightThemeEnabled && isLight;

  const lightStyles = useMemo(() => {
    if (!isModalLight) return null;
    const t = tokens;
    return {
      backdrop: { backgroundColor: t.shadow.modal },
      panel: {
        backgroundColor: t.bg.elevated,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      iconShell: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
      },
      infoIconColor: t.accent.secondary,
      guardianChip: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      chipIconColor: t.accent.secondary,
      guardianChipText: { color: t.text.primary },
      title: { color: t.text.primary },
      riskPanel: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
      },
      cancelButton: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
      },
      cancelButtonText: { color: t.text.primary },
      confirmButton: {
        backgroundColor: 'rgba(220,38,38,0.08)',
        borderColor: 'rgba(220,38,38,0.28)',
        borderTopColor: 'rgba(220,38,38,0.18)',
      },
      confirmIconColor: t.status.error,
      confirmButtonText: { color: t.status.error },
    };
  }, [isModalLight, tokens]);

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
  }, [visible, opacityAnim, scaleAnim]);

  const handleConfirm = () => {
    onClose();
    onConfirm();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <CockpitBackground />
        <View style={[StyleSheet.absoluteFill, styles.backdrop, lightStyles?.backdrop]} />

        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GlassSurface variant="panel" borderRadius={LDS_RADIUS.xl} style={[styles.panel, lightStyles?.panel]}>
            <GlassSurface
              variant="plain"
              borderRadius={LDS_RADIUS.full}
              style={[styles.iconShell, lightStyles?.iconShell]}
            >
              <Ionicons
                name="information-circle-outline"
                size={40}
                color={lightStyles?.infoIconColor ?? PREMIUM_AUTH_CYAN}
              />
            </GlassSurface>

            <GlassSurface
              variant="plain"
              borderRadius={LDS_RADIUS.full}
              style={[styles.guardianChip, lightStyles?.guardianChip]}
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

            <PremiumText variant="title" style={[styles.title, lightStyles?.title]}>
              Zorla bitir
            </PremiumText>

            <PremiumText variant="body" muted style={styles.description}>
              Bu işlem yalnızca yolculuk güvenli şekilde tamamlanamıyorsa kullanılmalıdır.
            </PremiumText>
            <PremiumText variant="body" muted style={styles.descriptionSecondary}>
              QR ile tamamlamak her zaman önceliklidir.
            </PremiumText>

            <GlassSurface
              variant="plain"
              borderRadius={LDS_RADIUS.md}
              style={[styles.riskPanel, lightStyles?.riskPanel]}
            >
              <PremiumText variant="caption" muted style={styles.riskPanelText}>
                Bu işlem değerlendirme sonucunu etkileyebilir.
              </PremiumText>
            </GlassSurface>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButtonWrap}
                onPress={onClose}
                activeOpacity={0.88}
              >
                <GlassSurface
                  variant="plain"
                  borderRadius={LDS_RADIUS.md}
                  style={[styles.cancelButton, lightStyles?.cancelButton]}
                >
                  <PremiumText
                    variant="body"
                    muted={!isModalLight}
                    style={[styles.cancelButtonText, lightStyles?.cancelButtonText]}
                  >
                    Vazgeç
                  </PremiumText>
                </GlassSurface>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButtonWrap}
                onPress={handleConfirm}
                activeOpacity={0.88}
              >
                <GlassSurface
                  variant="plain"
                  borderRadius={LDS_RADIUS.md}
                  style={[styles.confirmButton, lightStyles?.confirmButton]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={lightStyles?.confirmIconColor ?? 'rgba(252,165,165,0.96)'}
                  />
                  <PremiumText variant="body" style={[styles.confirmButtonText, lightStyles?.confirmButtonText]}>
                    Yine de zorla bitir
                  </PremiumText>
                </GlassSurface>
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
  },
  backdrop: {
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 360,
    alignItems: 'center',
  },
  panel: {
    width: '100%',
    paddingVertical: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(16,26,43,0.96)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.panel,
  },
  iconShell: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LDS_SPACING.sm,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.chip,
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
  title: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    marginBottom: LDS_SPACING.sm,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: LDS_SPACING.xs,
    width: '100%',
  },
  descriptionSecondary: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: LDS_SPACING.md,
    width: '100%',
  },
  riskPanel: {
    width: '100%',
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.lg,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  riskPanelText: {
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
    width: '100%',
  },
  cancelButtonWrap: {
    flex: 1,
  },
  confirmButtonWrap: {
    flex: 1,
  },
  cancelButton: {
    paddingVertical: LDS_SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.chip,
  },
  cancelButtonText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.sm,
    gap: LDS_SPACING.xxs,
    backgroundColor: 'rgba(69,10,10,0.42)',
    borderColor: 'rgba(248,113,113,0.35)',
    borderTopColor: 'rgba(248,113,113,0.22)',
    ...LDS_ELEVATION.chip,
  },
  confirmButtonText: {
    fontWeight: '700',
    color: LDS_COLOR_ERROR,
    textAlign: 'center',
  },
});
