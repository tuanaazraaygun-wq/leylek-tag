import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
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
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DISPUTE_NOTE_MAX = 500;

export type TransferPaymentConfirmModalProps = {
  visible: boolean;
  passengerName?: string;
  loading?: boolean;
  onApprove: () => void | Promise<void>;
  onReject: (note: string) => void | Promise<void>;
  onClose?: () => void;
};

export default function TransferPaymentConfirmModal({
  visible,
  passengerName,
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

  const nameLine = passengerName?.trim()
    ? `${passengerName.trim()} IBAN/Havale-EFT ile ödeme yaptığını bildirdi.`
    : 'Yolcu IBAN/Havale-EFT ile ödeme yaptığını bildirdi.';

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
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['rgba(8,17,31,0.96)', 'rgba(16,26,43,0.92)', '#1E3A5F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name="wallet-outline" size={36} color="#22D3EE" />
            </LinearGradient>
          </View>

          {!disputeStep ? (
            <>
              <Text style={styles.title}>Yol paylaşım ücretini aldınız mı?</Text>
              <Text style={styles.description}>{nameLine}</Text>
              <View style={styles.buttonColumn}>
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={() => void onApprove()}
                  activeOpacity={0.88}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Gönderiliyor…' : 'Evet, ödemeyi aldım'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, loading && styles.btnDisabled]}
                  onPress={() => setDisputeStep(true)}
                  activeOpacity={0.88}
                  disabled={loading}
                >
                  <Text style={styles.secondaryBtnText}>Hayır, ödeme almadım / sorun bildir</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Sorun bildir</Text>
              <Text style={styles.description}>
                Ödeme almadıysanız kısaca açıklayın. Destek ekibi inceleyecek.
              </Text>
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
                  <Text style={styles.primaryBtnText}>{loading ? 'Gönderiliyor…' : 'Gönder'}</Text>
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
                  <Text style={styles.secondaryBtnText}>Geri</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  },
  backdrop: {
    backgroundColor: 'rgba(8,17,31,0.78)',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 380,
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.22)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 20,
  },
  iconContainer: {
    marginBottom: 14,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: 'rgba(243,248,255,0.94)',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: 'rgba(186,201,222,0.82)',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 22,
  },
  noteInput: {
    width: '100%',
    minHeight: 96,
    maxHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
    color: 'rgba(243,248,255,0.94)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  buttonColumn: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 36, 52, 0.82)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.4)',
    borderLeftColor: 'rgba(34, 211, 238, 0.28)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(243,248,255,0.94)',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(186,201,222,0.88)',
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
