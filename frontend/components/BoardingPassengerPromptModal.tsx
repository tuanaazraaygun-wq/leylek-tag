import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

type Props = {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
};

export default function BoardingPassengerPromptModal({ visible, onYes, onNo }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable style={styles.overlay} onPress={onNo}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <GlassSurface variant="panel" style={styles.card} borderRadius={LDS_RADIUS.xl}>
            <View style={styles.phaseBlock}>
              <PremiumText variant="step" style={styles.phaseStep}>
                Güvenli biniş
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                Doğru araçta olduğunu teyit et.
              </PremiumText>
            </View>

            <View style={styles.iconRing}>
              <Ionicons name="car-sport-outline" size={26} color="rgba(34,211,238,0.92)" />
            </View>

            <PremiumText variant="body" style={styles.questionText}>
              Araca bindiniz mi?
            </PremiumText>

            <GlassSurface variant="plain" style={styles.guardianChip} borderRadius={LDS_RADIUS.full}>
              <Ionicons name="shield-checkmark-outline" size={15} color="rgba(34,211,238,0.88)" />
              <PremiumText variant="caption" style={styles.guardianChipText}>
                Biniş QR ile doğrulanır
              </PremiumText>
            </GlassSurface>

            <PremiumText variant="caption" muted style={styles.sub}>
              Onayladıktan sonra sürücünün biniş QR kodunu okutun.
            </PremiumText>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.btnSecondaryWrap}
                onPress={onNo}
                activeOpacity={0.85}
              >
                <PremiumText variant="body" muted style={styles.btnSecondaryText}>
                  Hayır
                </PremiumText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimaryWrap} onPress={onYes} activeOpacity={0.88}>
                <PremiumText variant="body" style={styles.btnPrimaryText}>
                  Evet
                </PremiumText>
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: LDS_SPACING.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    alignItems: 'center',
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
    marginBottom: LDS_SPACING.sm,
    ...LDS_ELEVATION.flat,
  },
  questionText: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: LDS_SPACING.sm,
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
  sub: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  row: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
    width: '100%',
  },
  btnSecondaryWrap: {
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
  btnSecondaryText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  btnPrimaryWrap: {
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
  btnPrimaryText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
