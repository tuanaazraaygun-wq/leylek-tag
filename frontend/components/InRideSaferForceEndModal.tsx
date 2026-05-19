/**
 * Yolculuk sırasında (biniş / in_progress) "Zorla Bitir" için güvenli iki adımlı modal.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type InRideSaferForceEndStep = 'choice' | 'complaint';

export const IN_RIDE_FORCE_END_REASONS: { key: string; label: string }[] = [
  { key: 'in_ride_improper', label: 'Uygunsuz davranış' },
  { key: 'in_ride_security', label: 'Güvenlik sorunu' },
  { key: 'in_ride_wrong_party', label: 'Yanlış kişi / araç' },
  { key: 'in_ride_payment_route', label: 'Ödeme / rota sorunu' },
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
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeFab} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color="rgba(186,201,222,0.82)" />
          </TouchableOpacity>

          {step === 'choice' ? (
            <>
              <Text style={styles.title}>Yolculuğu nasıl sonlandırmak istersiniz?</Text>
              <Text style={styles.sub}>
                Yolculuk devam ederken zorla bitirmek puan kaybına yol açabilir. Önce güvenli seçenekleri
                değerlendirin.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onChooseQr} activeOpacity={0.88}>
                <Ionicons name="qr-code" size={20} color="rgba(243,248,255,0.94)" />
                <Text style={styles.primaryBtnText}>Sürücü yanınızdaysa karekodu okutun</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onChooseIssue} activeOpacity={0.88}>
                <Ionicons name="alert-circle-outline" size={20} color="rgba(248,113,113,0.92)" />
                <Text style={styles.secondaryBtnText}>Sorun var</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Kısaca belirtin</Text>
              <Text style={styles.sub}>Sebep seçin; isteğe bağlı not ekleyebilirsiniz.</Text>
              <View style={styles.chipWrap}>
                {IN_RIDE_FORCE_END_REASONS.map((r) => {
                  const sel = r.key === reasonKey;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.chip, sel && styles.chipSel]}
                      onPress={() => setReasonKey(r.key)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSel]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Kısaca belirtin</Text>
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
                style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={() => onSubmitComplaintAndEnd(reasonKey, details.trim())}
                activeOpacity={0.88}
              >
                <Ionicons name="send" size={18} color="rgba(243,248,255,0.94)" />
                <Text style={styles.primaryBtnText}>Şikayet et ve bitir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                disabled={submitting}
                onPress={onBluntForceEnd}
                activeOpacity={0.75}
              >
                <Text style={styles.linkBtnText}>Yine de zorla bitir (-5 puan)</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
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
    backgroundColor: 'rgba(8,17,31,0.78)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderRadius: 20,
    padding: 20,
    paddingTop: 22,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.22)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 18,
  },
  closeFab: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: 'rgba(243,248,255,0.94)',
    marginBottom: 8,
    paddingRight: 28,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(186,201,222,0.82)',
    marginBottom: 16,
    lineHeight: 19,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(8, 36, 52, 0.82)',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.4)',
    borderLeftColor: 'rgba(34, 211, 238, 0.28)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: {
    color: 'rgba(243,248,255,0.94)',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(127, 29, 29, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtnText: {
    color: 'rgba(252, 165, 165, 0.98)',
    fontWeight: '700',
    fontSize: 15,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 17, 31, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.85)',
  },
  chipSel: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: 'rgba(34, 211, 238, 0.48)',
    borderTopColor: 'rgba(34, 211, 238, 0.38)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(186,201,222,0.82)',
  },
  chipTextSel: {
    color: 'rgba(243,248,255,0.94)',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(186,201,222,0.82)',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 14,
    color: 'rgba(243,248,255,0.94)',
    backgroundColor: 'rgba(8, 17, 31, 0.65)',
    marginBottom: 14,
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22D3EE',
    textDecorationLine: 'underline',
  },
});
