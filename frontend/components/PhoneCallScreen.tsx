/**
 * PhoneCallScreen - Profesyonel Telefon Arama Ekranı
 * 
 * Gerçek telefon gibi çalışır:
 * - Tuşa basınca ANINDA açılır
 * - Çalma sesi çalar (7 kez)
 * - "Aranıyor..." durumu gösterilir
 * - Karşı taraf kabul ederse "Bağlandı" + süre sayacı
 * - Karşı taraf reddederse "Kullanıcı meşgul"
 * - 21 saniye (7 çalma) sonra "Kullanıcı cevap vermiyor"
 * - Bir taraf kapattığında diğer taraf da otomatik kapanır
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  Animated, 
  Vibration,
  Platform,
  PermissionsAndroid,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==================== CONFIG ====================
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    'https://tagride.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

const SUPABASE_URL = 'https://ujvploftywsxprlzejgc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdnBsb2Z0eXdzeHBybHplamdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTgwNzYsImV4cCI6MjA4MTk5NDA3Nn0.c3I-1K7Guc5OmOxHdc_mhw-pSEsobVE6DN7m-Z9Re8k';
const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Agora imports (lazy load)
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
  } catch (e) {
    console.log('⚠️ Agora SDK yüklenemedi');
  }
}

// ==================== CONSTANTS ====================
const RING_COUNT = 7; // 7 kez çalacak
const RING_INTERVAL = 3000; // Her çalma 3 saniye
const RING_TIMEOUT = RING_COUNT * RING_INTERVAL; // 21 saniye toplam
const MAX_CALL_DURATION = 600; // 10 dakika max

// ==================== TYPES ====================
export interface PhoneCallScreenProps {
  visible: boolean;
  isCaller: boolean; // Arayan mı, aranan mı?
  callId: string;
  channelName: string;
  userId: string;
  remoteUserName: string;
  remoteUserId: string;
  callType: 'audio' | 'video';
  agoraToken?: string;
  onClose: () => void;
  onCallEnded?: (reason: string) => void;
}

type CallStatus = 
  | 'initializing'    // Başlatılıyor
  | 'ringing'         // Çalıyor (arayan için "Aranıyor...")
  | 'incoming'        // Gelen arama (aranan için)
  | 'connecting'      // Bağlanıyor (cevaplandı, Agora'ya katılıyor)
  | 'connected'       // Bağlandı - Görüşme devam ediyor
  | 'ended'           // Bitti
  | 'rejected'        // Reddedildi
  | 'no_answer'       // Cevap yok (timeout)
  | 'busy';           // Meşgul

// ==================== COMPONENT ====================
export default function PhoneCallScreen({
  visible,
  isCaller,
  callId,
  channelName,
  userId,
  remoteUserName,
  remoteUserId,
  callType,
  agoraToken,
  onClose,
  onCallEnded
}: PhoneCallScreenProps) {
  
  // ==================== STATE ====================
  const [callStatus, setCallStatus] = useState<CallStatus>('initializing');
  const [duration, setDuration] = useState(0);
  const [ringCount, setRingCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // ==================== REFS ====================
  const engineRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCleanedUpRef = useRef(false);
  const localUidRef = useRef(Math.floor(Math.random() * 100000) + 1);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // ==================== PERMISSION CHECK ====================
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    
    try {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      return grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };
  
  // ==================== RING SOUND ====================
  const playRingSound = async () => {
    try {
      // Stop existing sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }
      
      // Cihazın varsayılan zil sesini kullan (expo-av ile)
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/phone/phone-calling-1.mp3' },
        { shouldPlay: true, isLooping: false }
      );
      soundRef.current = sound;
      
      // Titreşim (gelen arama için)
      if (!isCaller) {
        Vibration.vibrate([0, 500, 200, 500]);
      }
    } catch (e) {
      console.log('Ring sound error:', e);
      // Titreşim ile devam et
      Vibration.vibrate(500);
    }
  };
  
  const stopRingSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      Vibration.cancel();
    } catch (e) {
      console.log('Stop ring error:', e);
    }
  };
  
  // ==================== CLEANUP ====================
  const cleanup = useCallback(async () => {
    if (isCleanedUpRef.current) return;
    isCleanedUpRef.current = true;
    
    console.log('🧹 PhoneCallScreen cleanup başladı');
    
    // Stop intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    
    // Stop sound & vibration
    await stopRingSound();
    
    // Cleanup Supabase subscription
    if (realtimeChannelRef.current) {
      await supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    
    // Cleanup Agora
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        engineRef.current.removeAllListeners();
        engineRef.current.release();
      } catch (e) {
        console.log('Agora cleanup error:', e);
      }
      engineRef.current = null;
    }
    
    console.log('🧹 Cleanup tamamlandı');
  }, []);
  
  // ==================== END CALL ====================
  const endCall = useCallback(async (reason: string = 'user_ended') => {
    console.log('📞 END CALL:', reason);
    
    // Backend'e bildir
    try {
      await fetch(`${API_URL}/voice/end-call?user_id=${userId}&call_id=${callId}`, {
        method: 'POST'
      });
    } catch (e) {
      console.log('End call API error:', e);
    }
    
    // Cleanup ve kapat
    await cleanup();
    onCallEnded?.(reason);
    onClose();
  }, [userId, callId, cleanup, onCallEnded, onClose]);
  
  // ==================== SUPABASE REALTIME ====================
  const setupRealtimeSubscription = useCallback(() => {
    console.log('📡 Realtime subscription başlatılıyor:', callId);
    
    const channel = supabase
      .channel(`call_${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `call_id=eq.${callId}`
        },
        (payload) => {
          console.log('📡 Call update:', payload.new);
          const call = payload.new as any;
          
          if (!call) return;
          
          // ========== CONNECTED ==========
          if (call.status === 'connected') {
            console.log('✅ ARAMA BAĞLANDI!');
            stopRingSound();
            setCallStatus('connected');
            setStatusMessage('Bağlandı');
            
            // Süre sayacını başlat
            if (!durationIntervalRef.current) {
              durationIntervalRef.current = setInterval(() => {
                setDuration(prev => {
                  if (prev >= MAX_CALL_DURATION) {
                    endCall('timeout');
                    return prev;
                  }
                  return prev + 1;
                });
              }, 1000);
            }
          }
          
          // ========== ENDED / CANCELLED / REJECTED ==========
          if (['ended', 'cancelled', 'missed'].includes(call.status)) {
            console.log('📴 ARAMA SONLANDI:', call.status);
            stopRingSound();
            
            if (call.status === 'cancelled') {
              setStatusMessage(isCaller ? 'İptal edildi' : 'Arayan iptal etti');
            } else {
              setStatusMessage('Arama bitti');
            }
            
            setCallStatus('ended');
            
            // 1 saniye bekleyip kapat
            setTimeout(() => {
              cleanup();
              onCallEnded?.(call.status);
              onClose();
            }, 1000);
          }
          
          // ========== REJECTED ==========
          if (call.status === 'rejected') {
            console.log('📵 ARAMA REDDEDİLDİ');
            stopRingSound();
            setCallStatus('rejected');
            setStatusMessage('Kullanıcı meşgul');
            
            setTimeout(() => {
              cleanup();
              onCallEnded?.('rejected');
              onClose();
            }, 2000);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
      });
    
    realtimeChannelRef.current = channel;
  }, [callId, isCaller, cleanup, endCall, onCallEnded, onClose]);
  
  // ==================== AGORA SETUP ====================
  const initAgora = useCallback(async (token: string) => {
    if (!createAgoraRtcEngine || !isNative) {
      console.log('⚠️ Agora sadece native cihazda çalışır');
      return;
    }
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('İzin Gerekli', 'Mikrofon izni verin');
      return;
    }
    
    try {
      console.log('🎬 Agora başlatılıyor...');
      
      // Cleanup existing engine
      if (engineRef.current) {
        try {
          engineRef.current.leaveChannel();
          engineRef.current.removeAllListeners();
          engineRef.current.release();
        } catch (e) {}
        engineRef.current = null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication || 0,
      });
      
      // Event handlers
      engine.registerEventHandler({
        onJoinChannelSuccess: (_: any, elapsed: number) => {
          console.log('✅ Agora kanala katıldı:', elapsed, 'ms');
        },
        onUserJoined: (_: any, uid: number) => {
          console.log('👤 Karşı taraf katıldı:', uid);
          setRemoteUid(uid);
          setCallStatus('connected');
          setStatusMessage('Bağlandı');
          stopRingSound();
          
          // Süre sayacı başlat
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              setDuration(prev => {
                if (prev >= MAX_CALL_DURATION) {
                  endCall('timeout');
                  return prev;
                }
                return prev + 1;
              });
            }, 1000);
          }
        },
        onUserOffline: (_: any, uid: number) => {
          console.log('👤 Karşı taraf ayrıldı:', uid);
          setRemoteUid(null);
          // Karşı taraf ayrıldıysa aramayı bitir
          endCall('remote_left');
        },
        onError: (err: number, msg: string) => {
          console.log('❌ Agora hatası:', err, msg);
        },
      });
      
      // Audio settings
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.adjustRecordingSignalVolume(400);
      engine.adjustPlaybackSignalVolume(400);
      engine.muteLocalAudioStream(false);
      
      // Video settings
      if (callType === 'video') {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.muteLocalVideoStream(false);
        engine.startPreview();
      }
      
      // Join channel
      console.log('📞 Kanala katılıyor:', channelName);
      await engine.joinChannel(token, channelName, localUidRef.current, {
        clientRoleType: ClientRoleType?.ClientRoleBroadcaster || 1,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });
      
      console.log('✅ Agora bağlantısı tamamlandı');
      
    } catch (e) {
      console.error('❌ Agora init hatası:', e);
    }
  }, [channelName, callType, endCall]);
  
  // ==================== START RINGING ====================
  const startRinging = useCallback(() => {
    console.log('🔔 Çalma başladı');
    setCallStatus('ringing');
    setStatusMessage('Aranıyor...');
    setRingCount(0);
    
    // İlk çalma
    playRingSound();
    
    // Her 3 saniyede çal
    ringIntervalRef.current = setInterval(() => {
      setRingCount(prev => {
        const newCount = prev + 1;
        console.log(`🔔 Çalma: ${newCount}/${RING_COUNT}`);
        
        if (newCount >= RING_COUNT) {
          // Timeout - Cevap yok
          console.log('⏰ TIMEOUT - Cevap yok');
          clearInterval(ringIntervalRef.current!);
          ringIntervalRef.current = null;
          stopRingSound();
          setCallStatus('no_answer');
          setStatusMessage('Kullanıcı cevap vermiyor');
          
          // Backend'e bildir ve kapat
          setTimeout(() => {
            endCall('no_answer');
          }, 2000);
          
          return newCount;
        }
        
        playRingSound();
        return newCount;
      });
    }, RING_INTERVAL);
  }, [endCall]);
  
  // ==================== ACCEPT CALL (Aranan için) ====================
  const acceptCall = useCallback(async () => {
    console.log('✅ Arama kabul ediliyor...');
    setCallStatus('connecting');
    setStatusMessage('Bağlanıyor...');
    stopRingSound();
    
    try {
      const response = await fetch(`${API_URL}/voice/accept-call?user_id=${userId}&call_id=${callId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Backend: Arama kabul edildi');
        // Agora'ya bağlan
        if (data.agora_token || agoraToken) {
          await initAgora(data.agora_token || agoraToken || '');
        }
      } else {
        Alert.alert('Hata', data.detail || 'Arama kabul edilemedi');
        onClose();
      }
    } catch (e) {
      console.error('Accept call error:', e);
      Alert.alert('Hata', 'Bağlantı hatası');
      onClose();
    }
  }, [userId, callId, agoraToken, initAgora, onClose]);
  
  // ==================== REJECT CALL (Aranan için) ====================
  const rejectCall = useCallback(async () => {
    console.log('📵 Arama reddediliyor...');
    stopRingSound();
    
    try {
      await fetch(`${API_URL}/voice/reject-call?user_id=${userId}&call_id=${callId}`, {
        method: 'POST'
      });
    } catch (e) {
      console.log('Reject call error:', e);
    }
    
    cleanup();
    onCallEnded?.('rejected');
    onClose();
  }, [userId, callId, cleanup, onCallEnded, onClose]);
  
  // ==================== MAIN EFFECT ====================
  useEffect(() => {
    if (!visible) return;
    
    console.log('📞 PhoneCallScreen açıldı - isCaller:', isCaller, 'callId:', callId);
    isCleanedUpRef.current = false;
    
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    
    // Realtime subscription başlat
    setupRealtimeSubscription();
    
    if (isCaller) {
      // ARAYAN: Çalmayı başlat ve Agora'ya bağlan
      startRinging();
      if (agoraToken) {
        initAgora(agoraToken);
      }
    } else {
      // ARANAN: Gelen arama ekranı göster
      setCallStatus('incoming');
      setStatusMessage('Gelen Arama');
      playRingSound();
    }
    
    return () => {
      cleanup();
    };
  }, [visible]);
  
  // ==================== CONTROLS ====================
  const toggleMute = () => {
    if (engineRef.current) {
      const newMuted = !isMuted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setIsMuted(newMuted);
    }
  };
  
  const toggleSpeaker = () => {
    if (engineRef.current) {
      const newSpeaker = !isSpeakerOn;
      engineRef.current.setEnableSpeakerphone(newSpeaker);
      setIsSpeakerOn(newSpeaker);
    }
  };
  
  const toggleVideo = () => {
    if (engineRef.current && callType === 'video') {
      const newEnabled = !isVideoEnabled;
      engineRef.current.muteLocalVideoStream(!newEnabled);
      setIsVideoEnabled(newEnabled);
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // ==================== RENDER ====================
  if (!visible) return null;
  
  // ========== GELEN ARAMA EKRANI ==========
  if (callStatus === 'incoming') {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <LinearGradient colors={['#1a1a2e', '#16213e', '#1a1a2e']} style={styles.container}>
          <View style={styles.incomingContent}>
            {/* Avatar */}
            <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{remoteUserName.charAt(0).toUpperCase()}</Text>
                </View>
              </View>
            </Animated.View>
            
            {/* İsim */}
            <Text style={styles.callerName}>{remoteUserName}</Text>
            <Text style={styles.callTypeLabel}>
              {callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}
            </Text>
            
            {/* Butonlar */}
            <View style={styles.incomingButtons}>
              {/* Reddet */}
              <TouchableOpacity style={styles.rejectButton} onPress={rejectCall}>
                <Ionicons name="close" size={36} color="#FFF" />
              </TouchableOpacity>
              
              {/* Kabul Et */}
              <TouchableOpacity style={styles.acceptButton} onPress={acceptCall}>
                <Ionicons name="call" size={36} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    );
  }
  
  // ========== VIDEO ARAMA - BAĞLANDI ==========
  if (callType === 'video' && callStatus === 'connected' && remoteUid) {
    return (
      <Modal visible={visible} animationType="fade" statusBarTranslucent>
        <View style={styles.videoContainer}>
          {/* Karşı tarafın videosu */}
          {RtcSurfaceView && (
            <RtcSurfaceView style={styles.remoteVideo} canvas={{ uid: remoteUid }} />
          )}
          
          {/* Kendi videomuz (küçük) */}
          {isVideoEnabled && RtcSurfaceView && (
            <View style={styles.localVideo}>
              <RtcSurfaceView style={styles.localVideoInner} canvas={{ uid: 0 }} zOrderMediaOverlay={true} />
            </View>
          )}
          
          {/* Üst bar */}
          <View style={styles.videoTopBar}>
            <View style={styles.videoInfo}>
              <Text style={styles.videoCallerName}>{remoteUserName}</Text>
              <View style={styles.durationBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.durationText}>{formatTime(duration)}</Text>
              </View>
            </View>
          </View>
          
          {/* Alt kontroller */}
          <View style={styles.videoBottomBar}>
            <TouchableOpacity 
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlBtn, !isVideoEnabled && styles.controlBtnActive]} 
              onPress={toggleVideo}
            >
              <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={24} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlBtn, !isSpeakerOn && styles.controlBtnActive]} 
              onPress={toggleSpeaker}
            >
              <Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={24} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.endCallBtn} onPress={() => endCall('user_ended')}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
  
  // ========== SESLİ ARAMA / ÇALIYOR / BAĞLANIYOR ==========
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <LinearGradient 
        colors={
          callStatus === 'connected' ? ['#065F46', '#047857', '#059669'] :
          callStatus === 'rejected' || callStatus === 'no_answer' ? ['#7f1d1d', '#991b1b', '#b91c1c'] :
          ['#1E3A5F', '#2C5282', '#3182CE']
        } 
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Status Badge */}
          <View style={[
            styles.statusBadge,
            callStatus === 'connected' && styles.statusConnected,
            (callStatus === 'rejected' || callStatus === 'no_answer') && styles.statusEnded
          ]}>
            <View style={[
              styles.statusDot,
              callStatus === 'connected' && styles.statusDotGreen,
              (callStatus === 'rejected' || callStatus === 'no_answer') && styles.statusDotRed
            ]} />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
          
          {/* Avatar */}
          <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[
              styles.avatarRing,
              callStatus === 'connected' && styles.avatarRingGreen
            ]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{remoteUserName.charAt(0).toUpperCase()}</Text>
              </View>
            </View>
            {callStatus === 'connected' && (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
              </View>
            )}
          </Animated.View>
          
          {/* İsim */}
          <Text style={styles.callerName}>{remoteUserName}</Text>
          
          {/* Süre veya Çalma sayısı */}
          {callStatus === 'connected' ? (
            <View style={styles.durationContainer}>
              <Ionicons name="time-outline" size={18} color="#22C55E" />
              <Text style={styles.connectedDuration}>{formatTime(duration)}</Text>
              <Text style={styles.maxDuration}>/ {formatTime(MAX_CALL_DURATION)}</Text>
            </View>
          ) : callStatus === 'ringing' ? (
            <Text style={styles.ringCountText}>🔔 {ringCount + 1}/{RING_COUNT}</Text>
          ) : null}
          
          {/* Kontroller */}
          <View style={styles.controlsContainer}>
            {callStatus === 'connected' && (
              <View style={styles.controlsRow}>
                <TouchableOpacity 
                  style={[styles.controlButton, isMuted && styles.controlButtonActive]} 
                  onPress={toggleMute}
                >
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? "#EF4444" : "#FFF"} />
                  <Text style={styles.controlLabel}>{isMuted ? 'Kapalı' : 'Mikrofon'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.controlButton, !isSpeakerOn && styles.controlButtonActive]} 
                  onPress={toggleSpeaker}
                >
                  <Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={28} color={!isSpeakerOn ? "#EF4444" : "#FFF"} />
                  <Text style={styles.controlLabel}>{isSpeakerOn ? 'Hoparlör' : 'Kulaklık'}</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Kapat butonu */}
            {callStatus !== 'rejected' && callStatus !== 'no_answer' && (
              <TouchableOpacity style={styles.endCallButtonWrapper} onPress={() => endCall('user_ended')}>
                <LinearGradient colors={['#EF4444', '#DC2626', '#B91C1C']} style={styles.endCallButton}>
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <Text style={styles.endCallLabel}>
              {callStatus === 'connected' ? 'Aramayı Bitir' : 
               callStatus === 'rejected' || callStatus === 'no_answer' ? '' : 
               'İptal'}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 30,
  },
  statusConnected: {
    backgroundColor: '#22C55E',
  },
  statusEnded: {
    backgroundColor: '#EF4444',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 8,
  },
  statusDotGreen: {
    backgroundColor: '#86EFAC',
  },
  statusDotRed: {
    backgroundColor: '#FCA5A5',
  },
  statusText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Avatar
  avatarWrapper: {
    marginBottom: 20,
    position: 'relative',
  },
  avatarRing: {
    padding: 6,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarRingGreen: {
    borderColor: '#22C55E',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  connectedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 14,
  },
  
  // Name & Info
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  callTypeLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },
  ringCountText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  
  // Duration
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 30,
  },
  connectedDuration: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22C55E',
    marginLeft: 6,
  },
  maxDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  
  // Controls
  controlsContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 50,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 40,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },
  endCallButtonWrapper: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
  },
  
  // Incoming Call
  incomingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  incomingButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginTop: 60,
  },
  rejectButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Video Call
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localVideoInner: {
    flex: 1,
  },
  videoTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  videoInfo: {
    alignItems: 'center',
  },
  videoCallerName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  durationText: {
    color: '#FFF',
    fontSize: 16,
  },
  videoBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.4)',
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});
