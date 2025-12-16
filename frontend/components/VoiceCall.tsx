import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Agora UIKit - sadece native platformlarda
let AgoraUIKit: any = null;

// SSR ve platform kontrolü
const isClient = typeof window !== 'undefined';
const isNative = Platform.OS !== 'web';

// Native platformda Agora UIKit'i yükle
if (isNative) {
  try {
    AgoraUIKit = require('agora-rn-uikit').default;
    console.log('✅ Agora UIKit yüklendi');
  } catch (e) {
    console.log('⚠️ Agora UIKit yüklenemedi:', e);
  }
}

interface VoiceCallProps {
  visible: boolean;
  remoteUserName: string;
  channelName: string;
  userId: string;
  onEnd?: () => void;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

export default function VoiceCall({
  visible,
  remoteUserName,
  channelName,
  userId,
  onEnd,
}: VoiceCallProps) {
  const [callActive, setCallActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Agora UIKit connection data
  const connectionData = {
    appId: AGORA_APP_ID,
    channel: channelName,
    uid: parseInt(userId.substring(0, 8), 16) || Math.floor(Math.random() * 10000),
  };

  // Agora UIKit settings - sadece ses için
  const settings = {
    displayUsername: true,
    mode: 1, // Audio only mode
  };

  useEffect(() => {
    if (visible) {
      setCallActive(true);
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
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [visible]);

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
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    setCallActive(false);
    setDuration(0);
    onEnd?.();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Agora callbacks
  const rtcCallbacks = {
    EndCall: () => {
      handleEndCall();
    },
    UserJoined: () => {
      console.log('👤 Kullanıcı katıldı');
    },
    UserOffline: () => {
      console.log('👤 Kullanıcı ayrıldı');
      handleEndCall();
    },
  };

  if (!visible) return null;

  // Web platformunda basit UI göster
  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
            style={styles.webContainer}
          >
            <View style={styles.callerInfo}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName[0]}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
              <Text style={styles.webNotice}>
                ⚠️ Web'de sesli arama desteklenmiyor.{'\n'}
                Lütfen Android uygulamasını kullanın.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.callButton, styles.rejectButton]}
              onPress={handleEndCall}
            >
              <Ionicons name="close" size={36} color="#FFF" />
              <Text style={styles.buttonLabel}>Kapat</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Native platformda Agora UIKit kullan
  if (!AgoraUIKit) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
            style={styles.webContainer}
          >
            <View style={styles.callerInfo}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName[0]}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
              <Text style={styles.webNotice}>
                ⚠️ Agora SDK yüklenemedi.{'\n'}
                Dev Client ile tekrar deneyin.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.callButton, styles.rejectButton]}
              onPress={handleEndCall}
            >
              <Ionicons name="close" size={36} color="#FFF" />
              <Text style={styles.buttonLabel}>Kapat</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Agora UIKit ile gerçek sesli arama
  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <View style={styles.agoraContainer}>
        {/* Header */}
        <LinearGradient
          colors={['#065f46', '#10b981']}
          style={styles.agoraHeader}
        >
          <View style={styles.avatarMedium}>
            <Text style={styles.avatarTextSmall}>{remoteUserName[0]}</Text>
          </View>
          <Text style={styles.agoraCallerName}>{remoteUserName}</Text>
          <Text style={styles.agoraDuration}>{formatDuration(duration)}</Text>
          <Text style={styles.encryptionText}>🔒 Uçtan uca şifreli</Text>
          {duration >= 1140 && (
            <Text style={styles.warningText}>⚠️ 1 dakika kaldı</Text>
          )}
        </LinearGradient>

        {/* Agora UIKit - Audio Only */}
        <View style={styles.agoraContent}>
          <AgoraUIKit
            connectionData={connectionData}
            rtcCallbacks={rtcCallbacks}
            settings={settings}
          />
        </View>

        {/* Custom End Button */}
        <View style={styles.agoraFooter}>
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Ionicons name="call" size={32} color="#FFF" />
            <Text style={styles.endCallText}>Aramayı Bitir</Text>
          </TouchableOpacity>
        </View>
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
  webContainer: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 60,
  },
  callerInfo: {
    alignItems: 'center',
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
    marginBottom: 12,
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
    marginBottom: 12,
  },
  durationText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  webNotice: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
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
  // Agora UIKit Styles
  agoraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  agoraHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  agoraCallerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  agoraDuration: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  encryptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  warningText: {
    fontSize: 16,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginTop: 8,
  },
  agoraContent: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  agoraFooter: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
    backgroundColor: '#000',
  },
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 12,
  },
  endCallText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
