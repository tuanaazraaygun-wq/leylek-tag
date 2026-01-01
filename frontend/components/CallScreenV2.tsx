/**
 * CallScreenV2 - MINIMAL & SIMPLE v7.0
 * 
 * Basit mantık:
 * 1. Engine oluştur
 * 2. Audio/Video aç
 * 3. Kanala katıl
 * 4. Agora gerisini halleder
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
  PermissionsAndroid,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  VideoSourceType,
  RenderModeType,
  VideoMirrorModeType,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

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
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
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
  
  // Basit state'ler
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState('');

  const isVideo = callType === 'video';
  const engineRef = useRef<IRtcEngine | null>(null);
  const uidRef = useRef(Math.floor(Math.random() * 100000) + 1);
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ════════════════════════════════════════════════════════════════════════════
  // AGORA SETUP - Basit ve temiz
  // ════════════════════════════════════════════════════════════════════════════
  const setupAgora = useCallback(async () => {
    if (!agoraToken || !channelName || engineRef.current) return;
    
    console.log('🎙️ AGORA SETUP START');

    try {
      // 1. Engine oluştur
      const engine = createAgoraRtcEngine();
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      console.log('🎙️ Engine created');

      // 2. Event handlers
      engine.registerEventHandler({
        onJoinChannelSuccess: (conn, elapsed) => {
          console.log('🎙️ JOIN SUCCESS', { uid: conn.localUid, elapsed });
          setJoined(true);
        },
        onUserJoined: (conn, uid) => {
          console.log('🎙️ USER JOINED', { uid });
          setRemoteUid(uid);
        },
        onUserOffline: (conn, uid) => {
          console.log('🎙️ USER LEFT', { uid });
          setRemoteUid(null);
          endCall();
        },
        onError: (err, msg) => {
          console.log('🎙️ ERROR', { err, msg });
        },
      });

      // 3. Audio aç - BASİT
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);
      console.log('🎙️ Audio enabled');

      // 4. Video aç (gerekirse)
      if (isVideo) {
        engine.enableVideo();
        engine.startPreview();
        console.log('🎙️ Video enabled');
      }

      // 5. Kanala katıl
      engine.joinChannel(agoraToken, channelName, uidRef.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });
      console.log('🎙️ Joining channel:', channelName);

      engineRef.current = engine;

    } catch (e) {
      console.log('🎙️ SETUP ERROR:', e);
      setError('Bağlantı hatası');
    }
  }, [agoraToken, channelName, isVideo]);

  // ════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════════════════════════
  const cleanup = useCallback(async () => {
    console.log('🎙️ CLEANUP');
    if (timerRef.current) clearInterval(timerRef.current);
    Vibration.cancel();
    
    if (engineRef.current) {
      try {
        await engineRef.current.leaveChannel();
        engineRef.current.release();
      } catch (e) {}
      engineRef.current = null;
    }
  }, []);

  const endCall = useCallback(async () => {
    console.log('🎙️ END CALL');
    await cleanup();
    onEnd();
    setTimeout(onClose, 300);
  }, [cleanup, onEnd, onClose]);

  // ════════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ════════════════════════════════════════════════════════════════════════════
  
  // Arama ekranı açıldığında
  useEffect(() => {
    if (!visible || !callId) return;
    
    console.log('🎙️ CALL SCREEN OPEN', { mode, callId, isVideo });
    
    // Reset
    setJoined(false);
    setRemoteUid(null);
    setCallActive(false);
    setDuration(0);
    setError('');

    // Zil/Titreşim
    if (mode === 'caller') {
      Vibration.vibrate([0, 200, 200, 200], false);
      const interval = setInterval(() => Vibration.vibrate([0, 200, 200, 200], false), 3000);
      timerRef.current = interval;
      
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Vibration.vibrate([0, 500, 200, 500], true);
    }

    // Agora'yı başlat
    setupAgora();

    return () => {
      pulseAnim.stopAnimation();
      cleanup();
    };
  }, [visible, callId]);

  // Arama kabul edildiğinde
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      console.log('🎙️ CALL ACCEPTED');
      Vibration.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      setCallActive(true);
      
      // Süre sayacı başlat
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, [callAccepted, mode]);

  // Uzak kullanıcı katıldığında (receiver için)
  useEffect(() => {
    if (remoteUid && mode === 'receiver' && !callActive) {
      console.log('🎙️ REMOTE JOINED - CALL ACTIVE');
      Vibration.cancel();
      setCallActive(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, [remoteUid, mode, callActive]);

  // Reddedildi
  useEffect(() => {
    if (callRejected) {
      console.log('🎙️ CALL REJECTED');
      setError('Arama reddedildi');
      setTimeout(endCall, 1500);
    }
  }, [callRejected]);

  // Sonlandırıldı
  useEffect(() => {
    if (callEnded) {
      console.log('🎙️ CALL ENDED');
      endCall();
    }
  }, [callEnded]);

  // Çevrimdışı
  useEffect(() => {
    if (receiverOffline) {
      console.log('🎙️ RECEIVER OFFLINE');
      setError('Karşı taraf çevrimdışı');
      setTimeout(endCall, 1500);
    }
  }, [receiverOffline]);

  // ════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════════════════════════════
  const handleAccept = () => {
    console.log('🎙️ ACCEPT');
    Vibration.cancel();
    onAccept();
  };

  const handleReject = () => {
    console.log('🎙️ REJECT');
    Vibration.cancel();
    onReject();
    setTimeout(onClose, 300);
  };

  const toggleMute = () => {
    if (!engineRef.current) return;
    engineRef.current.muteLocalAudioStream(!muted);
    setMuted(!muted);
  };

  const toggleSpeaker = () => {
    if (!engineRef.current) return;
    engineRef.current.setEnableSpeakerphone(!speakerOn);
    setSpeakerOn(!speakerOn);
  };

  const toggleCamera = () => {
    if (!engineRef.current || !isVideo) return;
    engineRef.current.muteLocalVideoStream(!cameraOff);
    setCameraOff(!cameraOff);
  };

  const switchCamera = () => {
    if (!engineRef.current || !isVideo) return;
    engineRef.current.switchCamera();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  if (!visible) return null;

  const formatTime = (s: number) => 
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const showIncoming = mode === 'receiver' && !callActive;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video */}
        {isVideo && remoteUid && callActive && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
          />
        )}

        {/* Local Video PIP */}
        {isVideo && joined && !cameraOff && (
          <View style={styles.localPip}>
            <RtcSurfaceView
              style={{ flex: 1 }}
              canvas={{ 
                uid: 0, 
                sourceType: VideoSourceType.VideoSourceCamera,
                renderMode: RenderModeType.RenderModeHidden,
                mirrorMode: VideoMirrorModeType.VideoMirrorModeEnabled,
              }}
            />
          </View>
        )}

        {/* Badge */}
        <View style={[styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* Status */}
        <View style={styles.status}>
          <View style={[styles.dot, joined ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.statusText}>{joined ? 'Bağlı' : 'Bağlanıyor'}</Text>
        </View>

        {/* Avatar */}
        {!(isVideo && remoteUid && callActive) && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
              <Ionicons name={isVideo ? "videocam" : "person"} size={56} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* Name */}
        <Text style={styles.name}>{remoteName}</Text>

        {/* Status Text */}
        <Text style={styles.stateText}>
          {error ? error : 
           callActive ? formatTime(duration) :
           showIncoming ? 'Gelen Arama' : 'Aranıyor...'}
        </Text>

        {/* Connected Badge */}
        {callActive && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlandı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {showIncoming ? (
            // Gelen arama
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.acceptBtn, isVideo && styles.acceptVideo]} onPress={handleAccept}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callActive ? (
            // Aktif arama
            <View style={styles.activeRow}>
              <TouchableOpacity style={[styles.ctrl, muted && styles.ctrlActive]} onPress={toggleMute}>
                <Ionicons name={muted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
              
              {isVideo && (
                <>
                  <TouchableOpacity style={[styles.ctrl, cameraOff && styles.ctrlActive]} onPress={toggleCamera}>
                    <Ionicons name={cameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrl} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity style={styles.endBtn} onPress={endCall}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.ctrl, speakerOn && styles.ctrlActive]} onPress={toggleSpeaker}>
                <Ionicons name={speakerOn ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Arıyor
            <TouchableOpacity style={styles.endBtn} onPress={endCall}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  localPip: {
    position: 'absolute', top: 100, right: 16, width: 120, height: 160,
    borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff',
    backgroundColor: '#000', zIndex: 100,
  },
  badge: {
    position: 'absolute', top: 50, right: 16, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4,
  },
  badgeVideo: { backgroundColor: '#9C27B0' },
  badgeAudio: { backgroundColor: '#4361ee' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  status: {
    position: 'absolute', top: 50, left: 16, flexDirection: 'row',
    alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 12, gap: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: '#4CAF50' },
  dotRed: { backgroundColor: '#f44336' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  avatar: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#4361ee',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  avatarVideo: { backgroundColor: '#9C27B0' },
  name: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  stateText: { fontSize: 18, color: '#aaa', marginBottom: 12 },
  connectedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, gap: 6,
  },
  connectedText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  controls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  incomingRow: { flexDirection: 'row', justifyContent: 'center', gap: 60 },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  acceptBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  acceptVideo: { backgroundColor: '#9C27B0' },
  rejectBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f44336', justifyContent: 'center', alignItems: 'center' },
  endBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f44336', justifyContent: 'center', alignItems: 'center' },
  ctrl: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
