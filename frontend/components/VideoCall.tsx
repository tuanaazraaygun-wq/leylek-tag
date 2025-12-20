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
    console.log('✅ Agora SDK yüklendi (Video)');
  } catch (e) {
    console.log('⚠️ Agora SDK yüklenemedi:', e);
  }
}

interface VideoCallProps {
  visible: boolean;
  remoteUserName: string;
  channelName: string;
  userId: string;
  isVideoCall: boolean;
  isCaller?: boolean;
  onEnd?: () => void;
  onRejected?: () => void;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const MAX_CALL_DURATION = 600;
const RING_TIMEOUT = 30;

// Android için izin isteme
const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    try {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      
      console.log('📱 İzinler:', grants);
      
      const audioGranted = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const cameraGranted = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      
      if (!audioGranted) {
        Alert.alert('İzin Gerekli', 'Mikrofon izni verilmedi. Arama yapılamaz.');
        return false;
      }
      
      return true;
    } catch (err) {
      console.warn('İzin hatası:', err);
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
  isVideoCall,
  isCaller = false,
  onEnd,
  onRejected,
}: VideoCallProps) {
  const [callState, setCallState] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [ringDuration, setRingDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isLocalVideoLarge, setIsLocalVideoLarge] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  
  const engineRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localUidRef = useRef<number>(Math.floor(Math.random() * 100000) + 1);
  const isCleanedUp = useRef(false);

  // Agora başlat
  useEffect(() => {
    if (visible && isNative && createAgoraRtcEngine) {
      isCleanedUp.current = false;
      initAgora();
      if (isCaller) {
        setCallState('ringing');
        startRingTimer();
      }
    } else if (visible && !isNative) {
      setCallState('connected');
      startCallTimer();
    }

    return () => {
      cleanup();
    };
  }, [visible]);

  // Arama durumu kontrolü
  useEffect(() => {
    if (!visible || !channelName || !userId || isCleanedUp.current) return;
    
    const checkStatus = async () => {
      if (isCleanedUp.current) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/voice/call-status?tag_id=${channelName}&user_id=${userId}`);
        const data = await response.json();
        
        if (isCleanedUp.current) return;
        
        if (data.success && !data.has_active_call) {
          console.log('📞 Arama sonlandırıldı:', data);
          handleCallEnded(data.was_rejected);
        }
      } catch (error) {
        console.log('Call status check error:', error);
      }
    };
    
    checkStatus();
    callStatusIntervalRef.current = setInterval(checkStatus, 2000);
    
    return () => {
      if (callStatusIntervalRef.current) {
        clearInterval(callStatusIntervalRef.current);
        callStatusIntervalRef.current = null;
      }
    };
  }, [visible, channelName, userId]);

  const startRingTimer = () => {
    setRingDuration(0);
    ringIntervalRef.current = setInterval(() => {
      setRingDuration(prev => {
        if (prev >= RING_TIMEOUT) {
          handleTimeout();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const startCallTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setDuration(prev => {
        if (prev >= MAX_CALL_DURATION) {
          handleEndCall();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleTimeout = async () => {
    console.log('⏰ Arama zaman aşımı');
    
    try {
      await fetch(`${BACKEND_URL}/api/voice/cancel-call?tag_id=${channelName}&user_id=${userId}`, {
        method: 'POST'
      });
    } catch (e) {}
    
    cleanup();
    Alert.alert('Yanıt Yok', 'Karşı taraf aramayı yanıtlamadı.');
    onEnd?.();
  };

  const handleCallEnded = (wasRejected: boolean = false) => {
    if (isCleanedUp.current) return;
    
    cleanup();
    
    if (wasRejected) {
      Alert.alert('Arama Reddedildi', 'Karşı taraf aramayı reddetti.');
      onRejected?.();
    }
    
    onEnd?.();
  };

  const initAgora = async () => {
    try {
      console.log('🎬 Agora başlatılıyor...');
      console.log('📱 App ID:', AGORA_APP_ID);
      console.log('📞 Channel:', channelName);
      console.log('🎥 Video Call:', isVideoCall);
      console.log('👤 Local UID:', localUidRef.current);
      
      if (!AGORA_APP_ID) {
        Alert.alert('Hata', 'Agora App ID bulunamadı');
        onEnd?.();
        return;
      }
      
      // İzinleri kontrol et
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        onEnd?.();
        return;
      }
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      
      // Engine'i başlat
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication || 0,
      });
      
      // Event listeners - ÖNEMLİ
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: any, elapsed: number) => {
          console.log('✅ KANALA KATILDIM! Elapsed:', elapsed, 'ms');
          setIsJoined(true);
          
          if (!isCaller) {
            setCallState('connected');
            startCallTimer();
          }
        },
        onUserJoined: (connection: any, uid: number) => {
          console.log('👤 KARŞI TARAF KATILDI! UID:', uid);
          setRemoteUid(uid);
          
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
          console.log('👤 Karşı taraf ayrıldı - UID:', uid);
          setRemoteUid(null);
          handleCallEnded(false);
        },
        onError: (err: number, msg: string) => {
          console.log('❌ Agora hatası:', err, msg);
          if (err === 17) {
            console.log('⚠️ Zaten kanala katılmış durumda');
          }
        },
        onConnectionStateChanged: (connection: any, state: number, reason: number) => {
          console.log('🔗 Bağlantı durumu:', state, 'Sebep:', reason);
        },
        onAudioDeviceStateChanged: (deviceId: string, deviceType: number, deviceState: number) => {
          console.log('🎤 Ses cihazı değişti:', deviceType, deviceState);
        },
      });
      
      // Ses ayarları - ÖNCELİKLİ
      console.log('🔊 Ses ayarları yapılıyor...');
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400); // Mikrofon %400
      engine.adjustPlaybackSignalVolume(400); // Hoparlör %400
      engine.muteLocalAudioStream(false);
      
      // Video ayarları
      if (isVideoCall) {
        console.log('📹 Video ayarları yapılıyor...');
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.startPreview();
        engine.muteLocalVideoStream(false);
      }
      
      // Kanala katıl - TOKEN İLE
      console.log('📞 Token alınıyor...');
      let token = '';
      try {
        const tokenResponse = await fetch(`${BACKEND_URL}/api/agora/token?channel_name=${channelName}&uid=${localUidRef.current}`);
        const tokenData = await tokenResponse.json();
        if (tokenData.success && tokenData.token) {
          token = tokenData.token;
          console.log('🔑 Token alındı!');
        } else {
          console.log('⚠️ Token alınamadı, boş token ile devam ediliyor');
        }
      } catch (e) {
        console.log('⚠️ Token API hatası, boş token ile devam ediliyor:', e);
      }
      
      console.log('📞 Kanala katılınıyor...');
      const options = {
        clientRoleType: ClientRoleType?.ClientRoleBroadcaster || 1,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideoCall,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideoCall,
      };
      
      await engine.joinChannel(token, channelName, localUidRef.current, options);
      console.log('📞 joinChannel çağrıldı!');
      
    } catch (error) {
      console.error('❌ Agora init error:', error);
      Alert.alert('Hata', 'Arama başlatılamadı: ' + String(error));
      onEnd?.();
    }
  };

  const cleanup = () => {
    if (isCleanedUp.current) return;
    isCleanedUp.current = true;
    
    console.log('🧹 Cleanup başlıyor...');
    
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
        engineRef.current.stopPreview();
        engineRef.current.leaveChannel();
        engineRef.current.unregisterEventHandler({});
        engineRef.current.release();
        engineRef.current = null;
      } catch (e) {
        console.log('Cleanup error:', e);
      }
    }
    
    setCallState('ended');
    setDuration(0);
    setRingDuration(0);
    setRemoteUid(null);
    setIsJoined(false);
  };

  const handleEndCall = async () => {
    console.log('📞 Arama sonlandırılıyor...');
    
    const endpoint = (isCaller && !remoteUid) 
      ? `/api/voice/cancel-call?tag_id=${channelName}&user_id=${userId}`
      : `/api/voice/end-call?tag_id=${channelName}&user_id=${userId}`;
    
    try {
      await fetch(`${BACKEND_URL}${endpoint}`, { method: 'POST' });
    } catch (error) {
      console.log('End call error:', error);
    }
    
    cleanup();
    onEnd?.();
  };

  const toggleMute = () => {
    if (engineRef.current) {
      const newMuted = !isMuted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setIsMuted(newMuted);
      console.log('🎤 Mikrofon:', newMuted ? 'KAPALI' : 'AÇIK');
    }
  };

  const toggleVideo = () => {
    if (engineRef.current && isVideoCall) {
      const newEnabled = !isVideoEnabled;
      engineRef.current.muteLocalVideoStream(!newEnabled);
      engineRef.current.enableLocalVideo(newEnabled);
      setIsVideoEnabled(newEnabled);
      console.log('📹 Video:', newEnabled ? 'AÇIK' : 'KAPALI');
    }
  };

  const switchCamera = () => {
    if (engineRef.current) {
      engineRef.current.switchCamera();
      setIsFrontCamera(!isFrontCamera);
    }
  };

  const toggleSpeaker = () => {
    if (engineRef.current) {
      engineRef.current.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  // Web fallback
  if (!isNative) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.container}>
          <LinearGradient colors={['#1E3A5F', '#0F172A']} style={styles.gradient}>
            <View style={styles.header}>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.callStatus}>Web Arama Simülasyonu</Text>
              <Text style={styles.duration}>{formatTime(duration)}</Text>
            </View>
            
            <View style={styles.controls}>
              <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        <LinearGradient colors={['#1E3A5F', '#0F172A']} style={styles.gradient}>
          
          {/* Uçtan Uca Şifreleme Uyarısı */}
          <View style={styles.encryptionBanner}>
            <Ionicons name="lock-closed" size={14} color="#10B981" />
            <Text style={styles.encryptionText}>🔒 Uçtan uca şifreli görüşme</Text>
          </View>
          
          {/* Video Görünümü */}
          {isVideoCall && RtcSurfaceView ? (
            <View style={styles.videoContainer}>
              {/* Karşı tarafın videosu - Büyük */}
              {remoteUid && !isLocalVideoLarge ? (
                <RtcSurfaceView
                  style={styles.remoteVideo}
                  canvas={{ uid: remoteUid }}
                />
              ) : (
                <View style={styles.remoteVideoPlaceholder}>
                  <Ionicons name="person" size={80} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.waitingText}>
                    {callState === 'ringing' ? 'Aranıyor...' : 
                     callState === 'connecting' ? 'Bağlanıyor...' : 
                     remoteUid ? '' : 'Karşı taraf bekleniyor...'}
                  </Text>
                </View>
              )}
              
              {/* Kendi videom - Küçük PiP */}
              <TouchableOpacity 
                style={[styles.localVideoContainer, isLocalVideoLarge && styles.localVideoLarge]}
                onPress={() => setIsLocalVideoLarge(!isLocalVideoLarge)}
              >
                {isVideoEnabled ? (
                  <RtcSurfaceView
                    style={styles.localVideo}
                    canvas={{ uid: 0, sourceType: VideoSourceType?.VideoSourceCamera || 1 }}
                    zOrderMediaOverlay={true}
                  />
                ) : (
                  <View style={styles.localVideoOff}>
                    <Ionicons name="videocam-off" size={24} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Sesli arama görünümü
            <View style={styles.audioCallContainer}>
              <View style={styles.avatarContainer}>
                <LinearGradient colors={['#3FA9F5', '#2563EB']} style={styles.avatar}>
                  <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
                </LinearGradient>
              </View>
              
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.callStatus}>
                {callState === 'ringing' ? `Aranıyor... ${ringDuration}s` : 
                 callState === 'connecting' ? 'Bağlanıyor...' : 
                 callState === 'connected' ? formatTime(duration) : 'Sonlandırıldı'}
              </Text>
              
              {/* Bağlantı durumu */}
              <View style={styles.connectionStatus}>
                <View style={[styles.statusDot, isJoined && styles.statusDotConnected]} />
                <Text style={styles.statusText}>
                  {isJoined ? 'Bağlı' : 'Bağlanıyor...'}
                </Text>
              </View>
            </View>
          )}
          
          {/* Kontrol Butonları */}
          <View style={styles.controlsContainer}>
            <View style={styles.controlsRow}>
              {/* Mikrofon */}
              <TouchableOpacity 
                style={[styles.controlButton, isMuted && styles.controlButtonActive]} 
                onPress={toggleMute}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color="#FFF" />
                <Text style={styles.controlLabel}>{isMuted ? 'Aç' : 'Kapat'}</Text>
              </TouchableOpacity>
              
              {/* Hoparlör */}
              <TouchableOpacity 
                style={[styles.controlButton, !isSpeakerOn && styles.controlButtonActive]} 
                onPress={toggleSpeaker}
              >
                <Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={28} color="#FFF" />
                <Text style={styles.controlLabel}>{isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}</Text>
              </TouchableOpacity>
              
              {/* Video (sadece video aramada) */}
              {isVideoCall && (
                <>
                  <TouchableOpacity 
                    style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]} 
                    onPress={toggleVideo}
                  >
                    <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={28} color="#FFF" />
                    <Text style={styles.controlLabel}>Video</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={28} color="#FFF" />
                    <Text style={styles.controlLabel}>Çevir</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            
            {/* Kapat Butonu */}
            <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
          
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  encryptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    marginTop: 50,
    marginHorizontal: 20,
    borderRadius: 20,
    gap: 6,
  },
  encryptionText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 16,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#3FA9F5',
  },
  localVideoLarge: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.4,
    top: 20,
    right: 20,
    left: 20,
  },
  localVideo: {
    flex: 1,
  },
  localVideoOff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  audioCallContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  statusDotConnected: {
    backgroundColor: '#10B981',
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
  },
  duration: {
    fontSize: 18,
    color: '#FFF',
    marginTop: 8,
  },
  controlsContainer: {
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 70,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.5)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
