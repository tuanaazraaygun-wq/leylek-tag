import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RtcEngine, { 
  ChannelProfileType, 
  ClientRoleType,
  RtcEngineEventMap,
  IRtcEngineEventHandler 
} from 'react-native-agora';

interface VoiceCallProps {
  visible: boolean;
  remoteUserName: string;
  channelName: string; // TAG ID olacak
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
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  
  const engineRef = useRef<RtcEngine | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && !engineRef.current) {
      initAgora();
    }

    return () => {
      cleanup();
    };
  }, [visible]);

  // Timer için useEffect
  useEffect(() => {
    if (callState === 'connected') {
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          // 20 dakika = 1200 saniye
          if (newDuration >= 1200) {
            handleEndCall();
            return prev;
          }
          return newDuration;
        });
      }, 1000);
      
      return () => {
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      };
    }
  }, [callState]);

  const initAgora = async () => {
    try {
      if (!AGORA_APP_ID) {
        Alert.alert('Hata', 'Agora App ID bulunamadı');
        return;
      }

      // Agora Engine oluştur
      const engine = await RtcEngine.create(AGORA_APP_ID);
      engineRef.current = engine;

      // Event listeners
      engine.addListener('UserJoined', (uid) => {
        console.log('👤 Kullanıcı katıldı:', uid);
        setRemoteUserJoined(true);
        setCallState('connected');
      });

      engine.addListener('UserOffline', (uid, reason) => {
        console.log('👤 Kullanıcı ayrıldı:', uid, reason);
        setRemoteUserJoined(false);
        handleEndCall();
      });

      engine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
        console.log('✅ Kanala katıldı:', channel, uid);
      });

      engine.addListener('Error', (errorCode) => {
        console.error('❌ Agora hatası:', errorCode);
      });

      // Audio ayarları
      await engine.enableAudio();
      await engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Kanala katıl
      await engine.joinChannel(
        null, // Token (şimdilik null, sonra ekleyeceğiz)
        channelName,
        null,
        parseInt(userId.substring(0, 8), 16) // user_id'den sayısal UID oluştur
      );

      console.log('📞 Aramaya bağlanılıyor...', channelName);
    } catch (error) {
      console.error('Agora init hatası:', error);
      Alert.alert('Hata', 'Sesli arama başlatılamadı');
    }
  };

  const handleMuteToggle = async () => {
    if (engineRef.current) {
      try {
        await engineRef.current.muteLocalAudioStream(!isMuted);
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Mute hatası:', error);
      }
    }
  };

  const handleEndCall = async () => {
    // Arama süresini logla
    if (duration > 0) {
      try {
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        await fetch(`${BACKEND_URL}/api/voice/log-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            other_user_id: 'unknown', // TAG'den alınacak
            tag_id: channelName,
            duration: duration,
            call_type: 'outgoing'
          })
        });
      } catch (error) {
        console.log('Arama loglama hatası:', error);
      }
    }
    
    await cleanup();
    setCallState('ended');
    onEnd?.();
  };

  const cleanup = async () => {
    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        await engineRef.current.destroy();
        engineRef.current = null;
      }
    } catch (error) {
      console.error('Cleanup hatası:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!visible) return null;

  // Bağlanıyor durumu
  if (callState === 'connecting') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
            style={styles.incomingContainer}
          >
            <View style={styles.callerInfo}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName[0]}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.callingText}>Bağlanıyor...</Text>
            </View>

            <View style={styles.incomingActions}>
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

  // Aktif arama durumu
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#065f46', '#10b981', '#34d399']}
          style={styles.activeContainer}
        >
          <View style={styles.activeHeader}>
            <View style={styles.avatarMedium}>
              <Text style={styles.avatarText}>{remoteUserName[0]}</Text>
            </View>
            <Text style={styles.activeCallerName}>{remoteUserName}</Text>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            <Text style={styles.statusText}>
              {duration >= 1140 
                ? '⚠️ 1 dakika kaldı' 
                : remoteUserJoined 
                  ? '✅ Aramada' 
                  : '⏳ Bekleniyor...'}
            </Text>
            <Text style={styles.encryptionText}>🔒 Uçtan uca şifreli</Text>
          </View>

          <View style={styles.activeControls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.mutedButton]}
              onPress={handleMuteToggle}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color="#FFF"
              />
              <Text style={styles.controlLabel}>
                {isMuted ? 'Aç' : 'Sustur'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.endButton]}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={32} color="#FFF" />
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
  incomingContainer: {
    flex: 1,
    justifyContent: 'space-around',
    paddingVertical: 60,
  },
  activeContainer: {
    flex: 1,
    justifyContent: 'space-between',
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
    marginBottom: 16,
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
  },
  incomingActions: {
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
  acceptButton: {
    backgroundColor: '#10b981',
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
  statusText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 4,
  },
  encryptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 60,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#ef4444',
  },
  endButton: {
    backgroundColor: '#dc2626',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
