/**
 * CallScreen - Profesyonel Sesli/Görüntülü Arama Ekranı
 * WhatsApp/Facebook tarzı basit ve çalışan arama sistemi
 * 
 * Akış:
 * 1. ARAYAN: Butona basar -> Backend'e istek -> Arama ekranı açılır -> Agora'ya bağlanır -> "Çalıyor..." gösterir
 * 2. ARANAN: Realtime ile arama gelir -> Arama ekranı açılır -> Kabul/Reddet butonları -> Kabul ederse Agora'ya bağlanır
 * 3. BAĞLANTI: Her iki taraf Agora'ya bağlanınca ses/video başlar
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Vibration,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

// Agora imports
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

interface CallScreenProps {
  visible: boolean;
  mode: 'caller' | 'receiver';  // Arayan mı, aranan mı
  callId: string;
  channelName: string;
  agoraToken: string;
  userId: string;
  remoteName: string;
  callType: 'audio' | 'video';
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  apiUrl: string;
}

type CallStatus = 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'no_answer' | 'busy';

export default function CallScreen({
  visible,
  mode,
  callId,
  channelName,
  agoraToken,
  userId,
  remoteName,
  callType,
  onClose,
  onAccept,
  onReject,
  apiUrl,
}: CallScreenProps) {
  
  // State
  const [status, setStatus] = useState<CallStatus>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(callType === 'video');
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  
  // Refs
  const engineRef = useRef<IRtcEngine | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isCleanedUp = useRef(false);
  
  // ==================== AGORA SETUP ====================
  const initAgora = async () => {
    try {
      console.log('🎙️ Agora başlatılıyor...', { channelName, callType });
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      
      // Initialize engine
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      
      // Event listeners
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log('✅ Agora kanalına katıldı:', connection.channelId);
        },
        onUserJoined: (connection, uid, elapsed) => {
          console.log('👤 Karşı taraf katıldı:', uid);
          setRemoteJoined(true);
          setRemoteUid(uid);
          setStatus('connected');
          stopRingtone();
          startDurationTimer();
        },
        onUserOffline: (connection, uid, reason) => {
          console.log('👤 Karşı taraf ayrıldı:', uid, reason);
          setRemoteJoined(false);
          setRemoteUid(null);
          endCall('ended');
        },
        onError: (err, msg) => {
          console.error('❌ Agora hatası:', err, msg);
        },
        onRemoteVideoStateChanged: (connection, uid, state, reason, elapsed) => {
          setRemoteVideoEnabled(state === 2); // 2 = Playing
        },
      });
      
      // Audio setup
      await engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(false);
      
      // Video setup (if video call)
      if (callType === 'video') {
        await engine.enableVideo();
        await engine.startPreview();
      }
      
      // Join channel
      const uid = Math.floor(Math.random() * 100000);
      console.log('📡 Kanala katılınıyor:', channelName, 'UID:', uid);
      
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
  };
  
  const leaveAgora = async () => {
    try {
      if (engineRef.current) {
        console.log('🔌 Agora bağlantısı kesiliyor...');
        await engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      }
    } catch (error) {
      console.error('Agora leave error:', error);
    }
  };
  
  // ==================== CALL MANAGEMENT ====================
  const startDurationTimer = () => {
    if (durationTimerRef.current) return;
    durationTimerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };
  
  const stopDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };
  
  const playRingtone = async () => {
    try {
      if (mode === 'receiver') {
        Vibration.vibrate([0, 500, 300, 500], true);
      }
    } catch (error) {
      console.error('Ringtone error:', error);
    }
  };
  
  const stopRingtone = () => {
    Vibration.cancel();
  };
  
  // Poll call status (for caller to know if receiver accepted/rejected)
  const pollCallStatus = async () => {
    if (!callId || status === 'connected' || status === 'ended') return;
    
    try {
      const response = await fetch(`${apiUrl}/voice/check-call-status?call_id=${callId}`);
      const data = await response.json();
      
      if (data.success && data.call) {
        const callStatus = data.call.status;
        
        if (callStatus === 'connected' && status !== 'connected') {
          console.log('📞 Arama kabul edildi!');
          setStatus('connected');
          stopRingtone();
        } else if (callStatus === 'rejected') {
          console.log('📞 Arama reddedildi');
          endCall('rejected');
        } else if (callStatus === 'ended' || callStatus === 'cancelled') {
          console.log('📞 Arama sonlandı');
          endCall('ended');
        }
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  };
  
  const endCall = async (reason: CallStatus = 'ended') => {
    if (isCleanedUp.current) return;
    isCleanedUp.current = true;
    
    console.log('📞 Arama sonlandırılıyor:', reason);
    
    setStatus(reason);
    stopRingtone();
    stopDurationTimer();
    
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    
    // Backend'e bildir
    try {
      await fetch(`${apiUrl}/voice/end-call?call_id=${callId}`, { method: 'POST' });
    } catch (error) {
      console.error('End call API error:', error);
    }
    
    await leaveAgora();
    
    // 1 saniye sonra kapat
    setTimeout(() => {
      onClose();
    }, 1000);
  };
  
  const handleAccept = async () => {
    console.log('✅ Arama kabul ediliyor...');
    setStatus('connecting');
    stopRingtone();
    
    // Backend'e bildir
    try {
      const response = await fetch(`${apiUrl}/voice/accept-call?call_id=${callId}`, { 
        method: 'POST' 
      });
      const data = await response.json();
      console.log('Accept response:', data);
    } catch (error) {
      console.error('Accept API error:', error);
    }
    
    // Agora'ya bağlan
    await initAgora();
    
    if (onAccept) onAccept();
  };
  
  const handleReject = async () => {
    console.log('❌ Arama reddediliyor...');
    stopRingtone();
    
    // Backend'e bildir
    try {
      await fetch(`${apiUrl}/voice/reject-call?call_id=${callId}`, { method: 'POST' });
    } catch (error) {
      console.error('Reject API error:', error);
    }
    
    if (onReject) onReject();
    onClose();
  };
  
  const toggleMute = () => {
    if (engineRef.current) {
      engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  };
  
  const toggleSpeaker = () => {
    if (engineRef.current) {
      engineRef.current.setEnableSpeakerphone(!isSpeaker);
      setIsSpeaker(!isSpeaker);
    }
  };
  
  const toggleCamera = () => {
    if (engineRef.current && callType === 'video') {
      engineRef.current.muteLocalVideoStream(localVideoEnabled);
      setLocalVideoEnabled(!localVideoEnabled);
    }
  };
  
  const switchCamera = () => {
    if (engineRef.current && callType === 'video') {
      engineRef.current.switchCamera();
    }
  };
  
  // ==================== EFFECTS ====================
  useEffect(() => {
    if (!visible || !callId || !channelName) return;
    
    console.log(`📞 CallScreen açıldı - mode: ${mode}, callId: ${callId}, channel: ${channelName}`);
    isCleanedUp.current = false;
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
      // ARAYAN: Hemen Agora'ya bağlan ve karşı tarafı bekle
      setStatus('ringing');
      initAgora();
      
      // Durum kontrolü başlat
      pollTimerRef.current = setInterval(pollCallStatus, 1000);
      
      // 45 saniye sonra cevap yoksa kapat
      setTimeout(() => {
        if (status === 'ringing') {
          endCall('no_answer');
        }
      }, 45000);
      
    } else {
      // ARANAN: Zil çal, bekle
      setStatus('ringing');
      playRingtone();
    }
    
    return () => {
      console.log('📞 CallScreen cleanup');
      stopRingtone();
      stopDurationTimer();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      leaveAgora();
    };
  }, [visible, callId, channelName]);
  
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
      case 'busy':
        return 'Meşgul';
      default:
        return '';
    }
  };
  
  if (!visible) return null;
  
  // ==================== RENDER ====================
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Video Background (for video calls) */}
        {callType === 'video' && status === 'connected' && remoteUid && (
          <View style={styles.remoteVideoContainer}>
            <RtcSurfaceView
              style={styles.remoteVideo}
              canvas={{ uid: remoteUid }}
            />
          </View>
        )}
        
        {/* Local Video (small, corner) */}
        {callType === 'video' && status === 'connected' && localVideoEnabled && (
          <View style={styles.localVideoContainer}>
            <RtcSurfaceView
              style={styles.localVideo}
              canvas={{ uid: 0 }}
              zOrderMediaOverlay={true}
            />
          </View>
        )}
        
        {/* Gradient Overlay */}
        <View style={[styles.overlay, callType === 'video' && status === 'connected' && styles.overlayTransparent]} />
        
        {/* User Info */}
        <View style={styles.userInfo}>
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Ionicons 
                name={callType === 'video' ? 'videocam' : 'person'} 
                size={50} 
                color="#FFF" 
              />
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
          {/* Connected State Controls */}
          {status === 'connected' && (
            <View style={styles.connectedControls}>
              {/* Top Row */}
              <View style={styles.controlRow}>
                <TouchableOpacity 
                  style={[styles.controlButton, isMuted && styles.controlButtonActive]} 
                  onPress={toggleMute}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFF" />
                  <Text style={styles.controlLabel}>{isMuted ? 'Sessiz' : 'Mikrofon'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.controlButton, isSpeaker && styles.controlButtonActive]} 
                  onPress={toggleSpeaker}
                >
                  <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={28} color="#FFF" />
                  <Text style={styles.controlLabel}>{isSpeaker ? 'Hoparlör' : 'Kulaklık'}</Text>
                </TouchableOpacity>
                
                {callType === 'video' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.controlButton, !localVideoEnabled && styles.controlButtonActive]} 
                      onPress={toggleCamera}
                    >
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
              
              {/* End Call Button */}
              <TouchableOpacity 
                style={styles.endCallButton} 
                onPress={() => endCall('ended')}
              >
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Ringing State - Caller */}
          {status === 'ringing' && mode === 'caller' && (
            <View style={styles.callerControls}>
              <TouchableOpacity 
                style={styles.endCallButton} 
                onPress={() => endCall('ended')}
              >
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>İptal</Text>
            </View>
          )}
          
          {/* Ringing State - Receiver */}
          {status === 'ringing' && mode === 'receiver' && (
            <View style={styles.receiverControls}>
              <View style={styles.receiverButtonRow}>
                <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                  <Ionicons name="call" size={32} color="#FFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.receiverLabelRow}>
                <Text style={styles.rejectLabel}>Reddet</Text>
                <Text style={styles.acceptLabel}>Kabul Et</Text>
              </View>
            </View>
          )}
          
          {/* Connecting State */}
          {status === 'connecting' && (
            <View style={styles.connectingControls}>
              <TouchableOpacity 
                style={styles.endCallButton} 
                onPress={() => endCall('ended')}
              >
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>İptal</Text>
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
});
