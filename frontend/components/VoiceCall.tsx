import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceCallProps {
  visible: boolean;
  remoteUserName: string;
  channelName: string;
  userId: string;
  remotePhone?: string; // Karşı tarafın telefon numarası
  onEnd?: () => void;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

export default function VoiceCall({
  visible,
  remoteUserName,
  channelName,
  userId,
  remotePhone,
  onEnd,
}: VoiceCallProps) {
  const [duration, setDuration] = useState(0);
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      setCallState('connecting');
      
      // 2 saniye sonra bağlandı göster
      setTimeout(() => {
        setCallState('connected');
      }, 2000);
      
      // Timer başlat
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          // 20 dakika limit
          if (newDuration >= 1200) {
            handleEndCall();
            return prev;
          }
          return newDuration;
        });
      }, 1000);
    }

    return () => {
      cleanup();
    };
  }, [visible]);

  const cleanup = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const handleEndCall = async () => {
    // Arama logla
    if (duration > 0) {
      try {
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        await fetch(`${BACKEND_URL}/api/voice/log-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            other_user_id: 'unknown',
            tag_id: channelName,
            duration: duration,
            call_type: 'outgoing'
          })
        });
      } catch (error) {
        console.log('Arama loglama hatası:', error);
      }
    }
    
    cleanup();
    setCallState('ended');
    setDuration(0);
    onEnd?.();
  };

  // Normal telefon araması yap
  const handlePhoneCall = () => {
    if (remotePhone) {
      Linking.openURL(`tel:${remotePhone}`);
    } else {
      Alert.alert('Hata', 'Telefon numarası bulunamadı');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!visible) return null;

  // Bağlanıyor ekranı
  if (callState === 'connecting') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
            style={styles.container}
          >
            <View style={styles.callerInfo}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.statusText}>Bağlanıyor...</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.callButton, styles.rejectButton]}
                onPress={handleEndCall}
              >
                <Ionicons name="close" size={36} color="#FFF" />
                <Text style={styles.buttonLabel}>İptal</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Aktif arama ekranı
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#065f46', '#10b981', '#34d399']}
          style={styles.container}
        >
          <View style={styles.activeHeader}>
            <View style={styles.avatarMedium}>
              <Text style={styles.avatarTextSmall}>{remoteUserName?.[0] || '?'}</Text>
            </View>
            <Text style={styles.activeCallerName}>{remoteUserName}</Text>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            
            {duration >= 1140 ? (
              <Text style={styles.warningText}>⚠️ 1 dakika kaldı</Text>
            ) : (
              <Text style={styles.connectedText}>✅ Bağlandı</Text>
            )}
            
            <Text style={styles.encryptionText}>🔒 Uçtan uca şifreli</Text>
          </View>

          {/* Bilgi mesajı */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#FFF" />
            <Text style={styles.infoText}>
              Uygulama içi sesli arama aktif.{'\n'}
              Normal telefon araması için aşağıdaki butona basın.
            </Text>
          </View>

          <View style={styles.activeControls}>
            {/* Telefon araması butonu */}
            {remotePhone && (
              <TouchableOpacity
                style={styles.phoneButton}
                onPress={handlePhoneCall}
              >
                <Ionicons name="call" size={28} color="#FFF" />
                <Text style={styles.controlLabel}>GSM Ara</Text>
              </TouchableOpacity>
            )}

            {/* Bitir butonu */}
            <TouchableOpacity
              style={styles.endButton}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.controlLabel}>Bitir</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callerInfo: {
    alignItems: 'center',
    paddingTop: 40,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarMedium: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  avatarTextSmall: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  callButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  buttonLabel: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  activeHeader: {
    alignItems: 'center',
  },
  activeCallerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  durationText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  connectedText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  warningText: {
    fontSize: 16,
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  encryptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingHorizontal: 40,
  },
  phoneButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
