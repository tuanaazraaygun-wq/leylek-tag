/**
 * CallScreenV2 - WebRTC + Socket.IO
 * 
 * Agora YOK - Kendi sunucumuz ile peer-to-peer bağlantı
 * 
 * Akış:
 * 1. Caller: createOffer → socket emit
 * 2. Callee: receive offer → createAnswer → socket emit
 * 3. ICE candidates exchange via socket
 * 4. P2P connection established → Audio/Video flows
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
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  RTCView,
  MediaStream,
} from 'react-native-webrtc';
import { useSocket } from '../hooks/useSocket';

// Google STUN sunucuları (ücretsiz)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface CallScreenProps {
  visible: boolean;
  mode: 'caller' | 'receiver';
  callId: string;
  channelName: string;
  agoraToken: string; // Kullanılmayacak ama prop olarak kalacak
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
  console.log(`📞 WebRTC: ${msg}`, data || '');
};

export default function CallScreen({
  visible,
  mode,
  callId,
  channelName,
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
  
  const { socket } = useSocket();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState('');

  const isVideo = callType === 'video';
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);

  // ════════════════════════════════════════════════════════════════════════════
  // MEDIA STREAM
  // ════════════════════════════════════════════════════════════════════════════
  const getMediaStream = useCallback(async () => {
    try {
      log('Getting media stream...', { isVideo });
      
      const constraints: any = {
        audio: true,
        video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      log('Media stream obtained', { 
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length 
      });
      
      return stream;
    } catch (e) {
      log('Media stream error', e);
      throw e;
    }
  }, [isVideo]);

  // ════════════════════════════════════════════════════════════════════════════
  // PEER CONNECTION SETUP
  // ════════════════════════════════════════════════════════════════════════════
  const createPeerConnection = useCallback((stream: MediaStream) => {
    log('Creating peer connection...');
    
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Local stream ekle
    stream.getTracks().forEach(track => {
      log('Adding track to PC', { kind: track.kind });
      pc.addTrack(track, stream);
    });

    // Remote stream al
    pc.ontrack = (event) => {
      log('Received remote track', { kind: event.track.kind });
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setConnected(true);
        setCallActive(true);
        
        // Süre sayacı başlat
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
      }
    };

    // ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log('Sending ICE candidate');
        socket?.emit('webrtc_ice_candidate', {
          callId,
          candidate: event.candidate,
          to: remoteUserId,
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnected(true);
        setCallActive(true);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Bağlantı kesildi');
      }
    };

    pc.oniceconnectionstatechange = () => {
      log('ICE state:', pc.iceConnectionState);
    };

    return pc;
  }, [socket, callId, remoteUserId]);

  // ════════════════════════════════════════════════════════════════════════════
  // CALLER: Create and send offer
  // ════════════════════════════════════════════════════════════════════════════
  const startCall = useCallback(async () => {
    try {
      log('Starting call as CALLER...');
      
      const stream = await getMediaStream();
      setLocalStream(stream);
      
      const pc = createPeerConnection(stream);
      pcRef.current = pc;

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      
      await pc.setLocalDescription(offer);
      log('Offer created and set');

      // Send offer via socket
      socket?.emit('webrtc_offer', {
        callId,
        offer: offer,
        to: remoteUserId,
        from: userId,
        callType,
      });
      log('Offer sent via socket');

    } catch (e) {
      log('Start call error', e);
      setError('Arama başlatılamadı');
    }
  }, [getMediaStream, createPeerConnection, socket, callId, remoteUserId, userId, callType, isVideo]);

  // ════════════════════════════════════════════════════════════════════════════
  // CALLEE: Receive offer and send answer
  // ════════════════════════════════════════════════════════════════════════════
  const handleOffer = useCallback(async (offer: RTCSessionDescription) => {
    try {
      log('Handling offer as CALLEE...');
      
      const stream = await getMediaStream();
      setLocalStream(stream);
      
      const pc = createPeerConnection(stream);
      pcRef.current = pc;

      // Set remote description (offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      log('Remote description set');

      // Process queued ICE candidates
      for (const candidate of iceCandidatesQueue.current) {
        await pc.addIceCandidate(candidate);
      }
      iceCandidatesQueue.current = [];

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      log('Answer created and set');

      // Send answer via socket
      socket?.emit('webrtc_answer', {
        callId,
        answer: answer,
        to: remoteUserId,
      });
      log('Answer sent via socket');

    } catch (e) {
      log('Handle offer error', e);
      setError('Arama kabul edilemedi');
    }
  }, [getMediaStream, createPeerConnection, socket, callId, remoteUserId]);

  // ════════════════════════════════════════════════════════════════════════════
  // CALLER: Receive answer
  // ════════════════════════════════════════════════════════════════════════════
  const handleAnswer = useCallback(async (answer: RTCSessionDescription) => {
    try {
      log('Handling answer...');
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        log('Remote description (answer) set');
        
        // Process queued ICE candidates
        for (const candidate of iceCandidatesQueue.current) {
          await pcRef.current.addIceCandidate(candidate);
        }
        iceCandidatesQueue.current = [];
      }
    } catch (e) {
      log('Handle answer error', e);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // ICE Candidate handling
  // ════════════════════════════════════════════════════════════════════════════
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    try {
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        log('ICE candidate added');
      } else {
        iceCandidatesQueue.current.push(new RTCIceCandidate(candidate));
        log('ICE candidate queued');
      }
    } catch (e) {
      log('ICE candidate error', e);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════════════════════════
  const cleanup = useCallback(() => {
    log('Cleanup...');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    Vibration.cancel();

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setRemoteStream(null);
    setConnected(false);
    setCallActive(false);
  }, [localStream]);

  const endCall = useCallback(() => {
    log('End call');
    cleanup();
    socket?.emit('webrtc_end_call', { callId, to: remoteUserId });
    onEnd();
    setTimeout(onClose, 300);
  }, [cleanup, socket, callId, remoteUserId, onEnd, onClose]);

  // ════════════════════════════════════════════════════════════════════════════
  // SOCKET EVENTS
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket || !visible) return;

    // Receive offer (for callee)
    const onOffer = (data: any) => {
      if (data.callId === callId) {
        log('Received offer');
        // Offer geldiğinde otomatik işleme - kabul butonuna basınca bağlan
      }
    };

    // Receive answer (for caller)
    const onAnswer = (data: any) => {
      if (data.callId === callId) {
        log('Received answer');
        handleAnswer(data.answer);
      }
    };

    // Receive ICE candidate
    const onIceCandidate = (data: any) => {
      if (data.callId === callId) {
        handleIceCandidate(data.candidate);
      }
    };

    // Call ended by remote
    const onCallEnded = (data: any) => {
      if (data.callId === callId) {
        log('Call ended by remote');
        cleanup();
        onClose();
      }
    };

    socket.on('webrtc_offer', onOffer);
    socket.on('webrtc_answer', onAnswer);
    socket.on('webrtc_ice_candidate', onIceCandidate);
    socket.on('webrtc_call_ended', onCallEnded);

    return () => {
      socket.off('webrtc_offer', onOffer);
      socket.off('webrtc_answer', onAnswer);
      socket.off('webrtc_ice_candidate', onIceCandidate);
      socket.off('webrtc_call_ended', onCallEnded);
    };
  }, [socket, visible, callId, handleAnswer, handleIceCandidate, cleanup, onClose]);

  // ════════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('Call screen open', { mode, callId, isVideo });
    
    setConnected(false);
    setCallActive(false);
    setDuration(0);
    setError('');

    if (mode === 'caller') {
      // Caller: Hemen arama başlat
      Vibration.vibrate([0, 200, 200, 200], false);
      const interval = setInterval(() => Vibration.vibrate([0, 200, 200, 200], false), 3000);
      timerRef.current = interval;
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();

      // Offer gönder
      startCall();
    } else {
      // Callee: Zil çal, kabul bekle
      Vibration.vibrate([0, 500, 200, 500], true);
    }

    return () => {
      pulseAnim.stopAnimation();
      cleanup();
    };
  }, [visible, callId]);

  // Call accepted (for caller - callee accepted)
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('Call accepted by callee');
      Vibration.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [callAccepted, mode]);

  // Call rejected
  useEffect(() => {
    if (callRejected) {
      log('Call rejected');
      setError('Arama reddedildi');
      setTimeout(endCall, 1500);
    }
  }, [callRejected]);

  // Call ended
  useEffect(() => {
    if (callEnded) {
      log('Call ended');
      endCall();
    }
  }, [callEnded]);

  // Receiver offline
  useEffect(() => {
    if (receiverOffline) {
      log('Receiver offline');
      setError('Karşı taraf çevrimdışı');
      setTimeout(endCall, 1500);
    }
  }, [receiverOffline]);

  // ════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════════════════════════════
  const handleAccept = async () => {
    log('Accept pressed');
    Vibration.cancel();
    
    // Socket'e kabul bildir
    onAccept();
    
    // WebRTC bağlantısını başlat (offer zaten gelmiş olmalı)
    // Offer'ı al ve answer gönder
    socket?.once('webrtc_offer_for_answer', (data: any) => {
      if (data.callId === callId) {
        handleOffer(data.offer);
      }
    });
    
    // Caller'a offer'ı tekrar göndermesini iste
    socket?.emit('webrtc_ready_for_offer', { callId, to: remoteUserId });
  };

  const handleReject = () => {
    log('Reject pressed');
    Vibration.cancel();
    onReject();
    setTimeout(onClose, 300);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
        log('Mute toggled', { muted: !audioTrack.enabled });
      }
    }
  };

  const toggleSpeaker = () => {
    // React Native WebRTC'de speaker değiştirme
    // InCallManager kullanılabilir ama şimdilik basit tutalım
    setSpeakerOn(!speakerOn);
  };

  const toggleCamera = () => {
    if (localStream && isVideo) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOff(!videoTrack.enabled);
        log('Camera toggled', { off: !videoTrack.enabled });
      }
    }
  };

  const switchCamera = async () => {
    if (localStream && isVideo) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        (videoTrack as any)._switchCamera();
        log('Camera switched');
      }
    }
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
        {isVideo && remoteStream && callActive && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}

        {/* Local Video PIP */}
        {isVideo && localStream && (
          <View style={styles.localPip}>
            <RTCView
              streamURL={localStream.toURL()}
              style={{ flex: 1 }}
              objectFit="cover"
              mirror={true}
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
          <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.statusText}>{connected ? 'Bağlı' : 'Bağlanıyor'}</Text>
        </View>

        {/* Avatar */}
        {!(isVideo && remoteStream && callActive) && (
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
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.acceptBtn, isVideo && styles.acceptVideo]} onPress={handleAccept}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callActive ? (
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
