import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DISPUTE_NOTE_MAX = 500;

export type TransferPaymentConfirmMethod = 'cash' | 'iban';

export type TransferPaymentConfirmModalProps = {
  visible: boolean;
  passengerName?: string;
  paymentMethod?: TransferPaymentConfirmMethod;
  loading?: boolean;
  onApprove: () => void | Promise<void>;
  onReject: (note: string) => void | Promise<void>;
  onClose?: () => void;
};

export default function TransferPaymentConfirmModal({
  visible,
  passengerName,
  paymentMethod = 'iban',
  loading = false,
  onApprove,
  onReject,
}: TransferPaymentConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [disputeStep, setDisputeStep] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');

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
      setDisputeStep(false);
      setDisputeNote('');
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  const isCash = paymentMethod === 'cash';
  const phaseStep = isCash ? 'Nakit katkı onayı' : 'Katkı onayı';
  const phaseCaption = isCash
    ? 'Yolcunun nakit katkı bildirimini güvenli şekilde onayla.'
    : 'Yolcunun katkı bildirimini güvenli şekilde onayla.';
  const questionText = isCash
    ? 'Yol paylaşım katkısını nakit olarak aldınız mı?'
    : 'Yol paylaşım katkısını aldınız mı?';
  const nameLine = isCash
    ? passengerName?.trim()
      ? `${passengerName.trim()} nakit katkıyı ilettiğini bildirdi.`
      : 'Yolcu nakit katkıyı ilettiğini bildirdi.'
    : passengerName?.trim()
      ? `${passengerName.trim()} Havale/EFT ile yol paylaşım katkısını ilettiğini bildirdi.`
      : 'Yolcu Havale/EFT ile yol paylaşım katkısını ilettiğini bildirdi.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <Animated.View
          style={[
            styles.modalWrap,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GlassSurface variant="panel" style={styles.modalContainer} borderRadius={LDS_RADIUS.xl}>
            <View style={styles.iconRing}>
              <Ionicons name="wallet-outline" size={32} color="rgba(34,211,238,0.92)" />
            </View>

            {!disputeStep ? (
              <>
                <View style={styles.phaseBlock}>
                  <PremiumText variant="step" style={styles.phaseStep}>
                    {phaseStep}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.phaseCaption}>
                    {phaseCaption}
                  </PremiumText>
                </View>

                <PremiumText variant="body" style={styles.questionText}>
                  {questionText}
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.description}>
                  {nameLine}
                </PremiumText>

                <View style={styles.buttonColumn}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={() => void onApprove()}
                    activeOpacity={0.88}
                    disabled={loading}
                  >
                    <PremiumText variant="body" style={styles.primaryBtnText}>
                      {loading ? 'Gönderiliyor…' : 'Evet, katkıyı aldım'}
                    </PremiumText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.disputeBtn, loading && styles.btnDisabled]}
                    onPress={() => setDisputeStep(true)}
                    activeOpacity={0.88}
                    disabled={loading}
                  >
                    <PremiumText variant="caption" style={styles.disputeBtnText}>
                      Hayır, katkı almadım / sorun bildir
                    </PremiumText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <PremiumText variant="step" style={styles.phaseStep}>
                  Sorun bildir
                </PremiumText>
                <PremiumText variant="caption" muted style={styles.description}>
                  Katkı almadıysanız kısaca açıklayın. Destek ekibi inceleyecek.
                </PremiumText>
                <TextInput
                  style={styles.noteInput}
                  value={disputeNote}
                  onChangeText={(t) => setDisputeNote(t.slice(0, DISPUTE_NOTE_MAX))}
                  placeholder="Kısaca açıklayın"
                  placeholderTextColor="rgba(186,201,222,0.45)"
                  multiline
                  maxLength={DISPUTE_NOTE_MAX}
                  editable={!loading}
                  textAlignVertical="top"
                />
                <View style={styles.buttonColumn}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={() => void onReject(disputeNote.trim())}
                    activeOpacity={0.88}
                    disabled={loading}
                  >
                    <PremiumText variant="body" style={styles.primaryBtnText}>
                      {loading ? 'Gönderiliyor…' : 'Gönder'}
                    </PremiumText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, loading && styles.btnDisabled]}
                    onPress={() => {
                      if (loading) return;
                      setDisputeStep(false);
                      setDisputeNote('');
                    }}
                    activeOpacity={0.88}
                    disabled={loading}
                  >
                    <PremiumText variant="caption" muted style={styles.secondaryBtnText}>
                      Geri
                    </PremiumText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </GlassSurface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  modalWrap: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 380,
    alignItems: 'center',
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    ...LDS_ELEVATION.cockpit,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    marginBottom: LDS_SPACING.md,
    ...LDS_ELEVATION.flat,
  },
  phaseBlock: {
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.sm,
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
  questionText: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: LDS_SPACING.xs,
  },
  description: {
    textAlign: 'center',
    marginBottom: LDS_SPACING.md,
    lineHeight: 20,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  noteInput: {
    width: '100%',
    minHeight: 96,
    maxHeight: 140,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    backgroundColor: 'rgba(5,11,24,0.55)',
    color: 'rgba(243,248,255,0.94)',
    paddingHorizontal: LDS_SPACING.md,
    paddingVertical: LDS_SPACING.sm,
    fontSize: 15,
    marginBottom: LDS_SPACING.md,
  },
  buttonColumn: {
    width: '100%',
    gap: LDS_SPACING.sm,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  primaryBtnText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  secondaryBtnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  disputeBtn: {
    width: '100%',
    paddingVertical: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(248,113,113,0.32)',
    borderTopColor: 'rgba(248,113,113,0.22)',
  },
  disputeBtnText: {
    fontWeight: '700',
    textAlign: 'center',
    color: 'rgba(252, 165, 165, 0.88)',
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
