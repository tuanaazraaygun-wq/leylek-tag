/**
 * SimpleCallScreen - Basit ve Çalışan Arama Ekranı
 * WhatsApp/Facebook gibi - TUŞA BASINCA DİREK AÇILIR
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Modal, 
  Platform, PermissionsAndroid, Vibration, Animated, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Config
const BACKEND_URL = 'https://rideconvo.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;
const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

// Agora imports
let createAgoraRtcEngine: any = null;
let RtcSurfaceView: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;

if (Platform.OS !== 'web') {
  try {
    const AgoraModule = require('react-native-agora');
    createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
    RtcSurfaceView = AgoraModule.RtcSurfaceView;
    ChannelProfileType = AgoraModule.ChannelProfileType;
    ClientRoleType = AgoraModule.ClientRoleType;
  } catch (e) {
    console.log('Agora yüklenemedi');
  }
}

interface SimpleCallScreenProps {
  visible: boolean;
  mode: 'caller' | 'receiver'; // Arayan mı, aranan mı
  callId: string;
  channelName: string;
  agoraToken: string;
  userId: string;
  remoteName: string;
  callType: 'audio' | 'video';
  onClose: () => void;
}

export default function SimpleCallScreen({
  visible,
  mode,
  callId,
  channelName,
  agoraToken,
  userId,
  remoteName,
  callType,
  onClose
}: SimpleCallScreenProps) {
  
  // State
  const [status, setStatus] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  
  // Refs
  const engineRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);
  const cleanedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // ===== CLEANUP =====
  const cleanup = useCallback(async () => {
    if (cleanedRef.current) return;
    cleanedRef.current = true;
    
    console.log('🧹 Cleanup başladı');
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    
    Vibration.cancel();
    
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        engineRef.current.removeAllListeners();
        engineRef.current.release();
      } catch (e) {}
      engineRef.current = null;
    }
    
    console.log('🧹 Cleanup tamamlandı');
  }, []);
  
  // ===== END CALL =====
  const endCall = useCallback(async (reason: string = 'user') => {
    console.log('📴 Arama sonlandırılıyor:', reason);
    
    setStatus('ended');
    
    // Backend'e bildir
    try {
      await fetch(`${API_URL}/voice/end-call?user_id=${userId}&call_id=${callId}`, { method: 'POST' });
    } catch (e) {}
    
    await cleanup();
    
    setTimeout(() => {
      onClose();
    }, 500);
  }, [userId, callId, cleanup, onClose]);
  
  // ===== ACCEPT CALL (Receiver için) =====
  const acceptCall = useCallback(async () => {
    console.log('✅ Arama kabul ediliyor');
    setStatus('connecting');
    Vibration.cancel();
    
    try {
      const res = await fetch(`${API_URL}/voice/accept-call?user_id=${userId}&call_id=${callId}`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        // Agora'ya bağlan
        await initAgora(data.agora_token || agoraToken);
      } else {
        endCall('failed');
      }
    } catch (e) {
      endCall('error');
    }
  }, [userId, callId, agoraToken, endCall]);
  
  // ===== REJECT CALL (Receiver için) =====
  const rejectCall = useCallback(async () => {
    console.log('❌ Arama reddediliyor');
    Vibration.cancel();
    
    try {
      await fetch(`${API_URL}/voice/reject-call?user_id=${userId}&call_id=${callId}`, { method: 'POST' });
    } catch (e) {}
    
    await cleanup();
    onClose();
  }, [userId, callId, cleanup, onClose]);
  
  // ===== AGORA INIT =====
  const initAgora = useCallback(async (token: string) => {
    if (!createAgoraRtcEngine || Platform.OS === 'web') {
      console.log('Agora web\'de çalışmaz');
      setStatus('connected');
      return;
    }
    
    // İzinler
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
      } catch (e) {}
    }
    
    try {
      console.log('🎬 Agora başlatılıyor...');
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication || 0,
      });
      
      // Events
      engine.registerEventHandler({
        onJoinChannelSuccess: () => {
          console.log('✅ Kanala katıldı');
          setStatus('connected');
          
          // Süre sayacı başlat
          timerRef.current = setInterval(() => {
            setDuration(d => d + 1);
          }, 1000);
        },
        onUserJoined: (_: any, uid: number) => {
          console.log('👤 Karşı taraf katıldı:', uid);
          setRemoteJoined(true);
          setRemoteUid(uid);
          setStatus('connected');
        },
        onUserOffline: () => {
          console.log('👤 Karşı taraf ayrıldı');
          endCall('remote_left');
        },
        onError: (err: number) => {
          console.log('Agora hata:', err);
        },
      });
      
      // Audio ayarları
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400);
      engine.adjustPlaybackSignalVolume(400);
      
      // Video ayarları
      if (callType === 'video') {
        engine.enableVideo();
        engine.startPreview();
      }
      
      // Kanala katıl
      const uid = Math.floor(Math.random() * 100000) + 1;
      console.log('📞 Kanala katılıyor:', channelName);
      
      await engine.joinChannel(token, channelName, uid, {
        clientRoleType: ClientRoleType?.ClientRoleBroadcaster || 1,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });
      
    } catch (e) {
      console.error('Agora hatası:', e);
      setStatus('connected'); // Yine de devam et
    }
  }, [channelName, callType, endCall]);
  
  // ===== POLL CALL STATUS (Arayan için) =====
  const pollCallStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/voice/check-call-status?call_id=${callId}&user_id=${userId}`);
      const data = await res.json();
      
      if (data.status === 'connected') {
        // Kabul edildi!
        console.log('✅ Arama kabul edildi!');
        setStatus('connecting');
        if (pollRef.current) clearInterval(pollRef.current);
        await initAgora(agoraToken);
      } else if (data.status === 'rejected' || data.status === 'ended' || data.status === 'cancelled') {
        // Reddedildi veya bitti
        console.log('📴 Arama bitti:', data.status);
        if (pollRef.current) clearInterval(pollRef.current);
        await cleanup();
        onClose();
      }
    } catch (e) {}
  }, [callId, userId, agoraToken, initAgora, cleanup, onClose]);
  
  // ===== MAIN EFFECT =====
  useEffect(() => {
    if (!visible) return;
    
    // ⚠️ callId yoksa henüz bekle (caller modunda backend'den data gelmesi bekleniyor)
    if (mode === 'caller' && !callId) {
      console.log('📞 Caller mode - callId bekleniyor...');
      setStatus('ringing');
      return;
    }
    
    cleanedRef.current = false;
    setDuration(0);
    setRemoteJoined(false);
    
    console.log(`📞 SimpleCallScreen açıldı - mode: ${mode}, callId: ${callId}`);
    
    // Pulse animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
    
    if (mode === 'caller') {
      // ARAYAN: Agora'ya hemen bağlan + karşı tarafın cevabını bekle
      setStatus('ringing');
      initAgora(agoraToken);
      
      // Her 500ms'de bir kontrol et
      pollRef.current = setInterval(pollCallStatus, 500);
      
      // 30 saniye sonra cevap yoksa kapat
      setTimeout(() => {
        if (status === 'ringing') {
          endCall('no_answer');
        }
      }, 30000);
      
    } else {
      // ARANAN: Gelen arama ekranı göster
      setStatus('ringing');
      Vibration.vibrate([0, 500, 300, 500], true);
    }
    
    return () => {
      cleanup();
    };
  }, [visible, callId]);
  
  // ===== CONTROLS =====
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
  
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  if (!visible) return null;
  
  // ===== GELEN ARAMA EKRANI =====
  if (mode === 'receiver' && status === 'ringing') {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.incomingLabel}>Gelen Arama</Text>
            
            <Animated.View style={[styles.avatar, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.avatarText}>{remoteName.charAt(0).toUpperCase()}</Text>
            </Animated.View>
            
            <Text style={styles.remoteName}>{remoteName}</Text>
            <Text style={styles.callTypeLabel}>
              {callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}
            </Text>
            
            <View style={styles.incomingButtons}>
              <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
                <Ionicons name="close" size={32} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                <Ionicons name="call" size={32} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    );
  }
  
  // ===== VIDEO ARAMA (Bağlı) =====
  if (callType === 'video' && status === 'connected' && remoteUid && RtcSurfaceView) {
    return (
      <Modal visible={visible} animationType="fade" statusBarTranslucent>
        <View style={styles.videoContainer}>
          <RtcSurfaceView style={styles.remoteVideo} canvas={{ uid: remoteUid }} />
          
          <View style={styles.localVideoWrapper}>
            <RtcSurfaceView style={styles.localVideo} canvas={{ uid: 0 }} zOrderMediaOverlay />
          </View>
          
          <View style={styles.videoOverlay}>
            <Text style={styles.videoName}>{remoteName}</Text>
            <Text style={styles.videoDuration}>{formatTime(duration)}</Text>
          </View>
          
          <View style={styles.videoControls}>
            <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={toggleMute}>
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.endBtn} onPress={() => endCall('user')}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.ctrlBtn, !isSpeaker && styles.ctrlBtnActive]} onPress={toggleSpeaker}>
              <Ionicons name={isSpeaker ? "volume-high" : "volume-mute"} size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
  
  // ===== SESLİ ARAMA / ÇALIYOR / BAĞLANIYOR =====
  const statusText = 
    status === 'ringing' ? 'Aranıyor...' :
    status === 'connecting' ? 'Bağlanıyor...' :
    status === 'connected' ? 'Bağlandı' : 'Bitti';
  
  const bgColors = 
    status === 'connected' ? ['#065F46', '#059669'] :
    status === 'ended' ? ['#7f1d1d', '#b91c1c'] :
    ['#1E3A5F', '#3182CE'];
  
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <LinearGradient colors={bgColors} style={styles.container}>
        <View style={styles.content}>
          {/* Status */}
          <View style={[styles.statusBadge, status === 'connected' && styles.statusConnected]}>
            <View style={[styles.statusDot, status === 'connected' && styles.statusDotGreen]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
          
          {/* Avatar */}
          <Animated.View style={[styles.avatar, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.avatarText}>{remoteName.charAt(0).toUpperCase()}</Text>
          </Animated.View>
          
          {/* İsim */}
          <Text style={styles.remoteName}>{remoteName}</Text>
          
          {/* Süre */}
          {status === 'connected' && (
            <View style={styles.durationBox}>
              <Ionicons name="time-outline" size={18} color="#22C55E" />
              <Text style={styles.durationText}>{formatTime(duration)}</Text>
            </View>
          )}
          
          {/* Kontroller */}
          <View style={styles.controls}>
            {status === 'connected' && (
              <View style={styles.controlRow}>
                <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={toggleMute}>
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={26} color="#FFF" />
                  <Text style={styles.controlLabel}>{isMuted ? 'Kapalı' : 'Mikrofon'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.controlBtn, !isSpeaker && styles.controlBtnActive]} onPress={toggleSpeaker}>
                  <Ionicons name={isSpeaker ? "volume-high" : "volume-mute"} size={26} color="#FFF" />
                  <Text style={styles.controlLabel}>{isSpeaker ? 'Hoparlör' : 'Kulaklık'}</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity style={styles.endCallBtn} onPress={() => endCall('user')}>
              <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.endCallGradient}>
                <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.endLabel}>{status === 'connected' ? 'Aramayı Bitir' : 'İptal'}</Text>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', paddingTop: 80 },
  
  // Status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 40,
  },
  statusConnected: { backgroundColor: '#22C55E' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginRight: 8 },
  statusDotGreen: { backgroundColor: '#86EFAC' },
  statusText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  
  // Avatar
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: { fontSize: 48, fontWeight: 'bold', color: '#FFF' },
  
  // Name
  remoteName: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  callTypeLabel: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 20 },
  incomingLabel: { fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  
  // Duration
  durationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 40,
  },
  durationText: { fontSize: 18, fontWeight: 'bold', color: '#22C55E', marginLeft: 6 },
  
  // Controls
  controls: { flex: 1, justifyContent: 'flex-end', paddingBottom: 60, alignItems: 'center' },
  controlRow: { flexDirection: 'row', gap: 50, marginBottom: 40 },
  controlBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
  },
  controlBtnActive: { backgroundColor: 'rgba(239,68,68,0.3)' },
  controlLabel: { color: '#FFF', fontSize: 11, marginTop: 6 },
  
  endCallBtn: { marginBottom: 10 },
  endCallGradient: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  endLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  
  // Incoming
  incomingButtons: { flexDirection: 'row', gap: 80, marginTop: 60 },
  rejectBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Video
  videoContainer: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  localVideoWrapper: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localVideo: { flex: 1 },
  videoOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  videoName: { color: '#FFF', fontSize: 20, fontWeight: '600' },
  videoDuration: { color: '#FFF', fontSize: 16, marginTop: 4 },
  videoControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    alignItems: 'center',
  },
  ctrlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlBtnActive: { backgroundColor: 'rgba(239,68,68,0.4)' },
  endBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
