/**
 * CallScreenV2 - Production-Grade Real-Time Calling
 * 
 * ARCHITECTURE:
 * - Agora: Handles ALL media (audio/video)
 * - Socket: ONLY signaling (ring/accept/reject/end)
 * - Call start: < 300ms
 * 
 * STATE MACHINE:
 * idle → calling → ringing → connecting → in_call → ended
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  PanResponder,
  Dimensions,
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
  RenderModeType,
  VideoMirrorModeType,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==================== CALL STATE MACHINE ====================
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
let engineReady = false;
let activeCallId: string | null = null;

// ==================== PERMISSION CACHE ====================
let audioPermissionGranted = false;
let cameraPermissionGranted = false;

// ==================== DEBUG LOGGER ====================
const log = (tag: string, message: string, data?: any) => {
  const ts = new Date().toISOString().split('T')[1].slice(0, 12);
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${ts}] 📞 ${tag}: ${message}${dataStr}`);
};

// ==================== PERMISSIONS (CACHED) ====================
const checkAndRequestPermissions = async (needCamera: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // Check what we need
    const permissionsToRequest: string[] = [];
    
    // Audio - always needed
    if (!audioPermissionGranted) {
      const audioStatus = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (audioStatus) {
        audioPermissionGranted = true;
        log('PERM', 'Audio already granted (cached)');
      } else {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      }
    }

    // Camera - only for video
    if (needCamera && !cameraPermissionGranted) {
      const cameraStatus = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      if (cameraStatus) {
        cameraPermissionGranted = true;
        log('PERM', 'Camera already granted (cached)');
      } else {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
    }

    // Request if needed
    if (permissionsToRequest.length > 0) {
      log('PERM', 'Requesting permissions', permissionsToRequest);
      const results = await PermissionsAndroid.requestMultiple(
        permissionsToRequest as any
      );

      // Check results
      if (results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 
          PermissionsAndroid.RESULTS.GRANTED) {
        audioPermissionGranted = true;
      }
      if (results[PermissionsAndroid.PERMISSIONS.CAMERA] === 
          PermissionsAndroid.RESULTS.GRANTED) {
        cameraPermissionGranted = true;
      }
    }

    // Final check
    const audioOk = audioPermissionGranted;
    const cameraOk = !needCamera || cameraPermissionGranted;
    
    log('PERM', 'Permission status', { audioOk, cameraOk });
    return audioOk && cameraOk;

  } catch (error) {
    log('PERM', 'Permission error', error);
    return false;
  }
};

// ==================== ENGINE MANAGEMENT ====================
const getEngine = async (isVideo: boolean): Promise<IRtcEngine | null> => {
  if (engineReady && globalEngine) {
    log('ENGINE', 'Using existing engine (singleton)');
    
    // Enable video if needed
    if (isVideo) {
      globalEngine.enableVideo();
      globalEngine.startPreview();
    }
    return globalEngine;
  }

  log('ENGINE', 'Creating new engine...');
  
  try {
    const engine = createAgoraRtcEngine();
    
    engine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });

    // Audio setup
    engine.enableAudio();
    engine.setDefaultAudioRouteToSpeakerphone(true);
    engine.setEnableSpeakerphone(true);
    
    // Video setup
    if (isVideo) {
      engine.enableVideo();
      // Fix mirrored/inverted self-view
      engine.setVideoEncoderConfiguration({
        dimensions: { width: 480, height: 640 },
        frameRate: 15,
        bitrate: 400,
        mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      });
      engine.startPreview();
    }
    
    engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

    globalEngine = engine;
    engineReady = true;
    
    log('ENGINE', '✅ Engine created successfully');
    return engine;
  } catch (error) {
    log('ENGINE', '❌ Failed to create engine', error);
    return null;
  }
};

// ==================== MAIN COMPONENT ====================
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
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  
  // PIP position for self-view
  const [pipPosition, setPipPosition] = useState({ x: SCREEN_WIDTH - 130, y: 60 });
  const pipPan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 130, y: 60 })).current;
  
  // Refs
  const isInChannel = useRef(false);
  const isCleaningUp = useRef(false);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);
  const callStartTs = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ==================== PIP PAN RESPONDER ====================
  const pipPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pipPan.setOffset({
        x: (pipPan.x as any)._value,
        y: (pipPan.y as any)._value,
      });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pipPan.x, dy: pipPan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_, gesture) => {
      pipPan.flattenOffset();
      // Snap to edges
      let newX = gesture.moveX - 60;
      let newY = gesture.moveY - 80;
      
      // Boundaries
      newX = Math.max(10, Math.min(SCREEN_WIDTH - 130, newX));
      newY = Math.max(50, Math.min(SCREEN_HEIGHT - 200, newY));
      
      Animated.spring(pipPan, {
        toValue: { x: newX, y: newY },
        useNativeDriver: false,
        friction: 7,
      }).start();
    },
  }), []);

  // ==================== TIMERS ====================
  const startDurationTimer = useCallback(() => {
    if (durationTimer.current) return;
    log('TIMER', 'Duration timer started');
    durationTimer.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
  }, []);

  const stopTimeout = useCallback(() => {
    if (timeoutTimer.current) {
      clearTimeout(timeoutTimer.current);
      timeoutTimer.current = null;
    }
  }, []);

  // ==================== RINGTONE ====================
  const startRingtone = useCallback(() => {
    if (mode === 'receiver') {
      Vibration.vibrate([0, 500, 300, 500], true);
    }
  }, [mode]);

  const stopRingtone = useCallback(() => {
    Vibration.cancel();
  }, []);

  // ==================== END CALL (UNIFIED) ====================
  const endCall = useCallback(async () => {
    if (isCleaningUp.current) {
      log('END', 'Already cleaning up');
      return;
    }
    isCleaningUp.current = true;

    const totalTime = Date.now() - callStartTs.current;
    log('END', `======= END CALL (${totalTime}ms total) =======`);

    // 1. Stop everything
    stopRingtone();
    stopDurationTimer();
    stopTimeout();
    setCallState('ended');

    // 2. Leave Agora
    if (isInChannel.current && globalEngine) {
      log('END', 'Leaving Agora channel');
      try {
        globalEngine.leaveChannel();
      } catch (e) {
        log('END', 'Leave error (ignored)', e);
      }
      isInChannel.current = false;
    }

    // 3. Clear active call
    activeCallId = null;

    // 4. Signal via socket
    onEnd();

    // 5. Close UI
    log('END', 'Closing call screen');
    setTimeout(() => {
      isCleaningUp.current = false;
      onClose();
    }, 500);
  }, [onEnd, onClose, stopRingtone, stopDurationTimer, stopTimeout]);

  // ==================== JOIN CHANNEL (INSTANT) ====================
  const joinChannel = useCallback(async () => {
    // Guard against multiple joins
    if (activeCallId && activeCallId !== callId) {
      log('JOIN', '⚠️ Another call active');
      return false;
    }
    
    if (isInChannel.current) {
      log('JOIN', '⚠️ Already in channel');
      return true;
    }

    const joinStartTs = Date.now();
    callStartTs.current = joinStartTs;
    activeCallId = callId;

    log('JOIN', `======= JOIN START =======`);
    log('JOIN', `Channel: ${channelName}, Type: ${callType}`);

    // 1. Check permissions (cached = instant if already granted)
    const hasPermissions = await checkAndRequestPermissions(callType === 'video');
    if (!hasPermissions) {
      log('JOIN', '❌ Permissions denied');
      endCall();
      return false;
    }

    // 2. Get engine (singleton = instant if already created)
    const engine = await getEngine(callType === 'video');
    if (!engine) {
      log('JOIN', '❌ No engine');
      endCall();
      return false;
    }

    // 3. Register event handlers
    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (connection, elapsed) => {
        const joinTime = Date.now() - joinStartTs;
        log('AGORA', `✅ onJoinChannelSuccess | ${joinTime}ms`);
        isInChannel.current = true;
      },
      onUserJoined: (connection, uid) => {
        const userJoinTime = Date.now() - joinStartTs;
        log('AGORA', `👤 onUserJoined | uid: ${uid} | ${userJoinTime}ms`);
        setRemoteUid(uid);
        setCallState('in_call');
        startDurationTimer();
        stopRingtone();
        stopTimeout();
      },
      onUserOffline: (connection, uid, reason) => {
        log('AGORA', `👤 onUserOffline | uid: ${uid} | reason: ${reason}`);
        setRemoteUid(null);
        endCall();
      },
      onLeaveChannel: () => {
        log('AGORA', '📴 onLeaveChannel');
        isInChannel.current = false;
      },
      onError: (err, msg) => {
        log('AGORA', `❌ Error: ${err} - ${msg}`);
      },
    };

    engine.registerEventHandler(handler);

    // 4. JOIN NOW!
    const uid = Math.floor(Math.random() * 100000);
    log('JOIN', `🚀 Joining NOW | uid: ${uid}`);

    try {
      engine.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });

      const joinTime = Date.now() - joinStartTs;
      log('JOIN', `✅ joinChannel called | ${joinTime}ms`);
      return true;

    } catch (error) {
      log('JOIN', `❌ joinChannel error`, error);
      endCall();
      return false;
    }
  }, [callId, channelName, agoraToken, callType, endCall, startDurationTimer, stopRingtone, stopTimeout]);

  // ==================== ACCEPT (RECEIVER) ====================
  const handleAccept = useCallback(async () => {
    log('ACTION', '✅ ACCEPT pressed');
    setCallState('connecting');
    stopRingtone();
    onAccept(); // Signal via socket
    await joinChannel(); // Join Agora IMMEDIATELY
  }, [onAccept, joinChannel, stopRingtone]);

  // ==================== REJECT (RECEIVER) ====================
  const handleReject = useCallback(() => {
    log('ACTION', '❌ REJECT pressed');
    setCallState('ended');
    stopRingtone();
    stopTimeout();
    onReject();
    activeCallId = null;
    setTimeout(() => onClose(), 300);
  }, [onReject, onClose, stopRingtone, stopTimeout]);

  // ==================== CONTROLS ====================
  const toggleMute = useCallback(() => {
    if (globalEngine) {
      const newMute = !isMuted;
      globalEngine.muteLocalAudioStream(newMute);
      setIsMuted(newMute);
      log('CTRL', `Mute: ${newMute}`);
    }
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    if (globalEngine) {
      const newSpeaker = !isSpeaker;
      globalEngine.setEnableSpeakerphone(newSpeaker);
      setIsSpeaker(newSpeaker);
      log('CTRL', `Speaker: ${newSpeaker}`);
    }
  }, [isSpeaker]);

  const toggleCamera = useCallback(() => {
    if (globalEngine && callType === 'video') {
      const newOff = !isCameraOff;
      globalEngine.muteLocalVideoStream(newOff);
      setIsCameraOff(newOff);
      log('CTRL', `Camera off: ${newOff}`);
    }
  }, [callType, isCameraOff]);

  const switchCamera = useCallback(() => {
    if (globalEngine && callType === 'video') {
      globalEngine.switchCamera();
      log('CTRL', 'Camera switched');
    }
  }, [callType]);

  // ==================== MAIN EFFECT ====================
  useEffect(() => {
    if (!visible || !callId) return;

    // Guard against duplicate calls
    if (activeCallId && activeCallId !== callId) {
      log('INIT', '⚠️ Another call active, ignoring');
      return;
    }

    log('INIT', `======= CALL SCREEN OPEN =======`);
    log('INIT', `Mode: ${mode} | CallType: ${callType} | CallId: ${callId}`);

    // Reset state
    isCleaningUp.current = false;
    setCallState('idle');
    setDuration(0);
    setRemoteUid(null);
    setIsMuted(false);
    setIsSpeaker(true);
    setIsCameraOff(false);

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // === CALLER: Join IMMEDIATELY ===
      log('INIT', '🚀 CALLER: Starting call...');
      setCallState('calling');
      joinChannel();

      // Timeout 45s
      timeoutTimer.current = setTimeout(() => {
        log('TIMEOUT', '⏱️ No answer after 45s');
        endCall();
      }, 45000);

    } else {
      // === RECEIVER: Wait for accept ===
      log('INIT', '🔔 RECEIVER: Incoming call...');
      setCallState('ringing');
      startRingtone();

      // Timeout 45s
      timeoutTimer.current = setTimeout(() => {
        log('TIMEOUT', '⏱️ Auto-reject after 45s');
        handleReject();
      }, 45000);
    }

    return () => {
      log('CLEANUP', 'CallScreen cleanup');
      stopRingtone();
      stopDurationTimer();
      stopTimeout();
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ==================== EXTERNAL STATUS ====================
  useEffect(() => {
    if (callRejected) {
      log('EXT', 'Call rejected');
      endCall();
    }
  }, [callRejected, endCall]);

  useEffect(() => {
    if (callEnded) {
      log('EXT', 'Call ended externally');
      endCall();
    }
  }, [callEnded, endCall]);

  useEffect(() => {
    if (receiverOffline) {
      log('EXT', 'Receiver offline');
      endCall();
    }
  }, [receiverOffline, endCall]);

  // ==================== RENDER ====================
  if (!visible) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const statusText = {
    idle: 'Hazırlanıyor...',
    calling: 'Aranıyor...',
    ringing: 'Gelen Arama',
    connecting: 'Bağlanıyor...',
    in_call: formatTime(duration),
    ended: 'Arama Bitti',
  }[callState];

  const statusColor = {
    idle: '#FFC107',
    calling: '#FFC107',
    ringing: '#4CAF50',
    connecting: '#2196F3',
    in_call: '#4CAF50',
    ended: '#f44336',
  }[callState];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video (Full Screen) */}
        {callType === 'video' && remoteUid && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ 
              uid: remoteUid,
              renderMode: RenderModeType.RenderModeHidden,
            }}
          />
        )}

        {/* Local Video PIP (Draggable) */}
        {callType === 'video' && callState === 'in_call' && !isCameraOff && (
          <Animated.View 
            style={[
              styles.pipContainer,
              { transform: [{ translateX: pipPan.x }, { translateY: pipPan.y }] }
            ]}
            {...pipPanResponder.panHandlers}
          >
            <RtcSurfaceView
              style={styles.pipVideo}
              canvas={{ 
                uid: 0, 
                sourceType: VideoSourceType.VideoSourceCamera,
                renderMode: RenderModeType.RenderModeHidden,
                mirrorMode: VideoMirrorModeType.VideoMirrorModeEnabled,
              }}
            />
          </Animated.View>
        )}

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '33' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusBadgeText}>{callState.toUpperCase()}</Text>
        </View>

        {/* Avatar (hide during video call) */}
        {!(callType === 'video' && remoteUid) && (
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={60} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.statusText}>{statusText}</Text>

        {/* Connected Badge */}
        {remoteUid && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {callState === 'ringing' && mode === 'receiver' ? (
            // Incoming call
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Ionicons name="call" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callState === 'in_call' ? (
            // In call
            <View style={styles.callRow}>
              <TouchableOpacity 
                style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} 
                onPress={toggleMute}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>

              {callType === 'video' && (
                <>
                  <TouchableOpacity 
                    style={[styles.ctrlBtn, isCameraOff && styles.ctrlBtnActive]} 
                    onPress={toggleCamera}
                  >
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.endBtn} onPress={endCall}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.ctrlBtn, isSpeaker && styles.ctrlBtnActive]} 
                onPress={toggleSpeaker}
              >
                <Ionicons name={isSpeaker ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Calling/Connecting
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
  pipContainer: {
    position: 'absolute',
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pipVideo: {
    flex: 1,
  },
  statusBadge: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  avatarWrap: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  remoteName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statusText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '70%',
  },
  callRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  ctrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlBtnActive: {
    backgroundColor: '#4361ee',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  rejectBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  endBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    marginHorizontal: 12,
  },
});
