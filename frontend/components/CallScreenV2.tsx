/**
 * CallScreenV2 - Agora RTC + Socket.IO Signaling
 * 
 * BASIT VE SAĞLAM SES/GÖRÜNTÜ SİSTEMİ
 * 
 * Akış:
 * 1. Ekran açılır → Agora engine başlatılır
 * 2. Socket ile karşı tarafa sinyal gönderilir
 * 3. Her iki taraf aynı Agora kanalına katılır
 * 4. 3 saniye içinde ses/görüntü bağlantısı
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  VideoSourceType,
} from 'react-native-agora';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// AGORA CONFIG - Tokenless Mode (Test için)
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

const log = (msg: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`📞 [${timestamp}] ${msg}`, data !== undefined ? data : '');
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
  const [engineReady, setEngineReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [statusText, setStatusText] = useState('Bağlanıyor...');
  const [error, setError] = useState('');
  
  const isVideo = callType === 'video';
  const engineRef = useRef<IRtcEngine | null>(null);
  const timerRef = useRef<any>(null);
  const vibrationRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const joinAttempted = useRef(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // AGORA ENGINE SETUP
  // ═══════════════════════════════════════════════════════════════════════════
  const initEngine = useCallback(async () => {
    if (engineRef.current) {
      log('Engine zaten var, tekrar oluşturulmuyor');
      return engineRef.current;
    }

    try {
      log('Agora Engine başlatılıyor...', { appId: AGORA_APP_ID.substring(0, 8) + '...' });
      
      const engine = createAgoraRtcEngine();
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Event listeners
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          log('✅ Kanala katıldım!', { channel: connection.channelId, elapsed });
          setJoined(true);
          setStatusText('Bağlandı, karşı taraf bekleniyor...');
        },
        
        onUserJoined: (connection, uid, elapsed) => {
          log('✅ Karşı taraf katıldı!', { uid, elapsed });
          setRemoteJoined(true);
          setRemoteUid(uid);
          setStatusText('Bağlandı');
          Vibration.cancel();
          
          // Süre sayacı başlat
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
              setDuration(d => d + 1);
            }, 1000);
          }
        },
        
        onUserOffline: (connection, uid, reason) => {
          log('❌ Karşı taraf ayrıldı', { uid, reason });
          setRemoteJoined(false);
          setRemoteUid(null);
          setStatusText('Bağlantı kesildi');
        },
        
        onError: (err, msg) => {
          log('❌ Agora hatası', { err, msg });
          setError(`Hata: ${msg}`);
        },
        
        onConnectionStateChanged: (connection, state, reason) => {
          log('Bağlantı durumu değişti', { state, reason });
        },
        
        onAudioRouteChanged: (route) => {
          log('Ses yolu değişti', { route });
        },
      });

      // Audio ve Video ayarları
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      
      if (isVideo) {
        engine.enableVideo();
        engine.startPreview();
      }

      engineRef.current = engine;
      setEngineReady(true);
      log('✅ Agora Engine hazır');
      
      return engine;
    } catch (e: any) {
      log('❌ Engine init hatası', e);
      setError('Ses sistemi başlatılamadı');
      return null;
    }
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KANALA KATIL
  // ═══════════════════════════════════════════════════════════════════════════
  const joinChannel = useCallback(async () => {
    if (joinAttempted.current) {
      log('Join zaten denendi, tekrar denenmeyecek');
      return;
    }
    
    if (!engineRef.current) {
      log('Engine yok, önce init edilecek');
      await initEngine();
    }
    
    if (!engineRef.current) {
      log('Engine hala yok, join iptal');
      return;
    }
    
    joinAttempted.current = true;
    
    try {
      // UID oluştur (user_id'nin hash'i)
      const uid = Math.abs(userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100000) + 1;
      
      log('Kanala katılınıyor...', { 
        channel: channelName, 
        uid,
        token: agoraToken ? 'VAR' : 'YOK (tokenless)',
        mode 
      });
      
      setStatusText('Kanala bağlanıyor...');

      // Token varsa kullan, yoksa null (tokenless mode)
      const token = agoraToken || null;
      
      engineRef.current.joinChannel(token, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
      });
      
      log('joinChannel çağrıldı, callback bekleniyor...');
    } catch (e: any) {
      log('❌ Join hatası', e);
      setError('Kanala katılınamadı');
      joinAttempted.current = false;
    }
  }, [channelName, userId, agoraToken, isVideo, initEngine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KANALDAN AYRIL
  // ═══════════════════════════════════════════════════════════════════════════
  const leaveChannel = useCallback(async () => {
    log('Kanaldan ayrılınıyor...');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (vibrationRef.current) {
      clearInterval(vibrationRef.current);
      vibrationRef.current = null;
    }
    
    Vibration.cancel();
    
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        if (isVideo) {
          engineRef.current.stopPreview();
        }
        engineRef.current.release();
        engineRef.current = null;
      } catch (e) {
        log('Leave hatası (görmezden geliniyor)', e);
      }
    }
    
    setJoined(false);
    setRemoteJoined(false);
    setRemoteUid(null);
    setEngineReady(false);
    setDuration(0);
    joinAttempted.current = false;
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL END
  // ═══════════════════════════════════════════════════════════════════════════
  const handleEndCall = useCallback(async () => {
    log('Arama sonlandırılıyor...');
    await leaveChannel();
    onEnd();
    setTimeout(onClose, 300);
  }, [leaveChannel, onEnd, onClose]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Ana akış
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Ekran açıldığında
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('═══════════════════════════════════════════════════');
    log('ARAMA EKRANI AÇILDI', { mode, callId, channelName, callType });
    log('═══════════════════════════════════════════════════');
    
    // State'leri sıfırla
    setJoined(false);
    setRemoteJoined(false);
    setRemoteUid(null);
    setDuration(0);
    setError('');
    setMuted(false);
    setCameraOff(false);
    joinAttempted.current = false;
    
    // Pulse animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // ARAYAN: Hemen engine başlat ve kanala katıl
      setStatusText('Aranıyor...');
      Vibration.vibrate([0, 200, 200, 200], false);
      vibrationRef.current = setInterval(() => {
        Vibration.vibrate([0, 200, 200, 200], false);
      }, 3000);
      
      // Engine başlat ve katıl
      initEngine().then(() => {
        joinChannel();
      });
    } else {
      // ALINAN: Zil çal, kabul bekle
      setStatusText('Gelen Arama');
      Vibration.vibrate([0, 500, 200, 500], true);
    }

    return () => {
      log('Cleanup - ekran kapatılıyor');
      pulseAnim.stopAnimation();
    };
  }, [visible, callId, mode, channelName, callType]);

  // Aranan taraf kabul ettiğinde (caller için)
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('✅ Karşı taraf aramayı KABUL ETTİ');
      setStatusText('Kabul edildi, bağlanıyor...');
      Vibration.cancel();
      if (vibrationRef.current) {
        clearInterval(vibrationRef.current);
        vibrationRef.current = null;
      }
    }
  }, [callAccepted, mode]);

  // Arama reddedildiğinde
  useEffect(() => {
    if (callRejected) {
      log('❌ Arama reddedildi');
      setStatusText('Arama reddedildi');
      setError('Arama reddedildi');
      setTimeout(() => {
        leaveChannel().then(() => {
          onClose();
        });
      }, 1500);
    }
  }, [callRejected, leaveChannel, onClose]);

  // Arama sonlandırıldığında (karşı taraf kapattı)
  useEffect(() => {
    if (callEnded) {
      log('📴 Karşı taraf aramayı kapattı');
      setStatusText('Arama sonlandırıldı');
      setTimeout(() => {
        leaveChannel().then(() => {
          onClose();
        });
      }, 500);
    }
  }, [callEnded, leaveChannel, onClose]);

  // Karşı taraf çevrimdışı
  useEffect(() => {
    if (receiverOffline) {
      log('⚠️ Karşı taraf çevrimdışı');
      setStatusText('Kullanıcı çevrimdışı');
      setError('Karşı taraf çevrimdışı');
      setTimeout(() => {
        leaveChannel().then(() => {
          onClose();
        });
      }, 2000);
    }
  }, [receiverOffline, leaveChannel, onClose]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleAccept = useCallback(async () => {
    log('✅ Arama kabul ediliyor...');
    Vibration.cancel();
    setStatusText('Bağlanıyor...');
    
    // Socket'e kabul bildir
    onAccept();
    
    // Engine başlat ve kanala katıl
    await initEngine();
    await joinChannel();
  }, [onAccept, initEngine, joinChannel]);

  const handleReject = useCallback(() => {
    log('❌ Arama reddediliyor');
    Vibration.cancel();
    onReject();
    setTimeout(onClose, 300);
  }, [onReject, onClose]);

  const toggleMute = useCallback(() => {
    if (engineRef.current) {
      const newMuted = !muted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setMuted(newMuted);
      log(newMuted ? 'Mikrofon kapatıldı' : 'Mikrofon açıldı');
    }
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    if (engineRef.current) {
      const newSpeaker = !speakerOn;
      engineRef.current.setEnableSpeakerphone(newSpeaker);
      setSpeakerOn(newSpeaker);
      log(newSpeaker ? 'Hoparlör açıldı' : 'Hoparlör kapatıldı');
    }
  }, [speakerOn]);

  const toggleCamera = useCallback(() => {
    if (engineRef.current && isVideo) {
      const newOff = !cameraOff;
      engineRef.current.muteLocalVideoStream(newOff);
      setCameraOff(newOff);
      log(newOff ? 'Kamera kapatıldı' : 'Kamera açıldı');
    }
  }, [cameraOff, isVideo]);

  const switchCamera = useCallback(() => {
    if (engineRef.current && isVideo) {
      engineRef.current.switchCamera();
      log('Kamera değiştirildi');
    }
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (!visible) return null;

  const formatTime = (s: number) => 
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const showIncoming = mode === 'receiver' && !joined;
  const callActive = joined && remoteJoined;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video (arka plan) */}
        {isVideo && remoteUid && callActive && (
          <View style={styles.remoteVideoContainer}>
            <RtcSurfaceView
              canvas={{ uid: remoteUid, sourceType: VideoSourceType.VideoSourceRemote }}
              style={styles.remoteVideo}
            />
          </View>
        )}

        {/* Local Video (PIP) */}
        {isVideo && joined && !cameraOff && (
          <View style={styles.localPip}>
            <RtcSurfaceView
              canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Badge - Sesli/Görüntülü */}
        <View style={[styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* Bağlantı Durumu */}
        <View style={styles.status}>
          <View style={[styles.dot, callActive ? styles.dotGreen : styles.dotYellow]} />
          <Text style={styles.statusText}>
            {callActive ? 'Bağlı' : (joined ? 'Bekleniyor' : 'Bağlanıyor')}
          </Text>
        </View>

        {/* Avatar (video yoksa veya bağlanmadıysa) */}
        {(!isVideo || !callActive) && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
              <Ionicons name={isVideo ? "videocam" : "person"} size={56} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* İsim */}
        <Text style={styles.name}>{remoteName}</Text>

        {/* Durum Metni */}
        <Text style={styles.stateText}>
          {error ? error : (callActive ? formatTime(duration) : statusText)}
        </Text>

        {/* Bağlandı Badge */}
        {callActive && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Ses Bağlandı</Text>
          </View>
        )}

        {/* Kontroller */}
        <View style={styles.controls}>
          {showIncoming ? (
            // Gelen arama - Kabul/Red
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.acceptBtn, isVideo && styles.acceptVideo]} 
                onPress={handleAccept}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callActive ? (
            // Aktif arama - Kontroller
            <View style={styles.activeRow}>
              <TouchableOpacity 
                style={[styles.ctrl, muted && styles.ctrlActive]} 
                onPress={toggleMute}
              >
                <Ionicons name={muted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
              
              {isVideo && (
                <>
                  <TouchableOpacity 
                    style={[styles.ctrl, cameraOff && styles.ctrlActive]} 
                    onPress={toggleCamera}
                  >
                    <Ionicons name={cameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrl} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.ctrl, speakerOn && styles.ctrlActive]} 
                onPress={toggleSpeaker}
              >
                <Ionicons name={speakerOn ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Bağlanıyor - Sadece kapat butonu
            <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
        </View>
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
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  remoteVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  remoteVideo: {
    flex: 1,
  },
  localPip: {
    position: 'absolute', 
    top: 100, 
    right: 16, 
    width: 120, 
    height: 160,
    borderRadius: 12, 
    overflow: 'hidden', 
    borderWidth: 2, 
    borderColor: '#fff',
    backgroundColor: '#000', 
    zIndex: 100,
  },
  badge: {
    position: 'absolute', 
    top: 50, 
    right: 16, 
    flexDirection: 'row',
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 16, 
    gap: 4,
  },
  badgeVideo: { backgroundColor: '#9C27B0' },
  badgeAudio: { backgroundColor: '#4361ee' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  status: {
    position: 'absolute', 
    top: 50, 
    left: 16, 
    flexDirection: 'row',
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    paddingHorizontal: 10,
    paddingVertical: 6, 
    borderRadius: 12, 
    gap: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: '#4CAF50' },
  dotYellow: { backgroundColor: '#FFC107' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  avatar: {
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: '#4361ee',
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  avatarVideo: { backgroundColor: '#9C27B0' },
  name: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  stateText: { fontSize: 18, color: '#aaa', marginBottom: 12 },
  connectedBadge: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 16, 
    gap: 6,
  },
  connectedText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  controls: { 
    position: 'absolute', 
    bottom: 50, 
    left: 0, 
    right: 0, 
    alignItems: 'center' 
  },
  incomingRow: { flexDirection: 'row', justifyContent: 'center', gap: 60 },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  acceptBtn: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#4CAF50', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  acceptVideo: { backgroundColor: '#9C27B0' },
  rejectBtn: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#f44336', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  endBtn: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#f44336', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  ctrl: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
