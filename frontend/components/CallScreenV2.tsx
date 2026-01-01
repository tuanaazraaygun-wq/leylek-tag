/**
 * CallScreenV2 - Agora RTC Sesli/Görüntülü Arama
 * 
 * DÜZELTMELER:
 * - State phase yönetimi eklendi (incoming → connecting → active)
 * - Agora initialization sırası düzeltildi
 * - UI state conflicts çözüldü
 * - Remote video render düzeltildi
 * - TOKEN SUPPORT: Backend'den token alınıyor
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
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// AGORA CONFIG
const AGORA_APP_ID = '86eb50030f954355bc57696d45b343bd';

// Backend URL
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'https://rideshare-rtc.preview.emergentagent.com';

// CALL PHASES - Arama aşamaları
type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'ended';

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

// Logger
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
  // STATE - Phase-based state management
  // ═══════════════════════════════════════════════════════════════════════════
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [remoteUid, setRemoteUid] = useState<number>(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [token, setToken] = useState<string>('');
  
  const isVideo = callType === 'video';
  const engineRef = useRef<IRtcEngine | null>(null);
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const initialized = useRef(false);
  const joinedChannel = useRef(false);

  // UID oluştur
  const getUid = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 1000000) + 1;
  };

  const myUid = getUid(userId);

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN AL - Backend'den Agora token al
  // ═══════════════════════════════════════════════════════════════════════════
  const fetchToken = async (channel: string, uid: number): Promise<string> => {
    try {
      log('🎫 Token alınıyor...', { channel, uid });
      const url = `${BACKEND_URL}/api/agora/token?channel_name=${encodeURIComponent(channel)}&uid=${uid}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.token) {
        log('✅ Token alındı', { tokenLength: data.token.length });
        return data.token;
      } else {
        log('❌ Token alınamadı', data);
        return '';
      }
    } catch (error) {
      log('❌ Token fetch hatası', error);
      return '';
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // İZİN KONTROLÜ
  // ═══════════════════════════════════════════════════════════════════════════
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ];
      
      if (isVideo) {
        permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }

      const results = await PermissionsAndroid.requestMultiple(permissions);
      const audioOk = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
      const cameraOk = !isVideo || results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';
      
      log('İzinler', { audio: audioOk, camera: cameraOk });
      
      if (!audioOk) {
        Alert.alert('İzin Gerekli', 'Arama için mikrofon izni gereklidir.');
        return false;
      }
      
      return true;
    } catch (error) {
      log('İzin hatası', error);
      return false;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AGORA ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  const setupEngine = useCallback(async (): Promise<boolean> => {
    if (initialized.current && engineRef.current) {
      log('Engine zaten hazır');
      return true;
    }

    try {
      log('Engine başlatılıyor...');
      
      const engine = createAgoraRtcEngine();
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Event Handler
      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
          log('✅ KANALA KATILDIM', { channel: connection.channelId, uid: connection.localUid });
          joinedChannel.current = true;
          setStatusText('Bağlandı, karşı taraf bekleniyor...');
        },
        
        onUserJoined: (connection: RtcConnection, uid: number, elapsed: number) => {
          log('✅ KARŞI TARAF KATILDI', { uid });
          setRemoteUid(uid);
          setPhase('active');
          setStatusText('Görüşme başladı');
          
          // Ses yönetimi
          InCallManager.stopRingtone();
          InCallManager.stop();
          InCallManager.start({ media: 'audio' });
          InCallManager.setForceSpeakerphoneOn(true);
          Vibration.cancel();
          
          // Süre sayacı
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
            setStatusText('Bağlantı kesildi');
            setPhase('ended');
          }
        },
        
        onError: (err: number, msg: string) => {
          log('❌ AGORA HATA', { err, msg });
        },
        
        onFirstRemoteAudioFrame: (connection: RtcConnection, uid: number, elapsed: number) => {
          log('✅ SES GELİYOR', { uid });
        },
        
        onFirstRemoteVideoFrame: (connection: RtcConnection, uid: number, width: number, height: number, elapsed: number) => {
          log('✅ VIDEO GELİYOR', { uid, width, height });
        },
      };

      engine.registerEventHandler(handler);

      // Audio ayarları
      engine.enableAudio();
      engine.setAudioProfile(0, 1);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400);
      engine.adjustPlaybackSignalVolume(400);
      
      // Video ayarları
      if (isVideo) {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.startPreview();
      }

      engineRef.current = engine;
      initialized.current = true;
      log('✅ Engine hazır');
      return true;
    } catch (error) {
      log('❌ Engine hatası', error);
      return false;
    }
  }, [isVideo, remoteUid]);

  // ═══════════════════════════════════════════════════════════════════════════
  // KANALA KATIL - Token ile
  // ═══════════════════════════════════════════════════════════════════════════
  const joinChannel = useCallback(async () => {
    if (!engineRef.current) {
      log('Engine yok!');
      return;
    }

    if (joinedChannel.current) {
      log('Zaten kanalda');
      return;
    }

    try {
      setStatusText('Token alınıyor...');
      
      // Backend'den token al
      const fetchedToken = await fetchToken(channelName, myUid);
      if (!fetchedToken) {
        log('❌ Token alınamadı!');
        setStatusText('Token hatası');
        return;
      }
      
      setToken(fetchedToken);
      
      log('🔗 KANALA KATILINIYOR', { channel: channelName, uid: myUid, tokenLength: fetchedToken.length });
      setStatusText('Kanala bağlanıyor...');

      engineRef.current.joinChannel(
        fetchedToken,
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
    } catch (error) {
      log('❌ Join hatası', error);
      setStatusText('Bağlantı hatası');
    }
  }, [channelName, myUid, isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARAMAYA BAŞLA (Caller için)
  // ═══════════════════════════════════════════════════════════════════════════
  const startCall = useCallback(async () => {
    log('📞 ARAMA BAŞLATILIYOR (Caller)');
    
    setPhase('outgoing');
    setStatusText('Aranıyor...');
    
    // Arama sesi
    InCallManager.start({ media: 'audio', ringback: '_DEFAULT_' });
    Vibration.vibrate([0, 300, 200, 300], true);
    
    // İzinler
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setPhase('ended');
      return;
    }
    
    // Engine başlat
    const engineOk = await setupEngine();
    if (!engineOk) {
      setPhase('ended');
      return;
    }
    
    // Kanala katıl
    await joinChannel();
  }, [requestPermissions, setupEngine, joinChannel]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARAMAYI KABUL ET (Receiver için)
  // ═══════════════════════════════════════════════════════════════════════════
  const acceptCall = useCallback(async () => {
    log('✅ ARAMA KABUL EDİLİYOR (Receiver)');
    
    // Önce phase'i değiştir - UI hemen güncellenir
    setPhase('connecting');
    setStatusText('Bağlanıyor...');
    
    // Zil ve titreşimi durdur
    Vibration.cancel();
    InCallManager.stopRingtone();
    
    // Socket'e kabul bildir
    onAccept();
    
    // İzinler
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setPhase('ended');
      return;
    }
    
    // Engine başlat
    const engineOk = await setupEngine();
    if (!engineOk) {
      setPhase('ended');
      return;
    }
    
    // Kanala katıl
    await joinChannel();
  }, [onAccept, requestPermissions, setupEngine, joinChannel]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARAMAYI REDDET
  // ═══════════════════════════════════════════════════════════════════════════
  const rejectCall = useCallback(() => {
    log('❌ ARAMA REDDEDİLİYOR');
    Vibration.cancel();
    InCallManager.stopRingtone();
    setPhase('ended');
    onReject();
    setTimeout(onClose, 300);
  }, [onReject, onClose]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARAMAYI BİTİR
  // ═══════════════════════════════════════════════════════════════════════════
  const endCall = useCallback(() => {
    log('📴 ARAMA BİTİRİLİYOR');
    
    // Timer'ı durdur
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Ses yönetimini durdur
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
        log('Cleanup hatası', e);
      }
      engineRef.current = null;
    }
    
    // State reset
    initialized.current = false;
    joinedChannel.current = false;
    setPhase('ended');
    
    onEnd();
    setTimeout(onClose, 300);
  }, [isVideo, onEnd, onClose]);

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
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Ekran açıldığında
  useEffect(() => {
    if (!visible || !callId) return;

    log('═══════════════════════════════════════════════════════════');
    log('ARAMA EKRANI AÇILDI', { mode, callId, channelName, callType });
    log('═══════════════════════════════════════════════════════════');

    // State'leri sıfırla
    setRemoteUid(0);
    setDuration(0);
    setMuted(false);
    setCameraOff(false);
    setSpeakerOn(true);
    initialized.current = false;
    joinedChannel.current = false;

    // Pulse animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // ARAYAN - Hemen başlat
      startCall();
    } else {
      // ALINAN - Zil çal, bekle
      setPhase('incoming');
      setStatusText('Gelen Arama');
      InCallManager.startRingtone('_DEFAULT_');
      Vibration.vibrate([0, 500, 300, 500], true);
    }

    return () => {
      pulseAnim.stopAnimation();
    };
  }, [visible, callId, mode]);

  // Karşı taraf kabul etti (caller için)
  useEffect(() => {
    if (callAccepted && mode === 'caller' && phase === 'outgoing') {
      log('✅ Karşı taraf KABUL ETTİ');
      setPhase('connecting');
      setStatusText('Kabul edildi, bağlanıyor...');
      InCallManager.stop();
      Vibration.cancel();
    }
  }, [callAccepted, mode, phase]);

  // Arama reddedildi
  useEffect(() => {
    if (callRejected && phase !== 'ended') {
      log('❌ Arama REDDEDİLDİ');
      setStatusText('Arama reddedildi');
      setPhase('ended');
      InCallManager.stop();
      Vibration.cancel();
      setTimeout(() => {
        endCall();
      }, 1500);
    }
  }, [callRejected, phase]);

  // Karşı taraf kapattı
  useEffect(() => {
    if (callEnded && phase !== 'ended') {
      log('📴 Karşı taraf KAPATTI');
      setStatusText('Arama sonlandı');
      setPhase('ended');
      setTimeout(() => {
        endCall();
      }, 500);
    }
  }, [callEnded, phase]);

  // Karşı taraf çevrimdışı
  useEffect(() => {
    if (receiverOffline && phase !== 'ended') {
      log('⚠️ Karşı taraf ÇEVRİMDIŞI');
      setStatusText('Kullanıcı çevrimdışı');
      setPhase('ended');
      InCallManager.stop();
      Vibration.cancel();
      setTimeout(() => {
        endCall();
      }, 2000);
    }
  }, [receiverOffline, phase]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (!visible) return null;

  const formatTime = (s: number) => 
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Phase'e göre UI
  const showIncomingUI = phase === 'incoming';
  const showConnectingUI = phase === 'outgoing' || phase === 'connecting';
  const showActiveUI = phase === 'active';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* ARKA PLAN - Remote Video */}
        {isVideo && remoteUid > 0 && showActiveUI && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ 
              uid: remoteUid,
              sourceType: VideoSourceType.VideoSourceRemote,
            }}
          />
        )}

        {/* PIP - Local Video */}
        {isVideo && (phase === 'connecting' || showActiveUI) && !cameraOff && (
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
          <View style={styles.statusBadge}>
            <View style={[
              styles.dot, 
              showActiveUI ? styles.dotGreen : 
              showConnectingUI ? styles.dotYellow : 
              styles.dotRed
            ]} />
            <Text style={styles.statusBadgeText}>
              {showActiveUI ? 'Bağlı' : showConnectingUI ? 'Bağlanıyor' : 'Gelen'}
            </Text>
          </View>
          
          <View style={[styles.typeBadge, isVideo ? styles.typeBadgeVideo : styles.typeBadgeAudio]}>
            <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
            <Text style={styles.typeBadgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
          </View>
        </View>

        {/* ORTA - Avatar ve bilgiler */}
        {(!isVideo || !showActiveUI || remoteUid === 0) && (
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
              {showActiveUI ? formatTime(duration) : statusText}
            </Text>
            
            {showActiveUI && (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                <Text style={styles.connectedText}>
                  {isVideo ? 'Video Bağlandı' : 'Ses Bağlandı'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* VIDEO MODUNDA - Overlay */}
        {isVideo && showActiveUI && remoteUid > 0 && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoName}>{remoteName}</Text>
            <Text style={styles.videoTime}>{formatTime(duration)}</Text>
          </View>
        )}

        {/* ALT KONTROLLER */}
        <View style={styles.controls}>
          
          {/* GELEN ARAMA - Kabul / Red */}
          {showIncomingUI && (
            <View style={styles.incomingControls}>
              <TouchableOpacity style={styles.rejectButton} onPress={rejectCall}>
                <Ionicons name="close" size={36} color="#fff" />
                <Text style={styles.buttonLabel}>Reddet</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.acceptButton, isVideo && styles.acceptButtonVideo]} 
                onPress={acceptCall}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={36} color="#fff" />
                <Text style={styles.buttonLabel}>Kabul</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* BAĞLANIYOR - Sadece kapat */}
          {showConnectingUI && (
            <View style={styles.connectingControls}>
              <TouchableOpacity style={styles.endButton} onPress={endCall}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endLabel}>Aramayı Bitir</Text>
            </View>
          )}
          
          {/* AKTİF GÖRÜŞME - Kontroller */}
          {showActiveUI && (
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
          )}
        </View>

        {/* DEBUG INFO */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Phase: {phase}</Text>
            <Text style={styles.debugText}>CH: {channelName}</Text>
            <Text style={styles.debugText}>UID: {myUid} | Remote: {remoteUid}</Text>
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
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
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
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
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
  connectingControls: {
    alignItems: 'center',
  },
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
  endLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
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
