/**
 * CallScreenV2 - Agora RTC Sesli/Görüntülü Arama
 * 
 * ✅ ÇÖZÜLEN SORUNLAR:
 * - Ses gitmiyor → Audio track publish düzeltildi
 * - Karşı tarafı görmüyor → Remote video render düzeltildi
 * - Tekrar arama ekranı → State yönetimi düzeltildi
 * - Zil sesi yok → InCallManager eklendi
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Vibration,
  Platform,
  Animated,
  Dimensions,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  VideoSourceType,
  RtcConnection,
  IRtcEngineEventHandler,
} from 'react-native-agora';
import InCallManager from 'react-native-incall-manager';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// AGORA CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const AGORA_APP_ID = '86eb50030f954355bc57696d45b343bd';

interface CallScreenProps {
  visible: boolean;
  mode: 'caller' | 'receiver';
  callId: string;
  channelName: string;
  agoraToken?: string;
  userId: string;
  remoteUserId: string;
  remoteName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
  callAccepted?: boolean;
  callRejected?: boolean;
  callEnded?: boolean;
  receiverOffline?: boolean;
}

// Log helper
const log = (msg: string, data?: any) => {
  const time = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`📞 [${time}] ${msg}`, data !== undefined ? JSON.stringify(data) : '');
};

export default function CallScreen({
  visible,
  mode,
  callId,
  channelName,
  agoraToken,
  userId,
  remoteUserId,
  remoteName,
  callType,
  onAccept,
  onReject,
  onEnd,
  onClose,
  callAccepted,
  callRejected,
  callEnded,
  receiverOffline,
}: CallScreenProps) {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number>(0);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [connectionState, setConnectionState] = useState('');
  
  const isVideo = callType === 'video';
  const engineRef = useRef<IRtcEngine | null>(null);
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isInitialized = useRef(false);
  const hasJoined = useRef(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // UID OLUŞTUR - Her kullanıcı için benzersiz
  // ═══════════════════════════════════════════════════════════════════════════
  const getUid = useCallback((id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 1000000) + 1;
  }, []);

  const myUid = getUid(userId);

  // ═══════════════════════════════════════════════════════════════════════════
  // İZİN KONTROLÜ - Runtime'da izin al
  // ═══════════════════════════════════════════════════════════════════════════
  const checkPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
      const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';
      
      log('İzin sonuçları', { audio: audioGranted, camera: cameraGranted });
      
      if (!audioGranted) {
        Alert.alert('İzin Gerekli', 'Sesli arama için mikrofon izni gereklidir.');
        return false;
      }
      
      return true;
    } catch (error) {
      log('İzin hatası', error);
      return false;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AGORA ENGINE BAŞLAT
  // ═══════════════════════════════════════════════════════════════════════════
  const initializeEngine = useCallback(async () => {
    if (isInitialized.current && engineRef.current) {
      log('Engine zaten hazır');
      return true;
    }

    try {
      log('Engine başlatılıyor...', { appId: AGORA_APP_ID.substring(0, 8) });
      
      // İzinleri kontrol et
      const hasPermissions = await checkPermissions();
      if (!hasPermissions) {
        log('İzinler alınamadı');
        return false;
      }

      const engine = createAgoraRtcEngine();
      
      // Initialize
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Event Handler
      const eventHandler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
          log('✅ KANALA KATILDIM', { channel: connection.channelId, uid: connection.localUid, elapsed });
          setJoined(true);
          setStatusText('Bağlandı, karşı taraf bekleniyor...');
          hasJoined.current = true;
        },
        
        onUserJoined: (connection: RtcConnection, uid: number, elapsed: number) => {
          log('✅ KARŞI TARAF KATILDI', { uid, elapsed });
          setRemoteUid(uid);
          setRemoteJoined(true);
          setStatusText('Görüşme başladı');
          
          // Zil sesini durdur, görüşme sesi başlat
          InCallManager.stopRingtone();
          InCallManager.start({ media: 'audio' });
          InCallManager.setForceSpeakerphoneOn(true);
          Vibration.cancel();
          
          // Süre sayacı başlat
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
              setDuration(d => d + 1);
            }, 1000);
          }
        },
        
        onUserOffline: (connection: RtcConnection, uid: number, reason: number) => {
          log('❌ KARŞI TARAF AYRILDI', { uid, reason });
          if (uid === remoteUid) {
            setRemoteUid(0);
            setRemoteJoined(false);
            setStatusText('Bağlantı kesildi');
          }
        },
        
        onError: (err: number, msg: string) => {
          log('❌ AGORA HATA', { err, msg });
        },
        
        onConnectionStateChanged: (connection: RtcConnection, state: number, reason: number) => {
          const states = ['Disconnected', 'Connecting', 'Connected', 'Reconnecting', 'Failed'];
          log('Bağlantı durumu', { state: states[state] || state, reason });
          setConnectionState(states[state] || `State: ${state}`);
        },
        
        onRemoteAudioStateChanged: (connection: RtcConnection, uid: number, state: number, reason: number, elapsed: number) => {
          log('Remote ses durumu', { uid, state, reason });
        },
        
        onRemoteVideoStateChanged: (connection: RtcConnection, uid: number, state: number, reason: number, elapsed: number) => {
          log('Remote video durumu', { uid, state, reason });
        },
        
        onFirstRemoteAudioFrame: (connection: RtcConnection, uid: number, elapsed: number) => {
          log('✅ İLK SES FRAME GELDİ', { uid, elapsed });
        },
        
        onFirstRemoteVideoFrame: (connection: RtcConnection, uid: number, width: number, height: number, elapsed: number) => {
          log('✅ İLK VIDEO FRAME GELDİ', { uid, width, height, elapsed });
        },
      };

      engine.registerEventHandler(eventHandler);

      // Audio ayarları - ÖNEMLİ
      engine.enableAudio();
      engine.setAudioProfile(0, 1); // Default profile, Chatroom scenario
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400); // Mikrofon hassasiyeti artır
      engine.adjustPlaybackSignalVolume(400); // Hoparlör sesi artır
      
      // Video ayarları
      if (isVideo) {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.startPreview();
      }

      engineRef.current = engine;
      isInitialized.current = true;
      log('✅ Engine hazır');
      return true;
    } catch (error) {
      log('❌ Engine init hatası', error);
      return false;
    }
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KANALA KATIL
  // ═══════════════════════════════════════════════════════════════════════════
  const joinChannel = useCallback(async () => {
    if (!engineRef.current) {
      log('Engine yok, önce başlatılacak');
      const success = await initializeEngine();
      if (!success) return;
    }

    if (hasJoined.current) {
      log('Zaten kanala katılmış');
      return;
    }

    try {
      const engine = engineRef.current!;
      
      // Channel name'i logla - DEBUG
      log('🔗 KANALA KATILINIYOR', { 
        channel: channelName, 
        uid: myUid, 
        token: agoraToken ? 'VAR' : 'YOK',
        isVideo,
      });

      setStatusText('Kanala bağlanıyor...');

      // Kanala katıl
      engine.joinChannel(
        agoraToken || '', // Token (boş string = tokenless)
        channelName,
        myUid,
        {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: isVideo,
          autoSubscribeAudio: true,
          autoSubscribeVideo: isVideo,
        }
      );

      log('joinChannel çağrıldı');
    } catch (error) {
      log('❌ Join hatası', error);
      setStatusText('Bağlantı hatası');
    }
  }, [channelName, myUid, agoraToken, isVideo, initializeEngine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KANALDAN AYRIL VE TEMİZLE
  // ═══════════════════════════════════════════════════════════════════════════
  const cleanup = useCallback(() => {
    log('Temizlik yapılıyor...');
    
    // Timer'ları temizle
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Vibration ve ses durdur
    Vibration.cancel();
    InCallManager.stop();
    InCallManager.stopRingtone();
    
    // Agora cleanup
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        if (isVideo) {
          engineRef.current.stopPreview();
        }
        engineRef.current.unregisterEventHandler({});
        engineRef.current.release();
      } catch (e) {
        log('Cleanup hatası (görmezden geliniyor)', e);
      }
      engineRef.current = null;
    }
    
    // State'leri sıfırla
    setJoined(false);
    setRemoteUid(0);
    setRemoteJoined(false);
    setDuration(0);
    setMuted(false);
    setCameraOff(false);
    isInitialized.current = false;
    hasJoined.current = false;
    
    log('Temizlik tamamlandı');
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARAMA SONLANDIR
  // ═══════════════════════════════════════════════════════════════════════════
  const endCall = useCallback(() => {
    log('Arama sonlandırılıyor...');
    cleanup();
    onEnd();
    setTimeout(onClose, 300);
  }, [cleanup, onEnd, onClose]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GELEN ARAMAYI KABUL ET
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAccept = useCallback(async () => {
    log('Arama KABUL ediliyor...');
    
    // Zil ve titreşimi durdur
    Vibration.cancel();
    InCallManager.stopRingtone();
    
    setStatusText('Bağlanıyor...');
    
    // Socket'e kabul bildir
    onAccept();
    
    // Engine başlat ve kanala katıl
    await initializeEngine();
    await joinChannel();
  }, [onAccept, initializeEngine, joinChannel]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GELEN ARAMAYI REDDET
  // ═══════════════════════════════════════════════════════════════════════════
  const handleReject = useCallback(() => {
    log('Arama REDDEDİLİYOR');
    Vibration.cancel();
    InCallManager.stopRingtone();
    onReject();
    setTimeout(onClose, 300);
  }, [onReject, onClose]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KONTROLLER
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleMute = useCallback(() => {
    if (engineRef.current) {
      const newMuted = !muted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setMuted(newMuted);
      log(newMuted ? 'Mikrofon KAPALI' : 'Mikrofon AÇIK');
    }
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    if (engineRef.current) {
      const newSpeaker = !speakerOn;
      engineRef.current.setEnableSpeakerphone(newSpeaker);
      InCallManager.setForceSpeakerphoneOn(newSpeaker);
      setSpeakerOn(newSpeaker);
      log(newSpeaker ? 'Hoparlör AÇIK' : 'Hoparlör KAPALI');
    }
  }, [speakerOn]);

  const toggleCamera = useCallback(() => {
    if (engineRef.current && isVideo) {
      const newOff = !cameraOff;
      engineRef.current.muteLocalVideoStream(newOff);
      setCameraOff(newOff);
      log(newOff ? 'Kamera KAPALI' : 'Kamera AÇIK');
    }
  }, [cameraOff, isVideo]);

  const switchCamera = useCallback(() => {
    if (engineRef.current && isVideo) {
      engineRef.current.switchCamera();
      log('Kamera değiştirildi');
    }
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Ekran açıldığında
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;

    log('═══════════════════════════════════════════════════════════');
    log('ARAMA EKRANI AÇILDI', { mode, callId, channelName, callType, userId, remoteUserId });
    log('═══════════════════════════════════════════════════════════');

    // Pulse animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // ARAYAN: Hemen bağlan
      setStatusText('Aranıyor...');
      
      // Arama sesi başlat
      InCallManager.start({ media: 'audio', ringback: '_DEFAULT_' });
      
      // Titreşim
      Vibration.vibrate([0, 300, 200, 300], true);
      
      // Engine başlat ve katıl
      (async () => {
        await initializeEngine();
        await joinChannel();
      })();
    } else {
      // ALINAN: Zil çal
      setStatusText('Gelen Arama...');
      
      // Zil sesi
      InCallManager.startRingtone('_DEFAULT_');
      
      // Titreşim
      Vibration.vibrate([0, 500, 300, 500], true);
    }

    return () => {
      log('Ekran kapatılıyor - cleanup');
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Karşı taraf kabul etti (caller için)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('✅ Karşı taraf KABUL ETTİ');
      setStatusText('Kabul edildi, bağlanıyor...');
      InCallManager.stopRingback();
      Vibration.cancel();
    }
  }, [callAccepted, mode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Arama reddedildi
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callRejected) {
      log('❌ Arama REDDEDİLDİ');
      setStatusText('Arama reddedildi');
      InCallManager.stop();
      Vibration.cancel();
      setTimeout(() => {
        cleanup();
        onClose();
      }, 1500);
    }
  }, [callRejected]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Arama sonlandı (karşı taraf kapattı)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callEnded) {
      log('📴 Karşı taraf KAPATTI');
      setStatusText('Arama sonlandı');
      setTimeout(() => {
        cleanup();
        onClose();
      }, 500);
    }
  }, [callEnded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Karşı taraf çevrimdışı
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (receiverOffline) {
      log('⚠️ Karşı taraf ÇEVRİMDIŞI');
      setStatusText('Kullanıcı çevrimdışı');
      InCallManager.stop();
      Vibration.cancel();
      setTimeout(() => {
        cleanup();
        onClose();
      }, 2000);
    }
  }, [receiverOffline]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (!visible) return null;

  const formatTime = (s: number) => 
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const showIncoming = mode === 'receiver' && !joined;
  const callActive = joined && remoteJoined;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* ARKA PLAN - Remote Video */}
        {isVideo && remoteUid > 0 && callActive && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ 
              uid: remoteUid,
              sourceType: VideoSourceType.VideoSourceRemote,
            }}
          />
        )}

        {/* PIP - Local Video */}
        {isVideo && joined && !cameraOff && (
          <View style={styles.localPip}>
            <RtcSurfaceView
              style={styles.localVideo}
              canvas={{ 
                uid: 0,
                sourceType: VideoSourceType.VideoSourceCamera,
              }}
              zOrderMediaOverlay={true}
            />
          </View>
        )}

        {/* ÜST BAR */}
        <View style={styles.topBar}>
          {/* Sol - Bağlantı durumu */}
          <View style={styles.statusBadge}>
            <View style={[styles.dot, callActive ? styles.dotGreen : joined ? styles.dotYellow : styles.dotRed]} />
            <Text style={styles.statusBadgeText}>
              {callActive ? 'Bağlı' : joined ? 'Bekleniyor' : 'Bağlanıyor'}
            </Text>
          </View>
          
          {/* Sağ - Arama tipi */}
          <View style={[styles.typeBadge, isVideo ? styles.typeBadgeVideo : styles.typeBadgeAudio]}>
            <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
            <Text style={styles.typeBadgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
          </View>
        </View>

        {/* ORTA - Avatar ve bilgiler */}
        {(!isVideo || !callActive) && (
          <View style={styles.centerContent}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
                <Text style={styles.avatarText}>
                  {remoteName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            </Animated.View>
            
            <Text style={styles.remoteName}>{remoteName}</Text>
            
            <Text style={styles.statusText}>
              {callActive ? formatTime(duration) : statusText}
            </Text>
            
            {callActive && (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                <Text style={styles.connectedText}>
                  {isVideo ? 'Video Bağlandı' : 'Ses Bağlandı'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* VIDEO MODUNDA - Üstte isim */}
        {isVideo && callActive && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoName}>{remoteName}</Text>
            <Text style={styles.videoTime}>{formatTime(duration)}</Text>
          </View>
        )}

        {/* ALT KONTROLLER */}
        <View style={styles.controls}>
          {showIncoming ? (
            // GELEN ARAMA - Kabul / Red
            <View style={styles.incomingControls}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                <Ionicons name="close" size={36} color="#fff" />
                <Text style={styles.buttonLabel}>Reddet</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.acceptButton, isVideo && styles.acceptButtonVideo]} 
                onPress={handleAccept}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={36} color="#fff" />
                <Text style={styles.buttonLabel}>Kabul</Text>
              </TouchableOpacity>
            </View>
          ) : callActive ? (
            // AKTİF GÖRÜŞME - Kontroller
            <View style={styles.activeControls}>
              <TouchableOpacity 
                style={[styles.controlButton, muted && styles.controlButtonActive]} 
                onPress={toggleMute}
              >
                <Ionicons name={muted ? "mic-off" : "mic"} size={26} color="#fff" />
              </TouchableOpacity>
              
              {isVideo && (
                <>
                  <TouchableOpacity 
                    style={[styles.controlButton, cameraOff && styles.controlButtonActive]} 
                    onPress={toggleCamera}
                  >
                    <Ionicons name={cameraOff ? "videocam-off" : "videocam"} size={26} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={26} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity style={styles.endButton} onPress={endCall}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.controlButton, speakerOn && styles.controlButtonActive]} 
                onPress={toggleSpeaker}
              >
                <Ionicons name={speakerOn ? "volume-high" : "volume-low"} size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // BAĞLANIYOR - Sadece kapat
            <View style={styles.connectingControls}>
              <TouchableOpacity style={styles.endButton} onPress={endCall}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endLabel}>Aramayı Bitir</Text>
            </View>
          )}
        </View>

        {/* DEBUG - Bağlantı bilgisi */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>CH: {channelName}</Text>
            <Text style={styles.debugText}>UID: {myUid} | Remote: {remoteUid}</Text>
            <Text style={styles.debugText}>{connectionState}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  
  // Remote Video
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Local PIP
  localPip: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#000',
    zIndex: 10,
    elevation: 10,
  },
  localVideo: {
    flex: 1,
  },
  
  // Top Bar
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: { backgroundColor: '#4CAF50' },
  dotYellow: { backgroundColor: '#FFC107' },
  dotRed: { backgroundColor: '#f44336' },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  typeBadgeAudio: { backgroundColor: '#4361ee' },
  typeBadgeVideo: { backgroundColor: '#9C27B0' },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Center Content
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarVideo: {
    backgroundColor: '#9C27B0',
  },
  avatarText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
  },
  remoteName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 16,
    textAlign: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Video Overlay
  videoOverlay: {
    position: 'absolute',
    top: 120,
    left: 20,
    zIndex: 5,
  },
  videoName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoTime: {
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  
  // Controls
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  
  // Incoming Controls
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
  },
  rejectButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonVideo: {
    backgroundColor: '#9C27B0',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  
  // Active Controls
  activeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  endButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  
  // Connecting Controls
  connectingControls: {
    alignItems: 'center',
  },
  endLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
  
  // Debug
  debugInfo: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
  },
  debugText: {
    color: '#0f0',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
