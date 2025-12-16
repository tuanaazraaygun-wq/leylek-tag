import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Native Agora SDK - sadece native platformlarda
let createAgoraRtcEngine: any = null;
let RtcSurfaceView: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;
let VideoSourceType: any = null;

const isNative = Platform.OS !== 'web';

if (isNative) {
  try {
    const AgoraModule = require('react-native-agora');
    createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
    RtcSurfaceView = AgoraModule.RtcSurfaceView;
    ChannelProfileType = AgoraModule.ChannelProfileType;
    ClientRoleType = AgoraModule.ClientRoleType;
    VideoSourceType = AgoraModule.VideoSourceType;
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
  isVideoCall?: boolean; // true = görüntülü, false = sesli
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
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  const engineRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const localUid = parseInt(userId.substring(0, 8), 16) || Math.floor(Math.random() * 10000);

  useEffect(() => {
    if (visible && isNative && createAgoraRtcEngine) {
      initAgora();
    } else if (visible) {
      // Web fallback - sadece timer göster
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
        if (newDuration >= 1200) { // 20 dakika limit
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
        Alert.alert('Hata', 'Agora App ID bulunamadı');
        return;
      }

      console.log('🎥 Agora başlatılıyor...', isVideoCall ? 'Video' : 'Ses');
      console.log('📍 Channel:', channelName, 'UID:', localUid, 'AppID:', AGORA_APP_ID?.substring(0,8) + '...');

      // Engine oluştur
      if (!createAgoraRtcEngine) {
        console.error('❌ createAgoraRtcEngine fonksiyonu bulunamadı!');
        Alert.alert('Hata', 'Agora SDK yüklenemedi');
        return;
      }
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      console.log('✅ Engine oluşturuldu');

      // Initialize
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      console.log('✅ Engine initialize edildi');

      // Event listeners
      engine.registerEventHandler({
        onJoinChannelSuccess: (_connection: any, elapsed: number) => {
          console.log('✅ Kanala katıldı, süre:', elapsed);
          setCallState('connected');
          startTimer();
        },
        onUserJoined: (_connection: any, uid: number) => {
          console.log('👤 Kullanıcı katıldı:', uid);
          setRemoteUid(uid);
        },
        onUserOffline: (_connection: any, uid: number) => {
          console.log('👤 Kullanıcı ayrıldı:', uid);
          setRemoteUid(null);
          handleEndCall();
        },
        onError: (err: any) => {
          console.error('❌ Agora hatası:', err);
          Alert.alert('Agora Hatası', JSON.stringify(err));
        },
      });
      console.log('✅ Event handlers kaydedildi');

      // Video veya ses moduna göre ayarla
      if (isVideoCall) {
        engine.enableVideo();
        engine.startPreview();
        console.log('✅ Video etkinleştirildi');
      } else {
        engine.enableAudio();
        console.log('✅ Audio etkinleştirildi');
      }

      // Kanala katıl
      console.log('🔄 Kanala katılınıyor:', channelName);
      engine.joinChannel(null, channelName, localUid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideoCall,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideoCall,
      });
      console.log('✅ joinChannel çağrıldı');

    } catch (error) {
      console.error('Agora init hatası:', error);
      Alert.alert('Hata', 'Arama başlatılamadı: ' + error);
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
        console.log('Cleanup hatası:', e);
      }
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
            tag_id: channelName,
            duration: duration,
            call_type: isVideoCall ? 'video' : 'audio'
          })
        });
      } catch (error) {
        console.log('Log hatası:', error);
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

  const toggleCamera = () => {
    if (engineRef.current && isVideoCall) {
      engineRef.current.muteLocalVideoStream(!isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  };

  const switchCamera = () => {
    if (engineRef.current && isVideoCall) {
      engineRef.current.switchCamera();
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

  // Web platformu için basit UI
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
              <Text style={styles.webNotice}>
                ⚠️ Web'de {isVideoCall ? 'görüntülü' : 'sesli'} arama desteklenmiyor.
              </Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Bağlanıyor ekranı
  if (callState === 'connecting') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient colors={isVideoCall ? ['#7c3aed', '#a855f7'] : ['#1e3a8a', '#3b82f6']} style={styles.container}>
            <View style={styles.header}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.statusText}>
                {isVideoCall ? '📹 Görüntülü arama bağlanıyor...' : '📞 Sesli arama bağlanıyor...'}
              </Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="close" size={36} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Görüntülü arama - Aktif
  if (isVideoCall) {
    return (
      <Modal visible={visible} transparent={false} animationType="slide">
        <View style={styles.videoContainer}>
          {/* Remote Video (tam ekran) */}
          {remoteUid && RtcSurfaceView ? (
            <RtcSurfaceView
              style={styles.remoteVideo}
              canvas={{ uid: remoteUid }}
            />
          ) : (
            <View style={styles.waitingVideo}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.waitingText}>{remoteUserName}</Text>
              <Text style={styles.waitingSubtext}>Bekleniyor...</Text>
            </View>
          )}

          {/* Local Video (küçük - sağ üst) */}
          {RtcSurfaceView && !isCameraOff && (
            <View style={styles.localVideoContainer}>
              <RtcSurfaceView
                style={styles.localVideo}
                canvas={{ uid: 0, sourceType: VideoSourceType?.VideoSourceCamera }}
              />
            </View>
          )}

          {/* Üst bilgi */}
          <View style={styles.videoOverlayTop}>
            <Text style={styles.videoCallerName}>{remoteUserName}</Text>
            <Text style={styles.videoDuration}>{formatDuration(duration)}</Text>
            {duration >= 1140 && <Text style={styles.warningText}>⚠️ 1 dk kaldı</Text>}
          </View>

          {/* Alt kontroller */}
          <View style={styles.videoControls}>
            <TouchableOpacity style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]} onPress={toggleCamera}>
              <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={toggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.endButtonVideo} onPress={handleEndCall}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Sesli arama - Aktif
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
              {remoteUid ? '✅ Bağlandı' : '⏳ Bekleniyor...'}
            </Text>
            {duration >= 1140 && <Text style={styles.warningText}>⚠️ 1 dakika kaldı</Text>}
            <Text style={styles.encryptionText}>🔒 Şifreli arama</Text>
          </View>

          <View style={styles.audioControls}>
            <TouchableOpacity style={[styles.audioControlBtn, isMuted && styles.controlBtnActive]} onPress={toggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFF" />
              <Text style={styles.controlLabel}>{isMuted ? 'Aç' : 'Kapat'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.audioControlBtn, !isSpeakerOn && styles.controlBtnActive]} onPress={toggleSpeaker}>
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
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  header: {
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
    color: 'rgba(255,255,255,0.8)',
  },
  warningText: {
    fontSize: 16,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginTop: 8,
  },
  encryptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
  },
  webNotice: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 20,
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
  },
  audioControlBtn: {
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
  // Video styles
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  waitingVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  waitingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
  },
  waitingSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  localVideo: {
    flex: 1,
  },
  videoOverlayTop: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  videoCallerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoDuration: {
    fontSize: 16,
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButtonVideo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
