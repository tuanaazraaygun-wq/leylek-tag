import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Native Agora SDK - sadece native platformlarda
let createAgoraRtcEngine: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;

const isNative = Platform.OS !== 'web';

if (isNative) {
  try {
    const AgoraModule = require('react-native-agora');
    createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
    ChannelProfileType = AgoraModule.ChannelProfileType;
    ClientRoleType = AgoraModule.ClientRoleType;
    console.log('✅ Agora SDK yüklendi');
  } catch (e) {
    console.log('⚠️ Agora SDK yüklenemedi:', e);
  }
}

interface CallProps {
  visible: boolean;
  remoteUserName: string;
  channelName: string;
  userId: string;
  isVideoCall?: boolean;
  onEnd?: () => void;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

export default function VoiceCall({
  visible,
  remoteUserName,
  channelName,
  userId,
  isVideoCall = false,
  onEnd,
}: CallProps) {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  const engineRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const localUid = Math.floor(Math.random() * 100000);

  useEffect(() => {
    if (visible && isNative && createAgoraRtcEngine) {
      initAgora();
    } else if (visible) {
      // Web fallback
      setCallState('connected');
      startTimer();
    }

    return () => {
      cleanup();
    };
  }, [visible]);

  const startTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setDuration((prev) => {
        const newDuration = prev + 1;
        if (newDuration >= 1200) {
          handleEndCall();
          return prev;
        }
        return newDuration;
      });
    }, 1000);
  };

  const initAgora = async () => {
    try {
      if (!AGORA_APP_ID) {
        console.error('❌ Agora App ID bulunamadı!');
        Alert.alert('Hata', 'Agora App ID bulunamadı');
        return;
      }

      console.log('🎥 Agora başlatılıyor...');
      console.log('📍 AppID:', AGORA_APP_ID);
      console.log('📍 Channel:', channelName);
      console.log('📍 UID:', localUid);

      // Engine oluştur
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      // Initialize with app ID
      engine.initialize({
        appId: AGORA_APP_ID,
      });
      console.log('✅ Engine initialized');

      // Event handlers kaydet
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: any, elapsed: number) => {
          console.log('✅✅✅ KANALA KATILDI! Süre:', elapsed);
          setCallState('connected');
          startTimer();
        },
        onUserJoined: (connection: any, remoteUid: number, elapsed: number) => {
          console.log('👤 Kullanıcı katıldı:', remoteUid);
          setRemoteUid(remoteUid);
        },
        onUserOffline: (connection: any, remoteUid: number, reason: number) => {
          console.log('👤 Kullanıcı ayrıldı:', remoteUid);
          setRemoteUid(null);
        },
        onError: (err: number, msg: string) => {
          console.error('❌ Agora Error:', err, msg);
        },
        onConnectionStateChanged: (connection: any, state: number, reason: number) => {
          console.log('🔗 Connection state:', state, 'reason:', reason);
        },
      });

      // Audio ayarları
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      console.log('✅ Audio enabled');

      // Kanala katıl - Agora 4.x API (null token for testing mode)
      console.log('🔄 Kanala katılınıyor...');
      const joinResult = engine.joinChannel(null, channelName, localUid, {
        clientRoleType: 1, // BROADCASTER
      });
      console.log('✅ joinChannel result:', joinResult);

      // 3 saniye sonra otomatik bağlan (event gelmezse)
      setTimeout(() => {
        setCallState('connected');
        startTimer();
        console.log('⏱️ Auto-connected after timeout');
      }, 3000);

    } catch (error: any) {
      console.error('❌ Agora init error:', error);
      Alert.alert('Hata', 'Arama başlatılamadı: ' + error.message);
    }
  };

  const cleanup = async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      } catch (e) {
        console.log('Cleanup error:', e);
      }
    }
  };

  const handleEndCall = async () => {
    if (duration > 0) {
      try {
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        await fetch(`${BACKEND_URL}/api/voice/log-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            tag_id: channelName,
            duration: duration,
            call_type: isVideoCall ? 'video' : 'audio'
          })
        });
      } catch (error) {
        console.log('Log error:', error);
      }
    }

    await cleanup();
    setCallState('ended');
    setDuration(0);
    setRemoteUid(null);
    onEnd?.();
  };

  const toggleMute = () => {
    if (engineRef.current) {
      engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    if (engineRef.current) {
      engineRef.current.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!visible) return null;

  // Web platformu
  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.container}>
            <View style={styles.header}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
              <Text style={styles.webNotice}>⚠️ Web'de sesli arama desteklenmiyor</Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Bağlanıyor
  if (callState === 'connecting') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.container}>
            <View style={styles.header}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.statusText}>📞 Bağlanıyor...</Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="close" size={36} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Aktif arama
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <LinearGradient colors={['#065f46', '#10b981', '#34d399']} style={styles.container}>
          <View style={styles.header}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
            </View>
            <Text style={styles.callerName}>{remoteUserName}</Text>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            <Text style={styles.statusText}>
              {remoteUid ? '✅ Bağlandı - Konuşuyor' : '⏳ Karşı taraf bekleniyor...'}
            </Text>
            {duration >= 1140 && <Text style={styles.warningText}>⚠️ 1 dakika kaldı</Text>}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFF" />
              <Text style={styles.controlLabel}>{isMuted ? 'Aç' : 'Kapat'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlBtn, !isSpeakerOn && styles.controlBtnActive]} 
              onPress={toggleSpeaker}
            >
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={28} color="#FFF" />
              <Text style={styles.controlLabel}>{isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
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
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
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
    marginTop: 8,
  },
  warningText: {
    fontSize: 16,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginTop: 8,
  },
  webNotice: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
  },
  controlBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#ef4444',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
  },
  endButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
