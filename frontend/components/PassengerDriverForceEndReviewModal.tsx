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
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { useTheme } from '../hooks/useTheme';
import { lightThemeEnabled } from '../lib/featureFlags';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type PassengerDriverForceEndReviewModalProps = {
  visible: boolean;
  onConfirm: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  /** Varsayılan: sürücü zorla bitirdi metni */
  title?: string;
  /** Biniş öncesi bilgilendirme — onay/red yok, yalnızca Tamam */
  informationalOnly?: boolean;
  /** Bilgilendirme gövde metni (backend message) */
  infoMessage?: string;
  /** true iken butonlar devre dışı — HTTP bitmeden kapanmaz */
  submitting?: boolean;
};

export default function PassengerDriverForceEndReviewModal({
  visible,
  onConfirm,
  onReject,
  title,
  informationalOnly = false,
  infoMessage,
  submitting = false,
}: PassengerDriverForceEndReviewModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { isLight, tokens } = useTheme();
  const isModalLight = lightThemeEnabled && isLight;

  const lightStyles = useMemo(() => {
    if (!isModalLight) return null;
    const t = tokens;
    return {
      backdrop: { backgroundColor: 'rgba(15,23,42,0.44)' },
      panel: {
        backgroundColor: t.bg.elevated,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      iconOrb: {
        backgroundColor: t.bg.glassMuted,
        borderColor: 'rgba(217,119,6,0.32)',
        borderTopColor: 'rgba(253,224,71,0.24)',
      },
      alertIconColor: t.status.warning,
      guardianChip: {
        backgroundColor: t.bg.glassMuted,
        borderColor: t.border.default,
        borderTopColor: t.borderColors.cardTopCyan,
      },
      chipIconColor: t.accent.secondary,
      guardianChipText: { color: t.text.primary },
      eventLine: { color: t.text.primary },
      questionTitle: { color: t.text.primary },
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

  const eventLine = title?.trim()
    ? title.trim()
    : informationalOnly
      ? 'Eşleşme biniş onayından önce sonlandırıldı'
      : 'Sürücü eşleşmeyi zorla bitirdi';

  const bodyLine =
    infoMessage?.trim() ||
    (informationalOnly
      ? 'Karşı taraf eşleşmeyi biniş QR kodu okutulmadan sonlandırdı. Onayınız gerekmez.'
      : null);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (informationalOnly) void onConfirm();
      }}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[StyleSheet.absoluteFill, styles.backdrop, lightStyles?.backdrop]} />
        <Animated.View
          style={[
            styles.modalWrap,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GlassSurface
            variant="panel"
            borderRadius={LDS_RADIUS.xl}
            style={[styles.modalContainer, lightStyles?.panel]}
          >
            <View style={styles.iconContainer}>
              <View style={[styles.iconOrb, lightStyles?.iconOrb]}>
                <Ionicons
                  name={informationalOnly ? 'information-circle-outline' : 'alert-circle-outline'}
                  size={32}
                  color={lightStyles?.alertIconColor ?? 'rgba(253,224,71,0.92)'}
                />
              </View>
            </View>

            <GlassSurface
              variant="plain"
              style={[styles.guardianChip, lightStyles?.guardianChip]}
              borderRadius={LDS_RADIUS.full}
            >
              <Ionicons
                name={informationalOnly ? 'notifications-outline' : 'shield-checkmark-outline'}
                size={14}
                color={lightStyles?.chipIconColor ?? 'rgba(34,211,238,0.82)'}
              />
              <PremiumText
                variant="caption"
                style={[styles.guardianChipText, lightStyles?.guardianChipText]}
              >
                {informationalOnly ? 'Bilgilendirme' : 'Bitiş onayı'}
              </PremiumText>
            </GlassSurface>

            <PremiumText variant="body" muted={!isModalLight} style={[styles.eventLine, lightStyles?.eventLine]}>
              {eventLine}
            </PremiumText>

            {bodyLine ? (
              <PremiumText variant="caption" muted style={styles.description}>
                {bodyLine}
              </PremiumText>
            ) : null}

            {!informationalOnly ? (
              <>
                <PremiumText variant="title" style={[styles.questionTitle, lightStyles?.questionTitle]}>
                  Bu bitişi onaylıyor musunuz?
                </PremiumText>

                <PremiumText variant="caption" muted style={styles.description}>
                  Yanıtınız yolculuk kaydına işlenir. Lütfen durumu sakin şekilde değerlendirin.
                </PremiumText>
              </>
            ) : null}

            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={[styles.primaryBtn, lightStyles?.primaryBtn, submitting && styles.btnDisabled]}
                onPress={() => void onConfirm()}
                activeOpacity={0.88}
                disabled={submitting}
              >
                <PremiumText variant="body" style={[styles.primaryBtnText, lightStyles?.primaryBtnText]}>
                  {submitting ? 'Gönderiliyor…' : informationalOnly ? 'Tamam' : 'Onaylıyorum'}
                </PremiumText>
              </TouchableOpacity>
              {!informationalOnly ? (
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
              ) : null}
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
  backdrop: {
    backgroundColor: 'rgba(8,17,31,0.72)',
    zIndex: 1,
  },
  modalWrap: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 380,
    alignSelf: 'center',
    zIndex: 2,
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
    borderColor: 'rgba(251,191,36,0.38)',
    borderTopColor: 'rgba(253,224,71,0.28)',
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
  eventLine: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.xxs,
    lineHeight: 22,
  },
  questionTitle: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  description: {
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
