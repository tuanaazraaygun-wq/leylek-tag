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
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>

          {step === 'choice' ? (
            <>
              <Text style={styles.title}>Yolculuğu nasıl sonlandırmak istersiniz?</Text>
              <Text style={styles.sub}>
                Yolculuk devam ederken zorla bitirmek puan kaybına yol açabilir. Önce güvenli seçenekleri
                değerlendirin.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onChooseQr} activeOpacity={0.88}>
                <Ionicons name="qr-code" size={20} color="#FFF" />
                <Text style={styles.primaryBtnText}>Sürücü yanınızdaysa karekodu okutun</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onChooseIssue} activeOpacity={0.88}>
                <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />
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
                placeholderTextColor="#94A3B8"
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
                <Ionicons name="send" size={18} color="#FFF" />
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
    backgroundColor: 'rgba(15,23,42,0.55)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    paddingTop: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#0F172A',
    marginBottom: 8,
    paddingRight: 28,
  },
  sub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 19,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtnText: {
    color: '#B91C1C',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSel: {
    backgroundColor: '#EDE9FE',
    borderColor: '#A78BFA',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextSel: {
    color: '#5B21B6',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#0F172A',
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
    color: '#DC2626',
    textDecorationLine: 'underline',
  },
});
