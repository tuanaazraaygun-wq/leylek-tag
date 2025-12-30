/**
 * CallScreenV2 - Sesli/Görüntülü Arama Ekranı
 * 
 * CRITICAL FIXES:
 * 1. VIDEO CALL - Permission & Media
 * 2. DRIVER SIDE CALL - Instant ringing
 * 3. RECONNECT - Singleton engine, no destroy
 * 4. END CALL - Unified cleanup, close map
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngineEventHandler,
  RtcSurfaceView,
  VideoSourceType,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';

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
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onClose: () => void;
  callAccepted?: boolean;
  callRejected?: boolean;
  callEnded?: boolean;
  receiverOffline?: boolean;
}

// ==================== SINGLETON ENGINE ====================
let globalEngine: IRtcEngine | null = null;
let engineInitialized = false;
let activeCallId: string | null = null; // Concurrent call guard

// ==================== PERMISSION CHECK (CACHED) ====================
let permissionsGranted = false;

const requestPermissionsOnce = async (callType: 'audio' | 'video'): Promise<boolean> => {
  if (permissionsGranted) {
    console.log('📞 Permissions already granted (cached)');
    return true;
  }

  if (Platform.OS === 'android') {
    try {
      const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (callType === 'video') {
        permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      
      const audioOk = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 
                     PermissionsAndroid.RESULTS.GRANTED;
      const cameraOk = callType === 'audio' || 
                      granted[PermissionsAndroid.PERMISSIONS.CAMERA] === 
                      PermissionsAndroid.RESULTS.GRANTED;
      
      console.log(`📞 Permissions: audio=${audioOk}, camera=${cameraOk}`);
      
      if (audioOk && cameraOk) {
        permissionsGranted = true;
        return true;
      }
      return false;
    } catch (err) {
      console.error('📞 Permission error:', err);
      return false;
    }
  }
  
  permissionsGranted = true;
  return true;
};

// ==================== GET/INIT SINGLETON ENGINE ====================
const getOrCreateEngine = async (callType: 'audio' | 'video'): Promise<IRtcEngine | null> => {
  // Return existing engine if initialized
  if (engineInitialized && globalEngine) {
    console.log('📞 Using existing Agora engine (singleton)');
    
    // Enable video if needed and not already enabled
    if (callType === 'video') {
      globalEngine.enableVideo();
      globalEngine.startPreview();
    }
    
    return globalEngine;
  }

  console.log('📞 Creating new Agora engine...');

  try {
    const engine = createAgoraRtcEngine();
    
    engine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });

    // Audio setup - ALWAYS
    engine.enableAudio();
    engine.setDefaultAudioRouteToSpeakerphone(true);
    engine.setEnableSpeakerphone(true);
    
    // Video setup - ONLY for video calls
    if (callType === 'video') {
      engine.enableVideo();
      engine.startPreview();
    }
    
    engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

    globalEngine = engine;
    engineInitialized = true;
    
    console.log('📞 ✅ Agora engine created successfully');
    return engine;
  } catch (error) {
    console.error('📞 ❌ Engine creation failed:', error);
    return null;
  }
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
  
  // ==================== STATE ====================
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(callType === 'video');
  
  // Refs
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isInChannel = useRef(false);
  const callStartTime = useRef<number>(0);
  const isCleaningUp = useRef(false);

  // ==================== TIMER ====================
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

  // ==================== RINGTONE ====================
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

  // ==================== UNIFIED END CALL (FIX #4) ====================
  const handleEndCall = useCallback(async () => {
    if (isCleaningUp.current) {
      console.log('📞 Already cleaning up, skip');
      return;
    }
    isCleaningUp.current = true;

    console.log('📞 ======= END CALL START =======');
    
    // 1. Stop timers & ringtone
    stopRingtone();
    stopDurationTimer();
    
    // 2. Update state
    setCallState('ended');
    
    // 3. Leave Agora channel (DO NOT DESTROY ENGINE - FIX #3)
    if (isInChannel.current && globalEngine) {
      console.log('📞 Leaving Agora channel...');
      try {
        globalEngine.leaveChannel();
      } catch (e) {
        console.log('📞 Leave channel error (ignored):', e);
      }
      isInChannel.current = false;
    }
    
    // 4. Clear active call guard
    activeCallId = null;
    
    // 5. Notify via socket (signal only)
    onEnd();
    
    // 6. Close call screen AND trigger map close (FIX #4)
    console.log('📞 Closing call screen...');
    setTimeout(() => {
      isCleaningUp.current = false;
      onClose(); // This should also close map screen
    }, 500);
    
    console.log('📞 ======= END CALL COMPLETE =======');
  }, [onEnd, onClose, stopRingtone, stopDurationTimer]);

  // ==================== JOIN CHANNEL (IDENTICAL FOR BOTH ROLES - FIX #2) ====================
  const joinChannelNow = useCallback(async () => {
    // Concurrent call guard (FIX #3)
    if (activeCallId && activeCallId !== callId) {
      console.log('📞 ⚠️ Another call is active, ignoring');
      return;
    }
    
    if (isInChannel.current) {
      console.log('📞 Already in channel');
      return;
    }

    console.log('📞 ======= JOIN CHANNEL START =======');
    console.log(`📞 Channel: ${channelName}, CallType: ${callType}`);
    
    // Set active call guard
    activeCallId = callId;
    callStartTime.current = Date.now();

    // 1. Check permissions FIRST (FIX #1)
    const hasPermissions = await requestPermissionsOnce(callType);
    if (!hasPermissions) {
      console.log('📞 ❌ Permissions not granted!');
      Alert.alert('İzin Gerekli', 'Arama için mikrofon izni gerekli.');
      handleEndCall();
      return;
    }

    // 2. Get or create engine (singleton - FIX #3)
    const engine = await getOrCreateEngine(callType);
    if (!engine) {
      console.log('📞 ❌ Engine not available!');
      handleEndCall();
      return;
    }

    // 3. Register event handlers
    const eventHandler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (connection, elapsed) => {
        const joinTime = Date.now() - callStartTime.current;
        console.log(`📞 ✅ onJoinChannelSuccess - channel: ${connection.channelId}, time: ${joinTime}ms`);
        isInChannel.current = true;
      },
      onUserJoined: (connection, uid, elapsed) => {
        const totalTime = Date.now() - callStartTime.current;
        console.log(`📞 👤 onUserJoined - uid: ${uid}, totalTime: ${totalTime}ms`);
        setRemoteJoined(true);
        setRemoteUid(uid);
        setCallState('in_call');
        startDurationTimer();
        stopRingtone();
      },
      onUserOffline: (connection, uid, reason) => {
        console.log(`📞 👤 onUserOffline - uid: ${uid}, reason: ${reason}`);
        setRemoteJoined(false);
        setRemoteUid(null);
        // Remote user left - end call (FIX #4)
        handleEndCall();
      },
      onLeaveChannel: (connection, stats) => {
        console.log(`📞 📴 onLeaveChannel`);
        isInChannel.current = false;
      },
      onError: (err, msg) => {
        console.error(`📞 ❌ Agora error: ${err} - ${msg}`);
      },
    };

    engine.registerEventHandler(eventHandler);

    // 4. Enable video if needed (FIX #1)
    if (callType === 'video') {
      console.log('📞 Enabling video...');
      engine.enableVideo();
      engine.startPreview();
    }

    // 5. JOIN CHANNEL IMMEDIATELY
    const uid = Math.floor(Math.random() * 100000);
    console.log(`📞 🚀 Joining channel NOW: ${channelName}, uid: ${uid}`);

    try {
      engine.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });
      console.log('📞 ✅ joinChannel called successfully');
    } catch (error) {
      console.error('📞 ❌ joinChannel error:', error);
      handleEndCall();
    }

    console.log('📞 ======= JOIN CHANNEL END =======');
  }, [callId, channelName, agoraToken, callType, handleEndCall, startDurationTimer, stopRingtone]);

  // ==================== ACCEPT CALL (RECEIVER) ====================
  const handleAcceptCall = useCallback(async () => {
    console.log('📞 ✅ ACCEPT pressed');
    setCallState('connecting');
    stopRingtone();
    
    // Signal via socket
    onAccept();
    
    // JOIN CHANNEL IMMEDIATELY (FIX #2 - identical to caller)
    await joinChannelNow();
  }, [onAccept, joinChannelNow, stopRingtone]);

  // ==================== REJECT CALL (RECEIVER) ====================
  const handleRejectCall = useCallback(() => {
    console.log('📞 ❌ REJECT pressed');
    setCallState('ended');
    stopRingtone();
    onReject();
    activeCallId = null;
    setTimeout(() => onClose(), 300);
  }, [onReject, onClose, stopRingtone]);

  // ==================== CONTROLS ====================
  const toggleMute = useCallback(() => {
    if (globalEngine) {
      globalEngine.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    if (globalEngine) {
      globalEngine.setEnableSpeakerphone(!isSpeaker);
      setIsSpeaker(!isSpeaker);
    }
  }, [isSpeaker]);

  const toggleCamera = useCallback(() => {
    if (globalEngine && callType === 'video') {
      globalEngine.muteLocalVideoStream(localVideoEnabled);
      setLocalVideoEnabled(!localVideoEnabled);
    }
  }, [callType, localVideoEnabled]);

  const switchCamera = useCallback(() => {
    if (globalEngine && callType === 'video') {
      globalEngine.switchCamera();
    }
  }, [callType]);

  // ==================== MAIN EFFECT ====================
  useEffect(() => {
    if (!visible || !callId) return;

    // Concurrent call guard
    if (activeCallId && activeCallId !== callId) {
      console.log('📞 Another call active, ignoring this one');
      return;
    }

    console.log(`📞 ======= CALL SCREEN OPEN =======`);
    console.log(`📞 Mode: ${mode}, CallId: ${callId}, CallType: ${callType}`);

    // Reset state
    isCleaningUp.current = false;
    setCallState('idle');
    setDuration(0);
    setRemoteJoined(false);
    setRemoteUid(null);

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // ==================== CALLER FLOW (FIX #2) ====================
      console.log('📞 CALLER: Starting call...');
      setCallState('calling');
      
      // JOIN CHANNEL IMMEDIATELY - no waiting!
      joinChannelNow();

      // Timeout after 45 seconds
      ringtoneTimeoutRef.current = setTimeout(() => {
        console.log('📞 ⏱️ Timeout - no answer');
        handleEndCall();
      }, 45000);

    } else {
      // ==================== RECEIVER FLOW ====================
      console.log('📞 RECEIVER: Incoming call...');
      setCallState('ringing');
      playRingtone();

      // Timeout after 45 seconds
      ringtoneTimeoutRef.current = setTimeout(() => {
        console.log('📞 ⏱️ Timeout - auto reject');
        handleRejectCall();
      }, 45000);
    }

    return () => {
      console.log('📞 CallScreen cleanup');
      stopRingtone();
      stopDurationTimer();
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ==================== EXTERNAL STATUS UPDATES ====================
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      console.log('📞 External: callAccepted');
      // Caller already in channel, waiting for onUserJoined
    }
  }, [callAccepted, mode]);

  useEffect(() => {
    if (callRejected) {
      console.log('📞 External: callRejected');
      handleEndCall();
    }
  }, [callRejected, handleEndCall]);

  useEffect(() => {
    if (callEnded) {
      console.log('📞 External: callEnded');
      handleEndCall();
    }
  }, [callEnded, handleEndCall]);

  useEffect(() => {
    if (receiverOffline) {
      console.log('📞 External: receiverOffline');
      handleEndCall();
    }
  }, [receiverOffline, handleEndCall]);

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
        {/* Video Views */}
        {callType === 'video' && callState === 'in_call' && (
          <>
            {/* Remote Video (Full Screen) */}
            {remoteUid && (
              <RtcSurfaceView
                style={styles.remoteVideo}
                canvas={{ uid: remoteUid }}
              />
            )}
            {/* Local Video (Small) */}
            {localVideoEnabled && (
              <View style={styles.localVideoContainer}>
                <RtcSurfaceView
                  style={styles.localVideo}
                  canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
                />
              </View>
            )}
          </>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: 
            callState === 'in_call' ? 'rgba(76,175,80,0.3)' : 
            callState === 'ended' ? 'rgba(244,67,54,0.3)' : 'rgba(255,193,7,0.3)' 
          }]}>
            <View style={[styles.statusDot, { backgroundColor: 
              callState === 'in_call' ? '#4CAF50' : 
              callState === 'ended' ? '#f44336' : '#FFC107' 
            }]} />
            <Text style={styles.statusBadgeText}>{callState.toUpperCase()}</Text>
          </View>
        </View>

        {/* Avatar (hide during video call) */}
        {!(callType === 'video' && callState === 'in_call') && (
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={60} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.statusText}>{getStatusText()}</Text>

        {/* Connection indicator */}
        {remoteJoined && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {callState === 'ringing' && mode === 'receiver' ? (
            // Incoming call buttons
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

              {callType === 'video' && (
                <TouchableOpacity 
                  style={[styles.controlButton, !localVideoEnabled && styles.controlButtonActive]} 
                  onPress={toggleCamera}
                >
                  <Ionicons name={localVideoEnabled ? "videocam" : "videocam-off"} size={24} color="#fff" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>

              {callType === 'video' && (
                <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                  <Ionicons name="camera-reverse" size={24} color="#fff" />
                </TouchableOpacity>
              )}

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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    borderColor: '#fff',
  },
  localVideo: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
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
    width: '90%',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
});
