/**
 * EndTripModal.tsx - Modern Yolculuk Bitirme Modalı
 * 
 * ✅ Bulut benzeri modern tasarım
 * ✅ Hızlı ve akıcı animasyonlar
 * ✅ Açık ve anlaşılır seçenekler
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const slideAnim = useRef(new Animated.Value(50)).current;

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
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
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
        {/* Blur Background */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        )}
        
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        {/* Modal Content */}
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.iconGradient}
              >
                <Ionicons name="flag-outline" size={28} color="#FFF" />
              </LinearGradient>
            </View>
            <Text style={styles.headerTitle}>Yolculuğu Bitir</Text>
            <Text style={styles.headerSubtitle}>Nasıl tamamlamak istersiniz?</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* Option 1: Tamamla */}
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={handleComplete}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.optionIconBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              </LinearGradient>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Hemen Tamamla</Text>
                <Text style={styles.optionDescription}>Yolculuğu şimdi bitir (0 puan)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Option 2: Onay İste */}
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={handleRequestApproval}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.optionIconBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="hand-left" size={24} color="#FFF" />
              </LinearGradient>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Karşılıklı Onay</Text>
                <Text style={styles.optionDescription}>{otherUserName}'dan onay bekle (+1 puan)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Divider */}
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
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionsContainer: {
    padding: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  dangerOption: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerText: {
    color: '#DC2626',
  },
  dangerSubtext: {
    color: '#F87171',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
