import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Vibration, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface IncomingCallProps {
  visible: boolean;
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({
  visible,
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Titreşim
      if (Platform.OS !== 'web') {
        const pattern = [0, 500, 200, 500, 200, 500];
        Vibration.vibrate(pattern, true);
      }

      // Pulse animasyonu
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Ring animasyonu
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: -1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Vibration.cancel();
    }

    return () => {
      Vibration.cancel();
    };
  }, [visible]);

  const ringRotate = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <LinearGradient
        colors={callType === 'video' ? ['#1e3a8a', '#3b82f6', '#60a5fa'] : ['#065f46', '#10b981', '#34d399']}
        style={styles.container}
      >
        {/* Üst Kısım - Arayan Bilgisi */}
        <View style={styles.callerInfo}>
          <Text style={styles.callTypeText}>
            {callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}
          </Text>
          
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{callerName?.[0] || '?'}</Text>
            </View>
          </Animated.View>

          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callingText}>arıyor...</Text>

          <Animated.View style={{ transform: [{ rotate: ringRotate }] }}>
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={40} color="rgba(255,255,255,0.5)" />
          </Animated.View>
        </View>

        {/* Alt Kısım - Butonlar */}
        <View style={styles.buttonsContainer}>
          {/* Reddet Butonu */}
          <TouchableOpacity style={styles.buttonWrapper} onPress={onReject}>
            <View style={styles.rejectButton}>
              <Ionicons name="close" size={36} color="#FFF" />
            </View>
            <Text style={styles.buttonLabel}>Reddet</Text>
          </TouchableOpacity>

          {/* Kabul Et Butonu */}
          <TouchableOpacity style={styles.buttonWrapper} onPress={onAccept}>
            <Animated.View style={[styles.acceptButton, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={36} color="#FFF" />
            </Animated.View>
            <Text style={styles.buttonLabel}>Kabul Et</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  callerInfo: {
    alignItems: 'center',
    marginTop: 40,
  },
  callTypeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  callingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 30,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
    paddingBottom: 40,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});
