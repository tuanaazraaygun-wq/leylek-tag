/**
 * EndTripModal.tsx - Modern Yolculuk Bitirme Modalı
 */

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
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <LinearGradient
                colors={['#22D3EE', '#0ea5e9']}
                style={styles.iconGradient}
              >
                <Ionicons name="flag-outline" size={28} color="#08111F" />
              </LinearGradient>
            </View>
            <Text style={styles.headerTitle}>Yolculuğu Bitir</Text>
            <Text style={styles.headerSubtitle}>Nasıl tamamlamak istersiniz?</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* Option 1: Hemen Tamamla */}
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={handleComplete}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#22D3EE', '#2563EB']}
                style={styles.optionIconBg}
              >
                <Ionicons name="checkmark-circle" size={24} color="#08111F" />
              </LinearGradient>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Hemen Tamamla</Text>
                <Text style={styles.optionDescription}>Yolculuğu şimdi bitir (0 puan)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(148, 163, 184, 0.75)" />
            </TouchableOpacity>

            {/* Option 2: Karşılıklı Onay */}
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={handleRequestApproval}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#38BDF8', '#2563EB']}
                style={styles.optionIconBg}
              >
                <Ionicons name="hand-left" size={24} color="#08111F" />
              </LinearGradient>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Karşılıklı Onay</Text>
                <Text style={styles.optionDescription}>
                  {`${otherUserName}'dan onay bekle (+1 puan)`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(148, 163, 184, 0.75)" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Option 3: Zorla Bitir */}
            <TouchableOpacity 
              style={[styles.optionCard, styles.dangerOption]}
              onPress={handleForceEnd}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.optionIconBg}
              >
                <Ionicons name="warning" size={24} color="#FFF" />
              </LinearGradient>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, styles.dangerText]}>Zorla Bitir</Text>
                <Text style={[styles.optionDescription, styles.dangerSubtext]}>
                  ⚠️ Puanınız 5 düşer
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FCA5A5" />
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Vazgeç</Text>
          </TouchableOpacity>
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
    backgroundColor: 'rgba(8, 17, 31, 0.72)',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    backgroundColor: 'rgba(16, 26, 43, 0.97)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.18)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 22,
  },
  header: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30, 58, 95, 0.65)',
    backgroundColor: 'rgba(8, 17, 31, 0.55)',
  },
  headerIcon: {
    marginBottom: 12,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(243, 248, 255, 0.96)',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(172, 188, 212, 0.9)',
    textAlign: 'center',
  },
  optionsContainer: {
    padding: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.5)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.55)',
  },
  optionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(243, 248, 255, 0.94)',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: 'rgba(172, 188, 212, 0.88)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(30, 58, 95, 0.55)',
    marginVertical: 8,
  },
  dangerOption: {
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  dangerText: {
    color: 'rgba(252, 165, 165, 0.98)',
  },
  dangerSubtext: {
    color: 'rgba(248, 113, 113, 0.85)',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(30, 58, 95, 0.55)',
    backgroundColor: 'rgba(8, 17, 31, 0.35)',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(172, 188, 212, 0.95)',
  },
});
