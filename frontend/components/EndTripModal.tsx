/**
 * EndTripModal.tsx - Modern Yolculuk Bitirme Modalı
 */

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
import { LDS_COLOR_ERROR } from '../design-system/tokens/color';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EndTripModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  onRequestApproval: () => void;
  onForceEnd: () => void;
  isDriver: boolean;
  otherUserName?: string;
}

export default function EndTripModal({
  visible,
  onClose,
  onComplete,
  onRequestApproval,
  onForceEnd,
  isDriver,
  otherUserName = 'Karşı taraf',
}: EndTripModalProps) {
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
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleComplete = () => {
    onClose();
    onComplete();
  };

  const handleRequestApproval = () => {
    onClose();
    onRequestApproval();
  };

  const handleForceEnd = () => {
    onClose();
    onForceEnd();
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
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} />

        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

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
            <View style={styles.header}>
              <View style={styles.headerIconRing}>
                <Ionicons name="flag-outline" size={26} color="rgba(34,211,238,0.92)" />
              </View>

              <GlassSurface variant="plain" style={styles.guardianChip} borderRadius={LDS_RADIUS.full}>
                <Ionicons name="shield-checkmark-outline" size={14} color="rgba(34,211,238,0.82)" />
                <PremiumText variant="caption" style={styles.guardianChipText}>
                  Yolculuk sonu
                </PremiumText>
              </GlassSurface>

              <PremiumText variant="title" style={styles.headerTitle}>
                Yolculuğu nasıl tamamlamak istiyorsunuz?
              </PremiumText>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity onPress={handleComplete} activeOpacity={0.88}>
                <GlassSurface variant="plain" style={styles.optionCard} borderRadius={LDS_RADIUS.md}>
                  <View style={styles.optionIconRing}>
                    <Ionicons name="checkmark-circle-outline" size={22} color="rgba(34,211,238,0.92)" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <PremiumText variant="body" style={styles.optionTitle}>
                      Tamamla
                    </PremiumText>
                    <PremiumText variant="caption" muted style={styles.optionDescription}>
                      Yolculuğu şimdi bitir (0 puan)
                    </PremiumText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(186,201,222,0.55)" />
                </GlassSurface>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRequestApproval} activeOpacity={0.88}>
                <GlassSurface variant="plain" style={styles.optionCard} borderRadius={LDS_RADIUS.md}>
                  <View style={styles.optionIconRing}>
                    <Ionicons name="hand-left-outline" size={22} color="rgba(34,211,238,0.88)" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <PremiumText variant="body" style={styles.optionTitle}>
                      Karşılıklı onay
                    </PremiumText>
                    <PremiumText variant="caption" muted style={styles.optionDescription}>
                      {`${otherUserName}'dan onay bekle (+1 puan)`}
                    </PremiumText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(186,201,222,0.55)" />
                </GlassSurface>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity onPress={handleForceEnd} activeOpacity={0.88}>
                <GlassSurface variant="plain" style={[styles.optionCard, styles.dangerOption]} borderRadius={LDS_RADIUS.md}>
                  <View style={[styles.optionIconRing, styles.dangerIconRing]}>
                    <Ionicons name="warning-outline" size={22} color="rgba(248,113,113,0.9)" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <PremiumText variant="body" style={styles.dangerTitle}>
                      Zorla bitir
                    </PremiumText>
                    <PremiumText variant="caption" style={styles.dangerCaption}>
                      Puanınız 5 düşer
                    </PremiumText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(248,113,113,0.55)" />
                </GlassSurface>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.85}>
              <PremiumText variant="body" muted style={styles.cancelText}>
                Vazgeç
              </PremiumText>
            </TouchableOpacity>
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
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalWrap: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalContainer: {
    width: '100%',
    overflow: 'hidden',
    ...LDS_ELEVATION.cockpit,
  },
  header: {
    alignItems: 'center',
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30, 58, 95, 0.55)',
  },
  headerIconRing: {
    width: 56,
    height: 56,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
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
  headerTitle: {
    textAlign: 'center',
    paddingHorizontal: LDS_SPACING.xxs,
  },
  optionsContainer: {
    padding: LDS_SPACING.md,
    gap: LDS_SPACING.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: LDS_SPACING.sm + 2,
    backgroundColor: 'rgba(5,11,24,0.42)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  optionIconRing: {
    width: 44,
    height: 44,
    borderRadius: LDS_RADIUS.orb,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: LDS_SPACING.sm,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
  },
  optionTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDescription: {
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    marginVertical: LDS_SPACING.xxs,
  },
  dangerOption: {
    backgroundColor: 'rgba(55,10,22,0.32)',
    borderColor: 'rgba(248,113,113,0.32)',
    borderTopColor: 'rgba(239,68,68,0.18)',
  },
  dangerIconRing: {
    borderColor: 'rgba(248,113,113,0.35)',
    borderTopColor: 'rgba(239,68,68,0.22)',
  },
  dangerTitle: {
    fontWeight: '700',
    color: 'rgba(252, 165, 165, 0.96)',
    marginBottom: 2,
  },
  dangerCaption: {
    color: LDS_COLOR_ERROR,
    opacity: 0.82,
    lineHeight: 16,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.md,
    marginHorizontal: LDS_SPACING.md,
    marginBottom: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.flat,
  },
  cancelText: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
