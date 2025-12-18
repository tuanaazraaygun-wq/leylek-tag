import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Dimensions, PermissionsAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

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
  isCaller?: boolean; // ARAYAN MI?
  onEnd?: () => void;
  onRejected?: () => void; // Arama reddedildiğinde
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const MAX_CALL_DURATION = 600; // 10 dakika = 600 saniye

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
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callRejected, setCallRejected] = useState(false);
  
  const engineRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localUidRef = useRef<number>(Math.floor(Math.random() * 100000));

  useEffect(() => {
    if (visible && isNative && createAgoraRtcEngine) {
      initAgora();
    } else if (visible && !isNative) {
      // Web fallback - simüle et
      setCallState('connected');
      startTimer();
    }

    return () => {
      cleanup();
    };
  }, [visible]);

  // ARAYAN İÇİN: Arama durumu takibi - reddedildi mi kontrol et
  useEffect(() => {
    if (!visible || !isCaller || !channelName || !userId) return;
    
    const checkCallStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/voice/call-status?tag_id=${channelName}&user_id=${userId}`);
        const data = await response.json();
        
        console.log('📞 Arayan call-status:', data);
        
        // Arama reddedildiyse veya sonlandırıldıysa
        if (data.success && !data.has_active_call) {
          if (data.was_rejected || data.status === 'rejected') {
            console.log('❌ Arama reddedildi!');
            setCallRejected(true);
            Alert.alert('Arama Reddedildi', 'Karşı taraf aramayı reddetti.');
            
            // Cleanup ve çıkış
            if (callStatusIntervalRef.current) {
              clearInterval(callStatusIntervalRef.current);
              callStatusIntervalRef.current = null;
            }
            
            onRejected?.();
            onEnd?.();
          } else if (data.status === 'ended' || data.status === 'none') {
            // Arama sonlandı
            console.log('📞 Arama sonlandı');
            if (callStatusIntervalRef.current) {
              clearInterval(callStatusIntervalRef.current);
              callStatusIntervalRef.current = null;
            }
            onEnd?.();
          }
        }
      } catch (error) {
        console.log('Call status check error:', error);
      }
    };
    
    // Her 2 saniyede kontrol et
    callStatusIntervalRef.current = setInterval(checkCallStatus, 2000);
    checkCallStatus(); // İlk kontrol
    
    return () => {
      if (callStatusIntervalRef.current) {
        clearInterval(callStatusIntervalRef.current);
        callStatusIntervalRef.current = null;
      }
    };
  }, [visible, isCaller, channelName, userId]);

  const startTimer = () => {
    if (durationIntervalRef.current) return;
    
    durationIntervalRef.current = setInterval(() => {
      setDuration((prev) => {
        const newDuration = prev + 1;
        if (newDuration >= MAX_CALL_DURATION) {
          handleEndCall();
          return prev;
        }
        return newDuration;
      });
    }, 1000);
  };

  // İzin isteme fonksiyonu
  const requestPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ];
        
        if (isVideoCall) {
          permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }

        console.log('📱 Android izinleri isteniyor...');
        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted = !isVideoCall || results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        
        console.log('🎤 Mikrofon izni:', audioGranted ? 'VERİLDİ' : 'REDDEDİLDİ');
        if (isVideoCall) {
          console.log('📹 Kamera izni:', cameraGranted ? 'VERİLDİ' : 'REDDEDİLDİ');
        }
        
        if (!audioGranted) {
          Alert.alert('İzin Gerekli', 'Sesli arama için mikrofon izni gereklidir.');
          return false;
        }
        
        if (isVideoCall && !cameraGranted) {
          Alert.alert('İzin Gerekli', 'Görüntülü arama için kamera izni gereklidir.');
          return false;
        }
        
        return true;
      }
      
      // iOS için expo-av ve expo-image-picker kullan
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      console.log('🎤 iOS Mikrofon izni:', audioStatus);
      
      if (audioStatus !== 'granted') {
        Alert.alert('İzin Gerekli', 'Sesli arama için mikrofon izni gereklidir.');
        return false;
      }
      
      if (isVideoCall) {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        console.log('📹 iOS Kamera izni:', cameraStatus);
        
        if (cameraStatus !== 'granted') {
          Alert.alert('İzin Gerekli', 'Görüntülü arama için kamera izni gereklidir.');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('İzin hatası:', error);
      return false;
    }
  };

  const initAgora = async () => {
    try {
      // Önce izinleri iste
      console.log('🔐 İzinler kontrol ediliyor...');
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        console.error('❌ İzinler alınamadı!');
        onEnd?.();
        return;
      }
      console.log('✅ İzinler alındı!');

      if (!AGORA_APP_ID) {
        console.error('❌ Agora App ID bulunamadı!');
        Alert.alert('Hata', 'Agora App ID bulunamadı. Lütfen .env dosyasını kontrol edin.');
        return;
      }

      // Channel name temizle (sadece alfanumerik)
      const safeChannelName = channelName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 64) || 'defaultchannel';
      
      console.log('🎥 Agora başlatılıyor...');
      console.log('📍 AppID:', AGORA_APP_ID.substring(0, 8) + '...');
      console.log('📍 Channel:', safeChannelName);
      console.log('📍 isVideoCall:', isVideoCall);
      console.log('📍 UID:', localUidRef.current);

      // Engine oluştur
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      // Initialize
      engine.initialize({
        appId: AGORA_APP_ID,
      });
      console.log('✅ Engine initialized');

      // Event handlers
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: any, elapsed: number) => {
          console.log('✅✅✅ KANALA BAŞARIYLA KATILDI! Süre:', elapsed, 'ms');
          setCallState('connected');
          startTimer();
        },
        onUserJoined: (connection: any, uid: number, elapsed: number) => {
          console.log('👤👤👤 KARŞI TARAF KATILDI! UID:', uid);
          setRemoteUid(uid);
        },
        onUserOffline: async (connection: any, uid: number, reason: number) => {
          console.log('👤 Kullanıcı ayrıldı:', uid, 'sebep:', reason);
          setRemoteUid(null);
          
          // Karşı taraf ayrıldıysa aramayı sonlandır
          console.log('📞 Karşı taraf kapattı, arama sonlandırılıyor...');
          
          // Backend'e bildir
          const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
          try {
            await fetch(`${BACKEND_URL}/api/voice/end-call?tag_id=${channelName}&user_id=${userId}`, {
              method: 'POST'
            });
          } catch (e) {
            console.log('End call error:', e);
          }
          
          // Cleanup ve çıkış
          if (engineRef.current) {
            try {
              engineRef.current.leaveChannel();
              engineRef.current.release();
              engineRef.current = null;
            } catch (e) {}
          }
          
          Alert.alert('Arama Sonlandı', 'Karşı taraf aramadan ayrıldı.');
          setCallState('ended');
          onEnd?.();
        },
        onError: (err: number, msg: string) => {
          console.error('❌ Agora Error:', err, msg);
          if (err === 110) {
            console.log('Token hatası - Testing Mode aktif mi kontrol edin');
          }
        },
        onConnectionStateChanged: (connection: any, state: number, reason: number) => {
          console.log('🔗 Bağlantı durumu:', state, 'sebep:', reason);
          if (state === 3) {
            setCallState('connected');
          } else if (state === 5) {
            console.error('❌ Bağlantı başarısız!');
          }
        },
      });

      // Channel profile: COMMUNICATION (1-1 arama için)
      engine.setChannelProfile(0); // 0 = COMMUNICATION
      
      // Client role: BROADCASTER (ses/video gönder ve al)
      engine.setClientRole(1); // 1 = BROADCASTER

      // Audio ayarları - ÖNEMLİ: enableLocalAudio ile mikrofonu aktifleştir
      engine.enableAudio();
      engine.enableLocalAudio(true); // Mikrofonu aktifleştir
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400); // Mikrofon sesini yükselt
      engine.adjustPlaybackSignalVolume(400); // Hoparlör sesini yükselt
      console.log('✅ Audio enabled + Local Audio aktif');

      // Video ayarları (eğer görüntülü arama ise)
      if (isVideoCall) {
        engine.enableVideo();
        engine.enableLocalVideo(true); // Kamerayı aktifleştir
        engine.startPreview();
        console.log('✅ Video enabled + Local Video aktif');
      }

      console.log('🔄 Kanala katılınıyor:', safeChannelName);
      
      // joinChannel - Testing Mode için token boş string
      const result = engine.joinChannel('', safeChannelName, localUidRef.current, {
        clientRoleType: 1,
        channelProfile: 0,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideoCall,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideoCall,
      });
      
      console.log('📞 joinChannel sonucu:', result);

      if (result !== 0) {
        console.error('❌ joinChannel hatası:', result);
        // 2 saniye sonra tekrar dene
        setTimeout(() => {
          console.log('🔄 Tekrar deneniyor...');
          engine.joinChannel('', safeChannelName, localUidRef.current, {});
        }, 2000);
      }

      // 5 saniye sonra bağlantı kontrolü
      setTimeout(() => {
        if (callState === 'connecting') {
          console.log('⏱️ Timeout - bağlantı durumu güncelleniyor');
          setCallState('connected');
          startTimer();
        }
      }, 5000);

    } catch (error: any) {
      console.error('❌ Agora başlatma hatası:', error);
      Alert.alert('Hata', 'Arama başlatılamadı: ' + error.message);
    }
  };

  const cleanup = async () => {
    console.log('🧹 Cleanup başlıyor...');
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (engineRef.current) {
      try {
        if (isVideoCall) {
          engineRef.current.stopPreview();
        }
        engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
        console.log('✅ Cleanup tamamlandı');
      } catch (e) {
        console.log('Cleanup hatası:', e);
      }
    }
  };

  const handleEndCall = async () => {
    console.log('📞 Arama sonlandırılıyor...');
    
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    
    // Backend'e aramayı sonlandır - karşı taraf da çıksın
    try {
      await fetch(`${BACKEND_URL}/api/voice/end-call?tag_id=${channelName}&user_id=${userId}`, {
        method: 'POST'
      });
      console.log('✅ Backend arama sonlandırıldı');
    } catch (error) {
      console.log('End call hatası:', error);
    }

    await cleanup();
    setCallState('ended');
    setDuration(0);
    setRemoteUid(null);
    onEnd?.();
  };

  const toggleMute = () => {
    if (engineRef.current) {
      const newMuted = !isMuted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setIsMuted(newMuted);
      console.log('🎤 Mikrofon:', newMuted ? 'Kapalı' : 'Açık');
    }
  };

  const toggleVideo = () => {
    if (engineRef.current && isVideoCall) {
      const newVideoState = !isVideoEnabled;
      engineRef.current.muteLocalVideoStream(!newVideoState);
      setIsVideoEnabled(newVideoState);
      console.log('📹 Kamera:', newVideoState ? 'Açık' : 'Kapalı');
    }
  };

  const toggleCamera = () => {
    if (engineRef.current && isVideoCall) {
      engineRef.current.switchCamera();
      setIsFrontCamera(!isFrontCamera);
      console.log('📷 Kamera:', isFrontCamera ? 'Arka' : 'Ön');
    }
  };

  const toggleSpeaker = () => {
    if (engineRef.current) {
      const newSpeakerState = !isSpeakerOn;
      engineRef.current.setEnableSpeakerphone(newSpeakerState);
      setIsSpeakerOn(newSpeakerState);
      console.log('🔊 Hoparlör:', newSpeakerState ? 'Açık' : 'Kapalı');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const remainingTime = MAX_CALL_DURATION - duration;
  const remainingMins = Math.floor(remainingTime / 60);
  const remainingSecs = remainingTime % 60;

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
              <Text style={styles.webNotice}>⚠️ Web'de {isVideoCall ? 'görüntülü' : 'sesli'} arama desteklenmiyor</Text>
              <Text style={styles.webNotice}>Lütfen mobil uygulamayı kullanın</Text>
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
          <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.container}>
            <View style={styles.header}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.statusText}>
                {isVideoCall ? '📹 Görüntülü arama' : '📞 Sesli arama'}
              </Text>
              <Text style={styles.connectingText}>Bağlanıyor...</Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="close" size={36} color="#FFF" />
              <Text style={styles.controlLabel}>İptal</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Aktif görüntülü arama
  if (isVideoCall && callState === 'connected') {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.videoContainer}>
          {/* Uzak video (tam ekran) */}
          {remoteUid && RtcSurfaceView ? (
            <RtcSurfaceView
              style={styles.remoteVideo}
              canvas={{ uid: remoteUid }}
            />
          ) : (
            <View style={styles.waitingContainer}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName?.[0] || '?'}</Text>
              </View>
              <Text style={styles.waitingText}>{remoteUserName}</Text>
              <Text style={styles.waitingSubtext}>Karşı taraf bekleniyor...</Text>
            </View>
          )}

          {/* Yerel video (küçük pencere) */}
          {isVideoEnabled && RtcSurfaceView && (
            <View style={styles.localVideoContainer}>
              <RtcSurfaceView
                style={styles.localVideo}
                canvas={{ uid: 0 }}
                zOrderMediaOverlay={true}
              />
            </View>
          )}

          {/* Üst bilgi */}
          <View style={styles.topOverlay}>
            <Text style={styles.callerNameOverlay}>{remoteUserName}</Text>
            <Text style={styles.durationOverlay}>{formatDuration(duration)}</Text>
            <Text style={styles.remainingTime}>
              Kalan: {remainingMins}:{remainingSecs < 10 ? '0' : ''}{remainingSecs}
            </Text>
          </View>

          {/* Alt kontroller */}
          <View style={styles.videoControls}>
            <TouchableOpacity 
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlBtn, !isVideoEnabled && styles.controlBtnActive]} 
              onPress={toggleVideo}
            >
              <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn} onPress={toggleCamera}>
              <Ionicons name="camera-reverse" size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.endButtonVideo} onPress={handleEndCall}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>

          {/* 1 dakika kaldı uyarısı */}
          {remainingTime <= 60 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>⚠️ {remainingTime} saniye kaldı!</Text>
            </View>
          )}
        </View>
      </Modal>
    );
  }

  // Aktif sesli arama
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
              {remoteUid ? '✅ Bağlandı' : '⏳ Karşı taraf bekleniyor...'}
            </Text>
            <Text style={styles.remainingTimeVoice}>
              Kalan süre: {remainingMins}:{remainingSecs < 10 ? '0' : ''}{remainingSecs}
            </Text>
            {remainingTime <= 60 && (
              <Text style={styles.warningText}>⚠️ Son {remainingTime} saniye!</Text>
            )}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFF" />
              <Text style={styles.controlLabel}>{isMuted ? 'Aç' : 'Sessize'}</Text>
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
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
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
  connectingText: {
    fontSize: 20,
    color: '#FFF',
    marginTop: 20,
  },
  remainingTimeVoice: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
  },
  warningText: {
    fontSize: 18,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginTop: 12,
  },
  webNotice: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    paddingBottom: 40,
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
  // Video call styles
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  waitingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
  },
  waitingSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
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
  topOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  callerNameOverlay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  durationOverlay: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  remainingTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
  endButtonVideo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBanner: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningBannerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
