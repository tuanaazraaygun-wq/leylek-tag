import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Dimensions, Animated, PermissionsAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Native Agora SDK imports
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

interface VideoCallProps {
  visible: boolean;
  remoteUserName: string;
  channelName: string;
  userId: string;
  callId?: string;
  isVideoCall: boolean;
  isCaller?: boolean;
  onEnd?: () => void;
  onRejected?: () => void;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '43c07f0cef814fd4a5ae3283c8bd77de';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://leylek-bug.preview.emergentagent.com';
const MAX_CALL_DURATION = 600; // 10 dakika (saniye)
const RING_TIMEOUT = 60; // 60 saniye çalma süresi

// Android için izin isteme
const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    try {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      
      const audioGranted = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const cameraGranted = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      
      return audioGranted;
    } catch (err) {
      console.log('İzin hatası:', err);
      return false;
    }
  }
  return true;
};

export default function VideoCall({
  visible,
  remoteUserName,
  channelName,
  userId,
  callId,
  isVideoCall,
  isCaller = false,
  onEnd,
  onRejected,
}: VideoCallProps) {
  // Arama durumları: 'connecting' | 'ringing' | 'connected' | 'ended'
  const [callState, setCallState] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [ringDuration, setRingDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  
  const engineRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCleanedUp = useRef(false);
  const localUidRef = useRef<number>(Math.floor(Math.random() * 100000) + 1);
  
  // Pulse animasyonu
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Call ID'yi channel name'den çıkar
  const getCallId = () => {
    if (callId) return callId;
    if (channelName.startsWith('leylek_')) {
      return channelName.replace('leylek_', '');
    }
    return channelName;
  };

  useEffect(() => {
    if (visible && !isCleanedUp.current) {
      console.log('📞 Arama başlatılıyor...');
      console.log('📞 isCaller:', isCaller);
      console.log('📞 channelName:', channelName);
      console.log('📞 callId:', getCallId());
      
      isCleanedUp.current = false;
      setCallState('connecting');
      initAgora();
      
      // Arayan için durum kontrolü başlat
      if (isCaller) {
        startCallerStatusCheck();
      }
    }
    
    return () => {
      cleanup();
    };
  }, [visible]);

  // Pulse animasyonu
  useEffect(() => {
    if (callState === 'ringing' || callState === 'connecting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callState]);

  // Çalma sayacı (arayan için)
  const startRingTimer = () => {
    setRingDuration(0);
    ringIntervalRef.current = setInterval(() => {
      setRingDuration(prev => {
        if (prev >= RING_TIMEOUT) {
          // Timeout - karşı taraf cevap vermedi
          handleTimeout();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Görüşme sayacı
  const startCallTimer = () => {
    setDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setDuration(prev => {
        if (prev >= MAX_CALL_DURATION) {
          // 10 dakika doldu
          Alert.alert('Süre Doldu', '10 dakikalık görüşme süresi doldu.');
          handleEndCall();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Arayan için arama durumu kontrolü
  const startCallerStatusCheck = () => {
    callStatusIntervalRef.current = setInterval(async () => {
      try {
        const cid = getCallId();
        const response = await fetch(`${BACKEND_URL}/api/voice/check-call-status?user_id=${userId}&call_id=${cid}`);
        const data = await response.json();
        
        console.log('📞 Arama durumu:', data);
        
        if (data.success) {
          if (data.status === 'rejected') {
            // Reddedildi
            console.log('📞 Arama reddedildi!');
            if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
            if (callStatusIntervalRef.current) clearInterval(callStatusIntervalRef.current);
            
            cleanup();
            Alert.alert('Arama Reddedildi', `${remoteUserName} aramayı reddetti.`);
            onRejected?.();
            onEnd?.();
          } else if (data.status === 'ended' || data.should_close) {
            // Arama sonlandırıldı
            console.log('📞 Arama sonlandırıldı!');
            if (callStatusIntervalRef.current) clearInterval(callStatusIntervalRef.current);
            
            if (!remoteUid) {
              // Henüz bağlanmamıştı, cevap vermedi
              cleanup();
              Alert.alert('Cevap Yok', `${remoteUserName} aramayı yanıtlamadı.`);
              onEnd?.();
            }
          } else if (data.status === 'accepted' && !remoteUid) {
            // Kabul edildi ama henüz Agora'da bağlanmadı
            console.log('📞 Arama kabul edildi, bağlanıyor...');
            setCallState('ringing');
          }
        }
      } catch (e) {
        console.log('Status check error:', e);
      }
    }, 1000);
  };

  // Timeout - cevap vermedi
  const handleTimeout = async () => {
    console.log('⏰ Arama zaman aşımı - cevap vermedi');
    
    try {
      const cid = getCallId();
      await fetch(`${BACKEND_URL}/api/voice/cancel-call?call_id=${cid}&user_id=${userId}`, {
        method: 'POST'
      });
    } catch (e) {}
    
    cleanup();
    Alert.alert('Cevap Yok', `${remoteUserName} aramayı yanıtlamadı.`);
    onEnd?.();
  };

  const initAgora = async () => {
    try {
      console.log('🎬 Agora başlatılıyor...');
      
      if (!AGORA_APP_ID) {
        Alert.alert('Hata', 'Agora App ID bulunamadı');
        onEnd?.();
        return;
      }
      
      // İzinleri kontrol et
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert('İzin Gerekli', 'Mikrofon izni verilmedi');
        onEnd?.();
        return;
      }
      
      // Önceki engine varsa temizle
      if (engineRef.current) {
        try {
          engineRef.current.leaveChannel();
          engineRef.current.release();
        } catch (e) {}
        engineRef.current = null;
      }
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      
      // Engine'i başlat
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication || 0,
      });
      
      // Event listeners
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: any, elapsed: number) => {
          console.log('✅ Kanala katıldım!');
          setIsJoined(true);
          
          if (isCaller) {
            // Arayan - çalma başlasın
            setCallState('ringing');
            startRingTimer();
          } else {
            // Aranan - direkt bağlandı
            setCallState('connected');
            startCallTimer();
          }
        },
        onUserJoined: (connection: any, uid: number) => {
          console.log('👤 Karşı taraf katıldı! UID:', uid);
          setRemoteUid(uid);
          
          // Arayan için - karşı taraf bağlandı
          if (isCaller) {
            if (ringIntervalRef.current) {
              clearInterval(ringIntervalRef.current);
              ringIntervalRef.current = null;
            }
            setCallState('connected');
            startCallTimer();
          }
        },
        onUserOffline: (connection: any, uid: number, reason: number) => {
          console.log('👤 Karşı taraf ayrıldı');
          setRemoteUid(null);
          
          // Arama sonlandı
          cleanup();
          onEnd?.();
        },
        onError: (err: number, msg: string) => {
          console.log('❌ Agora hatası:', err, msg);
        },
      });
      
      // SES AYARLARI - YÜKSEK SES
      console.log('🔊 Ses ayarları yapılıyor...');
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400); // Mikrofon yükselt
      engine.adjustPlaybackSignalVolume(400);  // Hoparlör yükselt
      engine.muteLocalAudioStream(false);
      
      // Video ayarları
      if (isVideoCall) {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.muteLocalVideoStream(false);
        engine.startPreview();
        setIsVideoEnabled(true);
      }
      
      // TOKEN AL
      let token = '';
      try {
        const tokenResponse = await fetch(`${BACKEND_URL}/api/agora/token?channel_name=${channelName}&uid=${localUidRef.current}`);
        const tokenData = await tokenResponse.json();
        if (tokenData.success && tokenData.token) {
          token = tokenData.token;
          console.log('🔑 Token alındı');
        }
      } catch (e) {
        console.log('⚠️ Token alınamadı');
      }
      
      // KANALA KATIL
      console.log('📞 Kanala katılınıyor:', channelName);
      await engine.joinChannel(token, channelName, localUidRef.current, {
        clientRoleType: ClientRoleType?.ClientRoleBroadcaster || 1,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideoCall,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideoCall,
      });
      
    } catch (error) {
      console.error('❌ Agora init error:', error);
      Alert.alert('Hata', 'Arama başlatılamadı');
      onEnd?.();
    }
  };

  const cleanup = () => {
    if (isCleanedUp.current) return;
    isCleanedUp.current = true;
    
    console.log('🧹 Cleanup...');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    
    if (callStatusIntervalRef.current) {
      clearInterval(callStatusIntervalRef.current);
      callStatusIntervalRef.current = null;
    }
    
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      } catch (e) {}
    }
    
    setCallState('ended');
  };

  // Aramayı sonlandır
  const handleEndCall = async () => {
    console.log('📞 Arama sonlandırılıyor...');
    
    const cid = getCallId();
    const isConnected = callState === 'connected';
    
    // Backend'e bildir
    try {
      if (isCaller && !isConnected) {
        // Arayan ve henüz bağlanmamış = iptal
        await fetch(`${BACKEND_URL}/api/voice/cancel-call?call_id=${cid}&user_id=${userId}`, { method: 'POST' });
      } else {
        // Bağlı = sonlandır
        await fetch(`${BACKEND_URL}/api/voice/end-call?call_id=${cid}&user_id=${userId}`, { method: 'POST' });
      }
    } catch (e) {
      console.log('End call error:', e);
    }
    
    cleanup();
    onEnd?.();
  };

  const toggleMute = () => {
    if (engineRef.current) {
      const newMuted = !isMuted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setIsMuted(newMuted);
    }
  };

  const toggleSpeaker = () => {
    if (engineRef.current) {
      const newSpeaker = !isSpeakerOn;
      engineRef.current.setEnableSpeakerphone(newSpeaker);
      setIsSpeakerOn(newSpeaker);
    }
  };

  const toggleVideo = () => {
    if (engineRef.current && isVideoCall) {
      const newEnabled = !isVideoEnabled;
      engineRef.current.muteLocalVideoStream(!newEnabled);
      setIsVideoEnabled(newEnabled);
    }
  };

  // Süre formatla
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Durum metni
  const getStatusText = () => {
    switch (callState) {
      case 'connecting':
        return 'Bağlanıyor...';
      case 'ringing':
        return isCaller ? 'Aranıyor...' : 'Gelen Arama';
      case 'connected':
        return 'Bağlandı';
      case 'ended':
        return 'Arama Sonlandı';
      default:
        return '';
    }
  };

  // Durum rengi
  const getStatusColor = () => {
    switch (callState) {
      case 'connecting':
        return '#FFA500'; // Turuncu
      case 'ringing':
        return '#3B82F6'; // Mavi
      case 'connected':
        return '#22C55E'; // Yeşil
      case 'ended':
        return '#EF4444'; // Kırmızı
      default:
        return '#666';
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <LinearGradient
        colors={callState === 'connected' ? ['#065F46', '#047857', '#059669'] : ['#1E3A5F', '#2C5282', '#3182CE']}
        style={styles.container}
      >
        {/* Üst Bilgi */}
        <View style={styles.topSection}>
          {/* Durum Badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <View style={[styles.statusDot, { backgroundColor: callState === 'connected' ? '#86EFAC' : '#FFF' }]} />
            <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
          </View>
          
          {/* Avatar */}
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={callState === 'connected' ? ['#22C55E', '#16A34A'] : ['#3B82F6', '#2563EB']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{remoteUserName.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            {callState === 'connected' && (
              <View style={styles.connectedIndicator}>
                <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
              </View>
            )}
          </Animated.View>
          
          {/* İsim */}
          <Text style={styles.userName}>{remoteUserName}</Text>
          
          {/* Süre/Durum */}
          {callState === 'connected' ? (
            <View style={styles.durationContainer}>
              <Ionicons name="time-outline" size={18} color="#22C55E" />
              <Text style={styles.durationText}>{formatTime(duration)}</Text>
              <Text style={styles.maxDuration}> / {formatTime(MAX_CALL_DURATION)}</Text>
            </View>
          ) : callState === 'ringing' && isCaller ? (
            <Text style={styles.ringText}>Çalıyor... {ringDuration}s</Text>
          ) : (
            <Text style={styles.callTypeText}>{isVideoCall ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}</Text>
          )}
        </View>

        {/* Video Görünümü */}
        {isVideoCall && callState === 'connected' && (
          <View style={styles.videoSection}>
            {/* Remote Video */}
            {remoteUid && RtcSurfaceView && (
              <RtcSurfaceView
                style={styles.remoteVideo}
                canvas={{ uid: remoteUid }}
              />
            )}
            
            {/* Local Video */}
            {isVideoEnabled && RtcSurfaceView && (
              <View style={styles.localVideoContainer}>
                <RtcSurfaceView
                  style={styles.localVideo}
                  canvas={{ uid: 0 }}
                  zOrderMediaOverlay={true}
                />
              </View>
            )}
          </View>
        )}

        {/* Kontrol Butonları */}
        <View style={styles.controlsSection}>
          {callState === 'connected' && (
            <View style={styles.controlsRow}>
              {/* Mikrofon */}
              <TouchableOpacity 
                style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                onPress={toggleMute}
              >
                <Ionicons 
                  name={isMuted ? "mic-off" : "mic"} 
                  size={28} 
                  color={isMuted ? "#EF4444" : "#FFF"} 
                />
                <Text style={styles.controlLabel}>{isMuted ? 'Kapalı' : 'Mikrofon'}</Text>
              </TouchableOpacity>
              
              {/* Hoparlör */}
              <TouchableOpacity 
                style={[styles.controlButton, !isSpeakerOn && styles.controlButtonActive]}
                onPress={toggleSpeaker}
              >
                <Ionicons 
                  name={isSpeakerOn ? "volume-high" : "volume-mute"} 
                  size={28} 
                  color={!isSpeakerOn ? "#EF4444" : "#FFF"} 
                />
                <Text style={styles.controlLabel}>{isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}</Text>
              </TouchableOpacity>
              
              {/* Video Toggle */}
              {isVideoCall && (
                <TouchableOpacity 
                  style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
                  onPress={toggleVideo}
                >
                  <Ionicons 
                    name={isVideoEnabled ? "videocam" : "videocam-off"} 
                    size={28} 
                    color={!isVideoEnabled ? "#EF4444" : "#FFF"} 
                  />
                  <Text style={styles.controlLabel}>{isVideoEnabled ? 'Kamera' : 'Kapalı'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Kapat Butonu */}
          <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
            <LinearGradient
              colors={['#EF4444', '#DC2626', '#B91C1C']}
              style={styles.endCallGradient}
            >
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.endCallLabel}>
            {callState === 'connected' ? 'Aramayı Bitir' : 'İptal'}
          </Text>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  topSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 30,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  connectedIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 14,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  durationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22C55E',
    marginLeft: 6,
  },
  maxDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  ringText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  callTypeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  videoSection: {
    flex: 1,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
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
  controlsSection: {
    alignItems: 'center',
    paddingBottom: 50,
    paddingTop: 30,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 30,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },
  endCallButton: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  endCallGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
  },
});
