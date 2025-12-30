/**
 * CallScreenV2 - Profesyonel Sesli/Görüntülü Arama Ekranı
 * 
 * YENİ MİMARİ:
 * - Agora engine SINGLETON olarak useAgoraEngine hook'undan geliyor
 * - joinChannel ANINDA çağrılıyor (socket beklenmez)
 * - Socket SADECE sinyal için (ringing/accept/reject/end)
 * - Call State Machine: idle → calling → in_call → ended
 * 
 * DEBUG LOGS:
 * - 🕐 Timestamp ile her adım loglanıyor
 * - Call start → joinChannel → onJoinChannelSuccess → onUserJoined
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
  PermissionsAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngineEventHandler,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

// Call State Machine
type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'in_call' | 'ended';

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
  
  // Socket.IO callbacks (SADECE SİNYAL!)
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
  
  // External status updates (Socket'ten)
  callAccepted?: boolean;
  callRejected?: boolean;
  callEnded?: boolean;
  receiverOffline?: boolean;
}

// Singleton Agora Engine
let globalEngine: IRtcEngine | null = null;
let engineInitialized = false;

// Debug timestamp
const timestamp = () => new Date().toISOString().split('T')[1].slice(0, 12);

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
  
  // ==================== STATE ====================
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // Refs
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isInChannel = useRef(false);
  const callStartTime = useRef<number>(0);

  // ==================== DEBUG LOGGER ====================
  const log = useCallback((message: string) => {
    const logMsg = `[${timestamp()}] ${message}`;
    console.log(`📞 CALL: ${logMsg}`);
    setDebugLogs(prev => [...prev.slice(-9), logMsg]);
  }, []);

  // ==================== PERMISSIONS ====================
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
        
        const audioOk = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 
                       PermissionsAndroid.RESULTS.GRANTED;
        const cameraOk = granted[PermissionsAndroid.PERMISSIONS.CAMERA] === 
                        PermissionsAndroid.RESULTS.GRANTED;
        
        log(`Permissions: audio=${audioOk}, camera=${cameraOk}`);
        return audioOk; // En azından mikrofon gerekli
      } catch (err) {
        log(`Permission error: ${err}`);
        return false;
      }
    }
    return true;
  };

  // ==================== AGORA ENGINE (SINGLETON) ====================
  const initEngine = useCallback(async (): Promise<IRtcEngine | null> => {
    if (engineInitialized && globalEngine) {
      log('Engine already initialized (singleton)');
      return globalEngine;
    }

    log('Initializing Agora engine...');
    
    try {
      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        log('❌ Permissions denied!');
        return null;
      }

      const engine = createAgoraRtcEngine();
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Audio setup
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      
      // Video setup (if needed)
      if (callType === 'video') {
        engine.enableVideo();
        engine.startPreview();
      }
      
      // Set client role
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      globalEngine = engine;
      engineInitialized = true;
      
      log('✅ Engine initialized successfully');
      return engine;
    } catch (error) {
      log(`❌ Engine init error: ${error}`);
      return null;
    }
  }, [callType, log]);

  // ==================== JOIN CHANNEL (IMMEDIATELY!) ====================
  const joinChannel = useCallback(async () => {
    if (isInChannel.current) {
      log('Already in channel, skipping');
      return;
    }

    const joinStartTime = Date.now();
    log(`🚀 joinChannel START - channel: ${channelName}`);

    try {
      let engine = globalEngine;
      if (!engine) {
        engine = await initEngine();
      }

      if (!engine) {
        log('❌ No engine available!');
        return;
      }

      // Register event handlers
      const eventHandler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection, elapsed) => {
          const joinTime = Date.now() - joinStartTime;
          log(`✅ onJoinChannelSuccess - channel: ${connection.channelId}, time: ${joinTime}ms`);
          isInChannel.current = true;
          
          if (mode === 'caller') {
            setCallState('calling');
          } else {
            setCallState('connecting');
          }
        },
        onUserJoined: (connection, uid, elapsed) => {
          const totalTime = Date.now() - callStartTime.current;
          log(`👤 onUserJoined - uid: ${uid}, totalTime: ${totalTime}ms`);
          setRemoteJoined(true);
          setCallState('in_call');
          startDurationTimer();
          stopRingtone();
        },
        onUserOffline: (connection, uid, reason) => {
          log(`👤 onUserOffline - uid: ${uid}, reason: ${reason}`);
          setRemoteJoined(false);
          // ⚠️ CRITICAL: Karşı taraf ayrıldığında otomatik bitir
          handleEndCall();
        },
        onLeaveChannel: (connection, stats) => {
          log(`📴 onLeaveChannel - duration: ${stats.duration}s`);
          isInChannel.current = false;
        },
        onError: (err, msg) => {
          log(`❌ Agora error: ${err} - ${msg}`);
        },
        onConnectionStateChanged: (connection, state, reason) => {
          log(`🔌 Connection state: ${state}, reason: ${reason}`);
        },
      };

      engine.registerEventHandler(eventHandler);

      // Generate UID
      const uid = Math.floor(Math.random() * 100000);
      log(`📡 Joining channel: ${channelName}, uid: ${uid}`);

      // JOIN IMMEDIATELY!
      engine.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });

    } catch (error) {
      log(`❌ joinChannel error: ${error}`);
    }
  }, [channelName, agoraToken, callType, mode, initEngine, log]);

  // ==================== LEAVE CHANNEL ====================
  const leaveChannel = useCallback(async () => {
    if (!isInChannel.current || !globalEngine) {
      log('Not in channel, skipping leave');
      return;
    }

    log('📴 Leaving channel...');
    try {
      globalEngine.leaveChannel();
      isInChannel.current = false;
    } catch (error) {
      log(`Leave error: ${error}`);
    }
  }, [log]);

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
  
  // KABUL ET (receiver only)
  const handleAcceptCall = useCallback(async () => {
    log('✅ ACCEPT pressed');
    setCallState('connecting');
    stopRingtone();
    
    // Socket üzerinden SADECE sinyal gönder
    onAccept();
    
    // 🚀 ANINDA Agora'ya katıl!
    await joinChannel();
  }, [onAccept, joinChannel, stopRingtone, log]);

  // REDDET (receiver only)
  const handleRejectCall = useCallback(() => {
    log('❌ REJECT pressed');
    setCallState('ended');
    stopRingtone();
    
    // Socket üzerinden SADECE sinyal gönder
    onReject();
    
    setTimeout(() => onClose(), 500);
  }, [onReject, onClose, stopRingtone, log]);

  // KAPAT (both)
  const handleEndCall = useCallback(async () => {
    log('📴 END CALL');
    setCallState('ended');
    stopRingtone();
    stopDurationTimer();
    
    // Socket üzerinden SADECE sinyal gönder
    onEnd();
    
    // Agora'dan çık
    await leaveChannel();
    
    setTimeout(() => onClose(), 1000);
  }, [onEnd, onClose, stopRingtone, stopDurationTimer, leaveChannel, log]);

  // ==================== CONTROLS ====================
  const toggleMute = useCallback(() => {
    if (globalEngine) {
      globalEngine.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
      log(`Mute: ${!isMuted}`);
    }
  }, [isMuted, log]);

  const toggleSpeaker = useCallback(() => {
    if (globalEngine) {
      globalEngine.setEnableSpeakerphone(!isSpeaker);
      setIsSpeaker(!isSpeaker);
      log(`Speaker: ${!isSpeaker}`);
    }
  }, [isSpeaker, log]);

  // ==================== MAIN EFFECT ====================
  useEffect(() => {
    if (!visible || !callId) return;

    // Reset state
    callStartTime.current = Date.now();
    setCallState('idle');
    setDuration(0);
    setRemoteJoined(false);
    setDebugLogs([]);

    log(`📞 CallScreen OPEN - mode: ${mode}, callId: ${callId}`);
    log(`Channel: ${channelName}, Token: ${agoraToken?.slice(0, 20)}...`);

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // ==================== CALLER FLOW ====================
      // 🚀 ANINDA state'i "calling" yap ve Agora'ya katıl
      setCallState('calling');
      log('🚀 CALLER: Joining channel IMMEDIATELY');
      joinChannel();

      // 45 saniye timeout
      ringtoneTimeoutRef.current = setTimeout(() => {
        if (callState === 'calling') {
          log('⏱️ Timeout - no answer');
          handleEndCall();
        }
      }, 45000);

    } else {
      // ==================== RECEIVER FLOW ====================
      setCallState('ringing');
      log('🔔 RECEIVER: Ringing...');
      playRingtone();

      // 45 saniye timeout
      ringtoneTimeoutRef.current = setTimeout(() => {
        log('⏱️ Timeout - auto reject');
        handleRejectCall();
      }, 45000);
    }

    return () => {
      log('📞 CallScreen CLEANUP');
      stopRingtone();
      stopDurationTimer();
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ==================== EXTERNAL STATUS UPDATES ====================
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('✅ External: callAccepted');
      // Arayan için - karşı taraf kabul etti, Agora'da onUserJoined bekle
    }
  }, [callAccepted, mode, log]);

  useEffect(() => {
    if (callRejected) {
      log('❌ External: callRejected');
      setCallState('ended');
      handleEndCall();
    }
  }, [callRejected, log]);

  useEffect(() => {
    if (callEnded) {
      log('📴 External: callEnded');
      handleEndCall();
    }
  }, [callEnded, log]);

  useEffect(() => {
    if (receiverOffline) {
      log('📵 External: receiverOffline');
      setCallState('ended');
      handleEndCall();
    }
  }, [receiverOffline, log]);

  // ==================== RENDER ====================
  if (!visible) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callState) {
      case 'idle': return 'Hazırlanıyor...';
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
      case 'connecting': return 'Bağlanıyor...';
      case 'in_call': return formatDuration(duration);
      case 'ended': return 'Arama Bitti';
      default: return '';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: 
              callState === 'in_call' ? '#4CAF50' : 
              callState === 'ended' ? '#f44336' : '#FFC107' 
            }]} />
            <Text style={styles.statusBadgeText}>{callState.toUpperCase()}</Text>
          </View>
        </View>

        {/* Avatar */}
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={60} color="#fff" />
          </View>
        </Animated.View>

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.statusText}>{getStatusText()}</Text>

        {/* Debug Logs (visible in dev) */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            {debugLogs.map((log, i) => (
              <Text key={i} style={styles.debugText}>{log}</Text>
            ))}
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {callState === 'ringing' && mode === 'receiver' ? (
            // Receiver - Incoming call buttons
            <View style={styles.incomingControls}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleRejectCall}>
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptCall}>
                <Ionicons name="call" size={30} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callState === 'in_call' ? (
            // In call controls
            <View style={styles.callControls}>
              <TouchableOpacity 
                style={[styles.controlButton, isMuted && styles.controlButtonActive]} 
                onPress={toggleMute}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.controlButton, isSpeaker && styles.controlButtonActive]} 
                onPress={toggleSpeaker}
              >
                <Ionicons name={isSpeaker ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Calling/Connecting - only end button
            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Connection indicator */}
        {remoteJoined && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlı</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    paddingTop: 60,
  },
  header: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarContainer: {
    marginTop: 80,
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },
  debugContainer: {
    position: 'absolute',
    bottom: 200,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
    maxHeight: 150,
  },
  debugText: {
    color: '#0f0',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '80%',
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
    backgroundColor: '#4361ee',
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedBadge: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});
