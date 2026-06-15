import React, { useEffect, useRef } from 'react';
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
  /** true iken butonlar devre dışı — HTTP bitmeden kapanmaz */
  submitting?: boolean;
};

export default function PassengerDriverForceEndReviewModal({
  visible,
  onConfirm,
  onReject,
  title,
  submitting = false,
}: PassengerDriverForceEndReviewModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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

  const eventLine = title?.trim() ? title.trim() : 'Sürücü eşleşmeyi zorla bitirdi';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
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
              <View style={styles.iconOrb}>
                <Ionicons name="alert-circle-outline" size={32} color="rgba(253,224,71,0.92)" />
              </View>
            </View>

            <GlassSurface variant="plain" style={styles.guardianChip} borderRadius={LDS_RADIUS.full}>
              <Ionicons name="shield-checkmark-outline" size={14} color="rgba(34,211,238,0.82)" />
              <PremiumText variant="caption" style={styles.guardianChipText}>
                Bitiş onayı
              </PremiumText>
            </GlassSurface>

            <PremiumText variant="body" muted style={styles.eventLine}>
              {eventLine}
            </PremiumText>

            <PremiumText variant="title" style={styles.questionTitle}>
              Bu bitişi onaylıyor musunuz?
            </PremiumText>

            <PremiumText variant="caption" muted style={styles.description}>
              Yanıtınız yolculuk kaydına işlenir. Lütfen durumu sakin şekilde değerlendirin.
            </PremiumText>

            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                onPress={() => void onConfirm()}
                activeOpacity={0.88}
                disabled={submitting}
              >
                <PremiumText variant="body" style={styles.primaryBtnText}>
                  {submitting ? 'Gönderiliyor…' : 'Onaylıyorum'}
                </PremiumText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, submitting && styles.btnDisabled]}
                onPress={() => void onReject()}
                activeOpacity={0.88}
                disabled={submitting}
              >
                <PremiumText variant="body" muted style={styles.secondaryBtnText}>
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
  backdrop: {
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
