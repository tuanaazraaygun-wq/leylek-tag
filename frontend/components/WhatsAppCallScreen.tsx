/**
 * WhatsApp Benzeri Custom Arama Ekranı
 * Daily.co SDK ile tam kontrol
 * 
 * Özellikler:
 * - Daily default UI tamamen gizli
 * - Özel kontrol butonları
 * - Self-view (küçük kamera önizlemesi)
 * - Sesli ↔ Görüntülü geçiş
 * - Türkçe arayüz
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  BackHandler,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Daily, {
  DailyCall,
  DailyEvent,
  DailyParticipant,
  DailyMediaStreamTrack,
} from '@daily-co/react-native-daily-js';
import { RTCView, MediaStream } from '@daily-co/react-native-webrtc';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WhatsAppCallScreenProps {
  roomUrl: string;
  roomName: string;
  callType: 'video' | 'audio';
  otherUserName: string;
  onCallEnd: (roomName: string) => void;
  currentUserId?: string;
}

type CallStatus = 'connecting' | 'connected' | 'reconnecting' | 'ended';

export default function WhatsAppCallScreen({
  roomUrl,
  roomName,
  callType,
  otherUserName,
  onCallEnd,
  currentUserId,
}: WhatsAppCallScreenProps) {
  // Daily.co call instance
  const callRef = useRef<DailyCall | null>(null);
  
  // Call state
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  
  // Participant streams
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStream | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStream | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<DailyParticipant | null>(null);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showVideoRequest, setShowVideoRequest] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Max call duration (10 minutes)
  const maxDuration = 600;

  // Initialize Daily.co call
  useEffect(() => {
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, []);

  // Start timer when connected
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            handleEndCall(true);
          }
          return newDuration;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall(false);
      return true;
    });
    return () => backHandler.remove();
  }, []);

  // Auto-hide controls after 5 seconds (only in video mode)
  useEffect(() => {
    if (isVideoEnabled && status === 'connected') {
      const timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isVideoEnabled, status, showControls]);

  const initializeCall = async () => {
    try {
      console.log('📞 Daily.co bağlantısı başlatılıyor...');
      
      // Create Daily call instance
      const call = Daily.createCallObject({
        videoSource: isVideoEnabled,
        audioSource: true,
      });
      
      callRef.current = call;

      // Event listeners
      call.on('joining-meeting', () => {
        console.log('📞 Odaya katılınıyor...');
        setStatus('connecting');
      });

      call.on('joined-meeting', (event) => {
        console.log('✅ Odaya katıldı:', event);
        setStatus('connected');
        updateLocalTracks(call);
      });

      call.on('participant-joined', (event) => {
        console.log('👤 Katılımcı katıldı:', event?.participant?.user_id);
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(event.participant);
          updateRemoteTracks(event.participant);
        }
      });

      call.on('participant-updated', (event) => {
        if (event?.participant) {
          if (event.participant.local) {
            updateLocalTracks(call);
          } else {
            setRemoteParticipant(event.participant);
            updateRemoteTracks(event.participant);
          }
        }
      });

      call.on('participant-left', (event) => {
        console.log('👤 Katılımcı ayrıldı:', event?.participant?.user_id);
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(null);
          setRemoteVideoTrack(null);
          // Other participant left - end call
          handleEndCall(true);
        }
      });

      call.on('error', (event) => {
        console.error('❌ Daily.co hatası:', event);
        Alert.alert('Bağlantı Hatası', 'Arama bağlantısı kurulamadı');
        handleEndCall(true);
      });

      call.on('left-meeting', () => {
        console.log('📞 Odadan ayrıldı');
        setStatus('ended');
      });

      // Join the room
      await call.join({
        url: roomUrl,
        videoSource: isVideoEnabled,
        audioSource: true,
      });

    } catch (error) {
      console.error('❌ Daily.co başlatma hatası:', error);
      Alert.alert('Hata', 'Arama başlatılamadı');
      onCallEnd(roomName);
    }
  };

  const updateLocalTracks = (call: DailyCall) => {
    const localParticipant = call.participants()?.local;
    if (localParticipant?.tracks?.video?.persistentTrack) {
      const stream = new MediaStream([localParticipant.tracks.video.persistentTrack]);
      setLocalVideoTrack(stream);
    }
  };

  const updateRemoteTracks = (participant: DailyParticipant) => {
    if (participant?.tracks?.video?.persistentTrack) {
      const stream = new MediaStream([participant.tracks.video.persistentTrack]);
      setRemoteVideoTrack(stream);
    }
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (callRef.current) {
      callRef.current.leave();
      callRef.current.destroy();
      callRef.current = null;
    }
  };

  const handleEndCall = (auto: boolean = false) => {
    if (auto) {
      cleanup();
      onCallEnd(roomName);
      return;
    }

    Alert.alert(
      'Aramayı Bitir',
      'Aramayı sonlandırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Bitir', 
          style: 'destructive',
          onPress: () => {
            cleanup();
            onCallEnd(roomName);
          }
        },
      ]
    );
  };

  // Toggle video
  const toggleVideo = async () => {
    if (callRef.current) {
      const newState = !isVideoEnabled;
      await callRef.current.setLocalVideo(newState);
      setIsVideoEnabled(newState);
    }
  };

  // Toggle audio
  const toggleAudio = async () => {
    if (callRef.current) {
      const newState = !isAudioEnabled;
      await callRef.current.setLocalAudio(newState);
      setIsAudioEnabled(newState);
    }
  };

  // Toggle speaker
  const toggleSpeaker = () => {
    // Note: Speaker toggle might need native implementation
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    if (callRef.current) {
      await callRef.current.cycleCamera();
      setIsFrontCamera(!isFrontCamera);
    }
  };

  // Request video upgrade (sesli → görüntülü)
  const requestVideoUpgrade = () => {
    // TODO: Socket ile karşı tarafa video isteği gönder
    Alert.alert(
      'Görüntülü Arama',
      'Görüntülü aramaya geçmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Evet', 
          onPress: async () => {
            await toggleVideo();
          }
        },
      ]
    );
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show controls on tap
  const handleScreenTap = () => {
    if (!showControls) {
      setShowControls(true);
      fadeAnim.setValue(1);
    }
  };

  // Status text
  const getStatusText = () => {
    switch (status) {
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return remoteParticipant ? 'Bağlandı' : 'Bekleniyor...';
      case 'reconnecting': return 'Yeniden bağlanıyor...';
      case 'ended': return 'Arama bitti';
      default: return '';
    }
  };

  // Remaining time warning
  const remainingTime = maxDuration - callDuration;
  const showWarning = remainingTime <= 60 && remainingTime > 0;

  // Is video call active (either side has video)
  const hasRemoteVideo = remoteParticipant?.tracks?.video?.state === 'playable';
  const hasLocalVideo = isVideoEnabled;
  const isVideoCall = hasRemoteVideo || hasLocalVideo;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <TouchableOpacity 
        style={styles.mainArea} 
        activeOpacity={1} 
        onPress={handleScreenTap}
      >
        {/* Remote Video (Full Screen) */}
        {hasRemoteVideo && remoteVideoTrack ? (
          <RTCView
            streamURL={remoteVideoTrack.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          // Avatar when no video
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {otherUserName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          </View>
        )}

        {/* Self View (Picture-in-Picture) */}
        {hasLocalVideo && localVideoTrack && (
          <View style={styles.selfViewContainer}>
            <RTCView
              streamURL={localVideoTrack.toURL()}
              style={styles.selfView}
              objectFit="cover"
              mirror={isFrontCamera}
            />
            <TouchableOpacity style={styles.switchCameraBtn} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Header - Always visible */}
        <Animated.View style={[styles.header, { opacity: showControls ? 1 : fadeAnim }]}>
          <View style={styles.headerContent}>
            <Text style={styles.callerName}>{otherUserName}</Text>
            <Text style={styles.statusText}>{getStatusText()}</Text>
            {status === 'connected' && (
              <View style={styles.durationContainer}>
                <Text style={[styles.duration, showWarning && styles.durationWarning]}>
                  {formatDuration(callDuration)}
                </Text>
                {showWarning && (
                  <Text style={styles.warningText}>Son 1 dakika!</Text>
                )}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Controls - Bottom */}
        <Animated.View style={[styles.controlsContainer, { opacity: showControls ? 1 : fadeAnim }]}>
          {/* Video upgrade button (only in audio call) */}
          {!isVideoCall && status === 'connected' && (
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={requestVideoUpgrade}
            >
              <Ionicons name="videocam" size={20} color="#FFF" />
              <Text style={styles.upgradeText}>Görüntülüye Geç</Text>
            </TouchableOpacity>
          )}

          <View style={styles.controlsRow}>
            {/* Camera Toggle */}
            <TouchableOpacity 
              style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
              onPress={toggleVideo}
            >
              <Ionicons 
                name={isVideoEnabled ? 'videocam' : 'videocam-off'} 
                size={28} 
                color="#FFF" 
              />
              <Text style={styles.controlLabel}>
                {isVideoEnabled ? 'Kamera' : 'Kamera Kapalı'}
              </Text>
            </TouchableOpacity>

            {/* Microphone Toggle */}
            <TouchableOpacity 
              style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
              onPress={toggleAudio}
            >
              <Ionicons 
                name={isAudioEnabled ? 'mic' : 'mic-off'} 
                size={28} 
                color="#FFF" 
              />
              <Text style={styles.controlLabel}>
                {isAudioEnabled ? 'Mikrofon' : 'Sessiz'}
              </Text>
            </TouchableOpacity>

            {/* Speaker Toggle */}
            <TouchableOpacity 
              style={[styles.controlButton, !isSpeakerOn && styles.controlButtonOff]}
              onPress={toggleSpeaker}
            >
              <Ionicons 
                name={isSpeakerOn ? 'volume-high' : 'volume-mute'} 
                size={28} 
                color="#FFF" 
              />
              <Text style={styles.controlLabel}>
                {isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}
              </Text>
            </TouchableOpacity>

            {/* End Call */}
            <TouchableOpacity 
              style={styles.endCallButton}
              onPress={() => handleEndCall(false)}
            >
              <Ionicons 
                name="call" 
                size={32} 
                color="#FFF" 
                style={{ transform: [{ rotate: '135deg' }] }}
              />
              <Text style={styles.endCallLabel}>Bitir</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  mainArea: {
    flex: 1,
  },
  // Remote Video
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  // Avatar (no video)
  avatarContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Self View (PiP)
  selfViewContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  selfView: {
    flex: 1,
  },
  switchCameraBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    background: 'transparent',
  },
  headerContent: {
    alignItems: 'center',
  },
  callerName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusText: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durationContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  duration: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durationWarning: {
    color: '#FF9500',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
  },
  // Controls
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingHorizontal: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63, 169, 245, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 20,
    alignSelf: 'center',
  },
  upgradeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,59,48,0.3)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  endCallButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
