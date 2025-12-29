/**
 * CallScreen - Profesyonel Sesli/Görüntülü Arama Ekranı
 * Socket.IO (Sinyal) + Agora (Ses/Video) Entegrasyonu
 * 
 * Akış:
 * 1. ARAYAN: Butona basar -> Socket.IO call_user -> Ekran açılır -> Agora'ya bağlanır
 * 2. ARANAN: Socket.IO incoming_call -> Ekran açılır -> Kabul ederse Agora'ya bağlanır
 * 3. BAĞLANTI: Her iki taraf Agora channel'a girince ses/video başlar
 * 4. KAPANIŞ: Socket.IO end_call -> Her iki taraf Agora'dan çıkar
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Vibration,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Agora imports
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'no_answer' | 'offline';

interface CallScreenProps {
  visible: boolean;
  mode: 'caller' | 'receiver';
  callId: string;
  channelName: string;
  agoraToken: string;
  userId: string;
  remoteUserId: string;
  remoteName: string;
  callType: 'audio' | 'video';
  
  // Socket.IO callbacks
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
  
  // External status updates
  callAccepted?: boolean;
  callRejected?: boolean;
  callEnded?: boolean;
  receiverOffline?: boolean;
}

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
  
  // State
  const [status, setStatus] = useState<CallStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(callType === 'video');
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  
  // Refs
  const engineRef = useRef<IRtcEngine | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isCleanedUp = useRef(false);
  const agoraJoined = useRef(false);

  // ==================== AGORA SETUP ====================
  const initAgora = useCallback(async () => {
    if (agoraJoined.current || !channelName || !agoraToken) {
      console.log('⚠️ Agora zaten başlatılmış veya eksik veri');
      return;
    }

    try {
      console.log('🎙️ Agora başlatılıyor...', { channelName, callType });
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      
      // Event listeners
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log('✅ Agora kanalına katıldı:', connection.channelId);
          agoraJoined.current = true;
        },
        onUserJoined: (connection, uid, elapsed) => {
          console.log('👤 Karşı taraf Agora\'ya katıldı:', uid);
          setRemoteJoined(true);
          setRemoteUid(uid);
          setStatus('connected');
          stopRingtone();
          startDurationTimer();
        },
        onUserOffline: (connection, uid, reason) => {
          console.log('👤 Karşı taraf Agora\'dan ayrıldı:', uid, reason);
          setRemoteJoined(false);
          setRemoteUid(null);
          handleEndCall();
        },
        onError: (err, msg) => {
          console.error('❌ Agora hatası:', err, msg);
        },
      });
      
      // Audio setup
      await engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(false);
      
      // Video setup
      if (callType === 'video') {
        await engine.enableVideo();
        await engine.startPreview();
      }
      
      // Join channel
      const uid = Math.floor(Math.random() * 100000);
      console.log('📡 Agora kanalına katılınıyor:', channelName, 'UID:', uid);
      
      await engine.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });
      
      console.log('✅ Agora kurulumu tamamlandı');
      
    } catch (error) {
      console.error('❌ Agora init hatası:', error);
    }
  }, [channelName, agoraToken, callType]);

  const leaveAgora = useCallback(async () => {
    if (!agoraJoined.current) return;
    
    try {
      console.log('🔌 Agora bağlantısı kesiliyor...');
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      }
      agoraJoined.current = false;
    } catch (error) {
      console.error('Agora leave error:', error);
    }
  }, []);

  // ==================== TIMER & RINGTONE ====================
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) return;
    durationTimerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    if (mode === 'receiver') {
      Vibration.vibrate([0, 500, 300, 500], true);
    }
  }, [mode]);

  const stopRingtone = useCallback(() => {
    Vibration.cancel();
    if (ringtoneTimeoutRef.current) {
      clearTimeout(ringtoneTimeoutRef.current);
      ringtoneTimeoutRef.current = null;
    }
  }, []);

  // ==================== CALL ACTIONS ====================
  const handleAcceptCall = useCallback(async () => {
    console.log('✅ Arama kabul ediliyor...');
    setStatus('connecting');
    stopRingtone();
    
    // Socket.IO üzerinden bildir
    onAccept();
    
    // Agora'ya bağlan
    await initAgora();
  }, [onAccept, initAgora, stopRingtone]);

  const handleRejectCall = useCallback(() => {
    console.log('❌ Arama reddediliyor...');
    setStatus('rejected');
    stopRingtone();
    
    // Socket.IO üzerinden bildir
    onReject();
    
    // Ekranı kapat
    setTimeout(() => {
      onClose();
    }, 500);
  }, [onReject, onClose, stopRingtone]);

  const handleEndCall = useCallback(async () => {
    if (isCleanedUp.current) return;
    isCleanedUp.current = true;
    
    console.log('📴 Arama sonlandırılıyor...');
    setStatus('ended');
    stopRingtone();
    stopDurationTimer();
    
    // Socket.IO üzerinden bildir
    onEnd();
    
    // Agora'dan çık
    await leaveAgora();
    
    // Ekranı kapat
    setTimeout(() => {
      onClose();
    }, 1000);
  }, [onEnd, onClose, stopRingtone, stopDurationTimer, leaveAgora]);

  // ==================== CONTROLS ====================
  const toggleMute = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.setEnableSpeakerphone(!isSpeaker);
      setIsSpeaker(!isSpeaker);
    }
  }, [isSpeaker]);

  const toggleCamera = useCallback(() => {
    if (engineRef.current && callType === 'video') {
      engineRef.current.muteLocalVideoStream(localVideoEnabled);
      setLocalVideoEnabled(!localVideoEnabled);
    }
  }, [callType, localVideoEnabled]);

  const switchCamera = useCallback(() => {
    if (engineRef.current && callType === 'video') {
      engineRef.current.switchCamera();
    }
  }, [callType]);

  // ==================== EFFECTS ====================
  
  // Ana effect - ekran açıldığında
  useEffect(() => {
    if (!visible || !callId) return;
    
    console.log(`📞 CallScreen açıldı - mode: ${mode}, callId: ${callId}`);
    isCleanedUp.current = false;
    agoraJoined.current = false;
    setDuration(0);
    setRemoteJoined(false);
    setStatus('ringing');
    
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    
    if (mode === 'caller') {
      // ARAYAN: Hemen Agora'ya bağlan
      setStatus('ringing');
      initAgora();
      
      // 45 saniye sonra cevap yoksa timeout
      ringtoneTimeoutRef.current = setTimeout(() => {
        if (status === 'ringing') {
          setStatus('no_answer');
          handleEndCall();
        }
      }, 45000);
      
    } else {
      // ARANAN: Zil çal
      setStatus('ringing');
      playRingtone();
      
      // 45 saniye sonra otomatik reddet
      ringtoneTimeoutRef.current = setTimeout(() => {
        if (status === 'ringing') {
          handleRejectCall();
        }
      }, 45000);
    }
    
    return () => {
      console.log('📞 CallScreen cleanup');
      stopRingtone();
      stopDurationTimer();
      leaveAgora();
    };
  }, [visible, callId]);

  // External status updates
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      console.log('📞 Arama kabul edildi (external)');
      setStatus('connecting');
    }
  }, [callAccepted, mode]);

  useEffect(() => {
    if (callRejected && mode === 'caller') {
      console.log('📞 Arama reddedildi (external)');
      setStatus('rejected');
      stopRingtone();
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [callRejected, mode, onClose, stopRingtone]);

  useEffect(() => {
    if (callEnded && !isCleanedUp.current) {
      console.log('📞 Arama sonlandırıldı (external)');
      handleEndCall();
    }
  }, [callEnded, handleEndCall]);

  useEffect(() => {
    if (receiverOffline && mode === 'caller') {
      console.log('📞 Alıcı çevrimdışı');
      setStatus('offline');
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [receiverOffline, mode, onClose]);

  // ==================== RENDER HELPERS ====================
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'ringing':
        return mode === 'caller' ? 'Çalıyor...' : 'Gelen Arama';
      case 'connecting':
        return 'Bağlanıyor...';
      case 'connected':
        return formatDuration(duration);
      case 'ended':
        return 'Arama Sonlandı';
      case 'rejected':
        return 'Arama Reddedildi';
      case 'no_answer':
        return 'Cevap Yok';
      case 'offline':
        return 'Kullanıcı Çevrimdışı';
      default:
        return '';
    }
  };

  if (!visible) return null;

  // ==================== RENDER ====================
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Video Background */}
        {callType === 'video' && status === 'connected' && remoteUid && (
          <View style={styles.remoteVideoContainer}>
            <RtcSurfaceView style={styles.remoteVideo} canvas={{ uid: remoteUid }} />
          </View>
        )}
        
        {/* Local Video */}
        {callType === 'video' && status === 'connected' && localVideoEnabled && (
          <View style={styles.localVideoContainer}>
            <RtcSurfaceView style={styles.localVideo} canvas={{ uid: 0 }} zOrderMediaOverlay={true} />
          </View>
        )}
        
        {/* Overlay */}
        <View style={[styles.overlay, callType === 'video' && status === 'connected' && styles.overlayTransparent]} />
        
        {/* User Info */}
        <View style={styles.userInfo}>
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Ionicons name={callType === 'video' ? 'videocam' : 'person'} size={50} color="#FFF" />
            </View>
          </Animated.View>
          
          <Text style={styles.userName}>{remoteName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          
          {callType === 'video' && (
            <View style={styles.callTypeBadge}>
              <Ionicons name="videocam" size={14} color="#FFF" />
              <Text style={styles.callTypeText}>Görüntülü Arama</Text>
            </View>
          )}
        </View>
        
        {/* Controls */}
        <View style={styles.controlsContainer}>
          {/* Connected State */}
          {status === 'connected' && (
            <View style={styles.connectedControls}>
              <View style={styles.controlRow}>
                <TouchableOpacity style={[styles.controlButton, isMuted && styles.controlButtonActive]} onPress={toggleMute}>
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFF" />
                  <Text style={styles.controlLabel}>{isMuted ? 'Sessiz' : 'Mikrofon'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.controlButton, isSpeaker && styles.controlButtonActive]} onPress={toggleSpeaker}>
                  <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={28} color="#FFF" />
                  <Text style={styles.controlLabel}>{isSpeaker ? 'Hoparlör' : 'Kulaklık'}</Text>
                </TouchableOpacity>
                
                {callType === 'video' && (
                  <>
                    <TouchableOpacity style={[styles.controlButton, !localVideoEnabled && styles.controlButtonActive]} onPress={toggleCamera}>
                      <Ionicons name={localVideoEnabled ? 'videocam' : 'videocam-off'} size={28} color="#FFF" />
                      <Text style={styles.controlLabel}>{localVideoEnabled ? 'Kamera' : 'Kapalı'}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                      <Ionicons name="camera-reverse" size={28} color="#FFF" />
                      <Text style={styles.controlLabel}>Çevir</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              
              <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Ringing - Caller */}
          {status === 'ringing' && mode === 'caller' && (
            <View style={styles.callerControls}>
              <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>İptal</Text>
            </View>
          )}
          
          {/* Ringing - Receiver */}
          {status === 'ringing' && mode === 'receiver' && (
            <View style={styles.receiverControls}>
              <View style={styles.receiverButtonRow}>
                <TouchableOpacity style={styles.rejectButton} onPress={handleRejectCall}>
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptCall}>
                  <Ionicons name="call" size={32} color="#FFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.receiverLabelRow}>
                <Text style={styles.rejectLabel}>Reddet</Text>
                <Text style={styles.acceptLabel}>Kabul Et</Text>
              </View>
            </View>
          )}
          
          {/* Connecting */}
          {status === 'connecting' && (
            <View style={styles.connectingControls}>
              <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>İptal</Text>
            </View>
          )}
          
          {/* Ended / Rejected / No Answer / Offline */}
          {['ended', 'rejected', 'no_answer', 'offline'].includes(status) && (
            <View style={styles.endedControls}>
              <View style={styles.endedIcon}>
                <Ionicons 
                  name={status === 'rejected' ? 'close-circle' : status === 'offline' ? 'cloud-offline' : 'call'} 
                  size={40} 
                  color="#EF4444" 
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },
  overlayTransparent: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  remoteVideoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  remoteVideo: {
    flex: 1,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 50,
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
  userInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  userName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  callTypeText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 6,
  },
  controlsContainer: {
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  connectedControls: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  controlButton: {
    alignItems: 'center',
    marginHorizontal: 15,
    marginVertical: 10,
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    minWidth: 70,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 6,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 8,
  },
  callerControls: {
    alignItems: 'center',
  },
  receiverControls: {
    alignItems: 'center',
  },
  receiverButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 50,
  },
  receiverLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 50,
    marginTop: 10,
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectLabel: {
    color: '#EF4444',
    fontSize: 14,
  },
  acceptLabel: {
    color: '#22C55E',
    fontSize: 14,
  },
  connectingControls: {
    alignItems: 'center',
  },
  endedControls: {
    alignItems: 'center',
  },
  endedIcon: {
    padding: 20,
  },
});
