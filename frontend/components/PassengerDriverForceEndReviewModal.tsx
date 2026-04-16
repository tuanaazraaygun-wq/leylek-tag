import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.iconGradient}>
              <Ionicons name="alert-circle" size={40} color="#FFF" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>
            {title?.trim() ? title.trim() : 'Sürücü eşleşmeyi zorla bitirdi'}
          </Text>
          <Text style={styles.description}>Bu bitişi onaylıyor musunuz?</Text>
          <View style={styles.buttonColumn}>
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.btnDisabled]}
              onPress={() => void onConfirm()}
              activeOpacity={0.88}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>{submitting ? 'Gönderiliyor…' : 'Onaylıyorum'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, submitting && styles.btnDisabled]}
              onPress={() => void onReject()}
              activeOpacity={0.88}
              disabled={submitting}
            >
              <Text style={styles.secondaryBtnText}>{submitting ? 'Gönderiliyor…' : 'Onaylamıyorum'}</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
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
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 22,
  },
  buttonColumn: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
