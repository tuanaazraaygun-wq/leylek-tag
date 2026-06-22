/**
 * Yolculuk sırasında (biniş / in_progress) "Zorla Bitir" için güvenli iki adımlı modal.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_COLOR_ERROR } from '../design-system/tokens/color';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

export type InRideSaferForceEndStep = 'choice' | 'complaint';

export const IN_RIDE_FORCE_END_REASONS: { key: string; label: string }[] = [
  { key: 'in_ride_improper', label: 'Uygunsuz davranış' },
  { key: 'in_ride_security', label: 'Güvenlik sorunu' },
  { key: 'in_ride_wrong_party', label: 'Yanlış kişi / araç' },
  { key: 'in_ride_payment_route', label: 'Katkı payı / rota sorunu' },
  { key: 'in_ride_other', label: 'Diğer' },
];

export type InRideSaferForceEndModalProps = {
  visible: boolean;
  step: InRideSaferForceEndStep;
  onClose: () => void;
  /** Adım 1 — QR ile bitirme akışına yönlendir */
  onChooseQr: () => void;
  /** Adım 1 — şikayet formuna geç */
  onChooseIssue: () => void;
  /** Adım 2 — şikayet + mevcut zorla bitir */
  onSubmitComplaintAndEnd: (reasonKey: string, details: string) => void;
  submitting?: boolean;
  /** Adım 2 — doğrudan mevcut zorla bitir (uyarı öncesi LiveMapView’da) */
  onBluntForceEnd: () => void;
};

export default function InRideSaferForceEndModal({
  visible,
  step,
  onClose,
  onChooseQr,
  onChooseIssue,
  onSubmitComplaintAndEnd,
  submitting = false,
  onBluntForceEnd,
}: InRideSaferForceEndModalProps) {
  const [reasonKey, setReasonKey] = useState<string>(IN_RIDE_FORCE_END_REASONS[0].key);
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!visible) {
      setReasonKey(IN_RIDE_FORCE_END_REASONS[0].key);
      setDetails('');
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.cardWrap}>
          <GlassSurface variant="panel" borderRadius={LDS_RADIUS.xl} style={styles.card}>
            <TouchableOpacity style={styles.closeFab} onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="rgba(186,201,222,0.82)" />
            </TouchableOpacity>

            <View style={styles.phaseBlock}>
              <PremiumText variant="step" style={styles.phaseStep}>
                Güvenli sonlandırma
              </PremiumText>
            </View>

            {step === 'choice' ? (
              <>
                <GlassSurface variant="plain" style={styles.guardianChip} borderRadius={LDS_RADIUS.full}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="rgba(34,211,238,0.82)" />
                  <PremiumText variant="caption" style={styles.guardianChipText}>
                    Önce güvenli seçenekler
                  </PremiumText>
                </GlassSurface>

                <PremiumText variant="title" style={styles.title}>
                  Yolculuğu nasıl sonlandırmak istersiniz?
                </PremiumText>
                <PremiumText variant="body" muted style={styles.sub}>
                  Zorla bitirmek puan kaybına yol açabilir. Mümkünse karekod ile tamamlayın.
                </PremiumText>

                <TouchableOpacity style={styles.primaryBtn} onPress={onChooseQr} activeOpacity={0.88}>
                  <Ionicons name="qr-code" size={20} color="rgba(243,248,255,0.94)" />
                  <PremiumText variant="body" style={styles.primaryBtnText}>
                    Sürücü yanınızdaysa karekodu okutun
                  </PremiumText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={onChooseIssue} activeOpacity={0.88}>
                  <Ionicons name="alert-circle-outline" size={20} color="rgba(248,113,113,0.88)" />
                  <PremiumText variant="body" style={styles.secondaryBtnText}>
                    Sorun var
                  </PremiumText>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <GlassSurface variant="plain" style={styles.guardianChip} borderRadius={LDS_RADIUS.full}>
                  <Ionicons name="document-text-outline" size={14} color="rgba(34,211,238,0.78)" />
                  <PremiumText variant="caption" style={styles.guardianChipText}>
                    Şikayet kaydı
                  </PremiumText>
                </GlassSurface>

                <PremiumText variant="title" style={styles.title}>
                  Kısaca belirtin
                </PremiumText>
                <PremiumText variant="body" muted style={styles.sub}>
                  Sebep seçin; isteğe bağlı not ekleyebilirsiniz.
                </PremiumText>

                <View style={styles.chipWrap}>
                  {IN_RIDE_FORCE_END_REASONS.map((r) => {
                    const sel = r.key === reasonKey;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        style={[styles.chip, sel && styles.chipSel]}
                        onPress={() => setReasonKey(r.key)}
                        activeOpacity={0.85}
                      >
                        <PremiumText
                          variant="caption"
                          muted={!sel}
                          style={[styles.chipText, sel && styles.chipTextSel]}
                        >
                          {r.label}
                        </PremiumText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <PremiumText variant="caption" muted style={styles.fieldLabel}>
                  Kısaca belirtin
                </PremiumText>
                <TextInput
                  style={styles.input}
                  placeholder="İsteğe bağlı açıklama"
                  placeholderTextColor="rgba(186,201,222,0.45)"
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  maxLength={500}
                  editable={!submitting}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                  disabled={submitting}
                  onPress={() => onSubmitComplaintAndEnd(reasonKey, details.trim())}
                  activeOpacity={0.88}
                >
                  <Ionicons name="send" size={18} color="rgba(243,248,255,0.94)" />
                  <PremiumText variant="body" style={styles.primaryBtnText}>
                    Şikayet et ve bitir
                  </PremiumText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.destructiveBtn, submitting && styles.btnDisabled]}
                  disabled={submitting}
                  onPress={onBluntForceEnd}
                  activeOpacity={0.88}
                >
                  <PremiumText variant="body" style={styles.destructiveBtnText}>
                    Yine de zorla bitir (-5 puan)
                  </PremiumText>
                </TouchableOpacity>
              </ScrollView>
            )}
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8,17,31,0.72)',
    padding: LDS_SPACING.lg,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    paddingTop: LDS_SPACING.lg + 2,
    paddingBottom: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.lg,
    ...LDS_ELEVATION.cockpit,
  },
  closeFab: {
    position: 'absolute',
    right: LDS_SPACING.sm,
    top: LDS_SPACING.sm,
    zIndex: 2,
  },
  phaseBlock: {
    marginBottom: LDS_SPACING.sm,
    paddingRight: LDS_SPACING.xl,
  },
  phaseStep: {
    letterSpacing: 0.4,
    color: 'rgba(186, 230, 253, 0.88)',
  },
  guardianChip: {
    alignSelf: 'flex-start',
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
    marginBottom: LDS_SPACING.xs,
    paddingRight: LDS_SPACING.xl,
  },
  sub: {
    marginBottom: LDS_SPACING.md,
    lineHeight: 22,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm + 2,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    marginBottom: LDS_SPACING.sm,
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
    flexShrink: 1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm + 2,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    minHeight: 50,
    backgroundColor: 'rgba(55,10,22,0.32)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(248,113,113,0.32)',
    borderTopColor: 'rgba(239,68,68,0.18)',
    ...LDS_ELEVATION.flat,
  },
  secondaryBtnText: {
    fontWeight: '700',
    color: 'rgba(252, 165, 165, 0.92)',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LDS_SPACING.xs,
    marginBottom: LDS_SPACING.sm,
  },
  chip: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(8, 17, 31, 0.72)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  chipSel: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
  },
  chipText: {
    fontWeight: '600',
  },
  chipTextSel: {
    fontWeight: '700',
    color: 'rgba(243,248,255,0.94)',
  },
  fieldLabel: {
    fontWeight: '700',
    marginBottom: LDS_SPACING.xxs,
  },
  input: {
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderRadius: LDS_RADIUS.md,
    padding: LDS_SPACING.sm,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(243,248,255,0.94)',
    backgroundColor: 'rgba(8, 17, 31, 0.65)',
    marginBottom: LDS_SPACING.md,
  },
  destructiveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LDS_SPACING.sm + 2,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    marginBottom: LDS_SPACING.xxs,
    minHeight: 48,
    backgroundColor: 'rgba(55,10,22,0.45)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(248,113,113,0.38)',
    borderTopColor: 'rgba(239,68,68,0.22)',
    ...LDS_ELEVATION.flat,
  },
  destructiveBtnText: {
    fontWeight: '700',
    color: LDS_COLOR_ERROR,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
