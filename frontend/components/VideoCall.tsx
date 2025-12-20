import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Native Agora SDK imports
let createAgoraRtcEngine: any = null;
let RtcSurfaceView: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;

const isNative = Platform.OS !== 'web';

if (isNative) {
  try {
    const AgoraModule = require('react-native-agora');
    createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
    RtcSurfaceView = AgoraModule.RtcSurfaceView;
    ChannelProfileType = AgoraModule.ChannelProfileType;
    ClientRoleType = AgoraModule.ClientRoleType;
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
const MAX_CALL_DURATION = 600; // 10 dakika
const RING_TIMEOUT = 30; // 30 saniye zil çalma süresi

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
  const [isLocalVideoLarge, setIsLocalVideoLarge] = useState(false); // Küçük/büyük ekran değiştirme
  
  const engineRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localUidRef = useRef<number>(Math.floor(Math.random() * 100000));
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

  // Arama durumu kontrolü - 2 saniyede bir
  useEffect(() => {
    if (!visible || !channelName || !userId || isCleanedUp.current) return;
    
    const checkStatus = async () => {
      if (isCleanedUp.current) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/voice/call-status?tag_id=${channelName}&user_id=${userId}`);
        const data = await response.json();
        
        if (isCleanedUp.current) return;
        
        // Arama sonlandırıldı veya reddedildi
        if (data.success && !data.has_active_call) {
          console.log('📞 Arama sonlandırıldı/reddedildi:', data);
          handleCallEnded(data.was_rejected);
        }
      } catch (error) {
        console.log('Call status check error:', error);
      }
    };
    
    // Hemen kontrol et
    checkStatus();
    
    // 2 saniyede bir kontrol
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
          // Zil çalma süresi doldu - arama iptal
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
    console.log('⏰ Arama zaman aşımı - karşı taraf yanıt vermedi');
    
    // Backend'e iptal bildir
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
      console.log('📱 App ID:', AGORA_APP_ID ? 'VAR' : 'YOK');
      console.log('📞 Channel:', channelName);
      console.log('🎥 Video Call:', isVideoCall);
      
      if (!AGORA_APP_ID) {
        Alert.alert('Hata', 'Agora App ID bulunamadı');
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
      
      // Event listeners
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: any, elapsed: number) => {
          console.log('✅ Kanala katıldı - elapsed:', elapsed);
          if (!isCaller) {
            setCallState('connected');
            startCallTimer();
          }
        },
        onUserJoined: (connection: any, uid: number) => {
          console.log('👤 Karşı taraf katıldı - UID:', uid);
          setRemoteUid(uid);
          
          // Arayan için: karşı taraf katıldı, artık bağlandı
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
          console.log('👤 Karşı taraf ayrıldı - UID:', uid, 'Reason:', reason);
          setRemoteUid(null);
          handleCallEnded(false);
        },
        onError: (err: number, msg: string) => {
          console.log('❌ Agora hatası:', err, msg);
        },
        onLocalAudioStateChanged: (state: number, error: number) => {
          console.log('🎤 Local Audio State:', state, 'Error:', error);
        },
        onRemoteAudioStateChanged: (connection: any, uid: number, state: number, reason: number) => {
          console.log('🔊 Remote Audio State - UID:', uid, 'State:', state);
        },
        onLocalVideoStateChanged: (source: any, state: number, error: number) => {
          console.log('📹 Local Video State:', state, 'Error:', error);
        },
        onRemoteVideoStateChanged: (connection: any, uid: number, state: number, reason: number) => {
          console.log('📺 Remote Video State - UID:', uid, 'State:', state);
        },
      });
      
      // ÖNEMLİ: Önce audio ayarlarını yap
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.adjustRecordingSignalVolume(100); // Mikrofon ses seviyesi
      engine.adjustPlaybackSignalVolume(100); // Hoparlör ses seviyesi
      
      // Video araması ise video'yu etkinleştir
      if (isVideoCall) {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.startPreview();
        console.log('📹 Video başlatıldı');
      }
      
      // Kanala katıl - token boş, app ID test modu için
      const joinResult = await engine.joinChannel('', channelName, localUidRef.current, {
        clientRoleType: ClientRoleType?.ClientRoleBroadcaster || 1,
        publishMicrophoneTrack: true, // ÖNEMLİ: Mikrofonu yayınla
        publishCameraTrack: isVideoCall, // Video varsa kamerayı yayınla
        autoSubscribeAudio: true, // Karşı tarafın sesini otomatik al
        autoSubscribeVideo: isVideoCall, // Video varsa otomatik al
      });
      
      console.log('📞 Kanala katılım başlatıldı - Result:', joinResult);
      
      // Mikrofonu ve hoparlörü açık tut
      engine.muteLocalAudioStream(false);
      if (isVideoCall) {
        engine.muteLocalVideoStream(false);
      }
      
    } catch (error) {
      console.error('Agora init error:', error);
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
        if (isVideoCall) {
          engineRef.current.stopPreview();
        }
        engineRef.current.leaveChannel();
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
      engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (engineRef.current) {
      if (isVideoEnabled) {
        engineRef.current.muteLocalVideoStream(true);
      } else {
        engineRef.current.muteLocalVideoStream(false);
      }
      setIsVideoEnabled(!isVideoEnabled);
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
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradient}>
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
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradient}>
          
          {/* Video Görüntüleri */}
          {isVideoCall && isVideoEnabled && RtcSurfaceView && (
            <>
              {/* Ana Ekran - Karşı taraf veya kendi görüntün */}
              <View style={styles.mainVideoContainer}>
                {isLocalVideoLarge ? (
                  // Kendi görüntün büyük ekranda
                  <RtcSurfaceView
                    style={styles.fullVideo}
                    canvas={{ uid: 0, sourceType: 1, mirrorMode: 0, setupMode: 0 }}
                  />
                ) : remoteUid ? (
                  // Karşı taraf büyük ekranda
                  <RtcSurfaceView
                    style={styles.fullVideo}
                    canvas={{ uid: remoteUid, sourceType: 1, mirrorMode: 0, setupMode: 0 }}
                  />
                ) : (
                  // Bağlanmayı beklerken kendi görüntün
                  <RtcSurfaceView
                    style={styles.fullVideo}
                    canvas={{ uid: 0, sourceType: 1, mirrorMode: 0, setupMode: 0 }}
                  />
                )}
              </View>
              
              {/* Küçük Ekran - Sol Üst (Facebook gibi) */}
              {remoteUid && (
                <TouchableOpacity 
                  style={styles.pipContainer}
                  onPress={() => setIsLocalVideoLarge(!isLocalVideoLarge)}
                  activeOpacity={0.9}
                >
                  <RtcSurfaceView
                    style={styles.pipVideo}
                    canvas={{ 
                      uid: isLocalVideoLarge ? remoteUid : 0, 
                      sourceType: 1, 
                      mirrorMode: 0, 
                      setupMode: 0 
                    }}
                  />
                  <View style={styles.pipSwitchIcon}>
                    <Ionicons name="swap-horizontal" size={16} color="#FFF" />
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.callerName}>{remoteUserName}</Text>
            <Text style={styles.callStatus}>
              {callState === 'ringing' && `Çalıyor... (${RING_TIMEOUT - ringDuration}s)`}
              {callState === 'connecting' && 'Bağlanıyor...'}
              {callState === 'connected' && (isVideoCall ? 'Görüntülü Arama' : 'Sesli Arama')}
            </Text>
            {callState === 'connected' && (
              <Text style={styles.duration}>{formatTime(duration)}</Text>
            )}
          </View>
          
          {/* Avatar (Sesli arama veya video kapalıyken) */}
          {(!isVideoCall || !isVideoEnabled || !remoteUid) && callState !== 'connected' && (
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{remoteUserName?.charAt(0) || '?'}</Text>
              </View>
              {callState === 'ringing' && (
                <View style={styles.ringingIndicator}>
                  <Ionicons name="call" size={24} color="#10B981" />
                  <Text style={styles.ringingText}>Aranıyor...</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Kontroller */}
          <View style={styles.controls}>
            {/* Üst Kontroller */}
            <View style={styles.topControls}>
              {/* Hoparlör */}
              <TouchableOpacity style={[styles.controlButton, !isSpeakerOn && styles.controlButtonOff]} onPress={toggleSpeaker}>
                <Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={24} color="#FFF" />
              </TouchableOpacity>
              
              {/* Mikrofon */}
              <TouchableOpacity style={[styles.controlButton, isMuted && styles.controlButtonOff]} onPress={toggleMute}>
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFF" />
              </TouchableOpacity>
              
              {/* Video Toggle */}
              {isVideoCall && (
                <TouchableOpacity style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]} onPress={toggleVideo}>
                  <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={24} color="#FFF" />
                </TouchableOpacity>
              )}
              
              {/* Kamera Çevir */}
              {isVideoCall && isVideoEnabled && (
                <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                  <Ionicons name="camera-reverse" size={24} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Kapatma Butonu */}
            <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.endCallGradient}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
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
  mainVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  fullVideo: {
    flex: 1,
  },
  // PIP (Picture in Picture) - Sol Üst Küçük Ekran
  pipContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  pipVideo: {
    flex: 1,
  },
  pipSwitchIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  duration: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFF',
  },
  ringingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ringingText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  controls: {
    paddingBottom: 50,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 30,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.5)',
  },
  endCallButton: {
    alignSelf: 'center',
    borderRadius: 35,
    overflow: 'hidden',
  },
  endCallGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
