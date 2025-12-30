/**
 * CallScreenV2 - PRODUCTION-READY Real-Time Calling
 * 
 * CRITICAL FIXES:
 * 1. Call start < 300ms (NO socket waiting)
 * 2. Video never downgrades to voice
 * 3. Draggable PIP with proper mirroring
 * 4. Button debouncing + haptic feedback
 * 5. Proper end/reject logic
 * 6. Scalable architecture (Agora = media, Socket = signal only)
 * 7. Comprehensive timestamp logging
 * 
 * STATE MACHINE: idle → calling → ringing → connecting → in_call → ended
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
import * as Haptics from 'expo-haptics';
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

// Debounce time for buttons (ms)
const BUTTON_DEBOUNCE_MS = 500;

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
  callType: 'audio' | 'video'; // LOCKED - never changes
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

// ==================== TIMESTAMP LOGGER ====================
const LOG_PREFIX = '📞 CALL';
const getTimestamp = () => {
  const now = new Date();
  return `${now.toISOString().split('T')[1].slice(0, 12)}`;
};

const log = (event: string, data?: any) => {
  const ts = getTimestamp();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${ts}] ${LOG_PREFIX} ${event}${dataStr}`);
};

// ==================== HAPTIC FEEDBACK ====================
const hapticFeedback = async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    if (type === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (type === 'heavy') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch (e) {
    // Haptics not available
  }
};

// ==================== PERMISSIONS (PRE-CACHED) ====================
const ensurePermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const toRequest: string[] = [];

    // Check audio
    if (!audioPermissionGranted) {
      const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (hasAudio) {
        audioPermissionGranted = true;
        log('PERM_AUDIO_CACHED');
      } else {
        toRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      }
    }

    // Check camera (only for video)
    if (needVideo && !cameraPermissionGranted) {
      const hasCam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (hasCam) {
        cameraPermissionGranted = true;
        log('PERM_CAMERA_CACHED');
      } else {
        toRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
    }

    // Request missing permissions
    if (toRequest.length > 0) {
      log('PERM_REQUESTING', toRequest);
      const results = await PermissionsAndroid.requestMultiple(toRequest as any);
      
      if (results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED) {
        audioPermissionGranted = true;
      }
      if (results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED) {
        cameraPermissionGranted = true;
      }
    }

    const ok = audioPermissionGranted && (!needVideo || cameraPermissionGranted);
    log('PERM_RESULT', { audio: audioPermissionGranted, camera: cameraPermissionGranted, ok });
    return ok;
  } catch (e) {
    log('PERM_ERROR', e);
    return false;
  }
};

// ==================== ENGINE (SINGLETON) ====================
const getOrCreateEngine = async (isVideo: boolean): Promise<IRtcEngine | null> => {
  if (engineReady && globalEngine) {
    log('ENGINE_REUSE');
    if (isVideo) {
      globalEngine.enableVideo();
      globalEngine.startPreview();
      log('ENGINE_VIDEO_ENABLED');
    }
    return globalEngine;
  }

  log('ENGINE_CREATING');
  try {
    const engine = createAgoraRtcEngine();
    
    engine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });

    // Audio - always
    engine.enableAudio();
    engine.setDefaultAudioRouteToSpeakerphone(true);
    engine.setEnableSpeakerphone(true);
    log('ENGINE_AUDIO_ENABLED');

    // Video - only if needed
    if (isVideo) {
      engine.enableVideo();
      engine.setVideoEncoderConfiguration({
        dimensions: { width: 480, height: 640 },
        frameRate: 15,
        bitrate: 400,
        mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
      });
      engine.startPreview();
      log('ENGINE_VIDEO_ENABLED');
    }

    engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

    globalEngine = engine;
    engineReady = true;
    log('ENGINE_CREATED_OK');
    return engine;
  } catch (e) {
    log('ENGINE_ERROR', e);
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
  callType, // LOCKED - voice or video, never changes
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
  const [showSelfView, setShowSelfView] = useState(true);

  // Refs
  const isInChannel = useRef(false);
  const isCleaningUp = useRef(false);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);
  const callStartTs = useRef<number>(0);
  const lastButtonPress = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // PIP position
  const pipPan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 140, y: 80 })).current;

  // ==================== DEBOUNCE ====================
  const canPressButton = useCallback(() => {
    const now = Date.now();
    if (now - lastButtonPress.current < BUTTON_DEBOUNCE_MS) {
      log('BUTTON_DEBOUNCED');
      return false;
    }
    lastButtonPress.current = now;
    return true;
  }, []);

  // ==================== BUTTON ANIMATION ====================
  const animateButtonPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.9, duration: 50, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [buttonScale]);

  // ==================== PIP PAN RESPONDER ====================
  const pipPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pipPan.setOffset({
        x: (pipPan.x as any)._value || 0,
        y: (pipPan.y as any)._value || 0,
      });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pipPan.x, dy: pipPan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_, gesture) => {
      pipPan.flattenOffset();
      // Snap to boundaries
      let x = Math.max(10, Math.min(SCREEN_WIDTH - 140, gesture.moveX - 60));
      let y = Math.max(60, Math.min(SCREEN_HEIGHT - 220, gesture.moveY - 90));
      Animated.spring(pipPan, {
        toValue: { x, y },
        useNativeDriver: false,
        friction: 8,
      }).start();
    },
  }), [pipPan]);

  // ==================== TIMERS ====================
  const startDurationTimer = useCallback(() => {
    if (durationTimer.current) return;
    log('TIMER_START');
    durationTimer.current = setInterval(() => setDuration(d => d + 1), 1000);
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

  // ==================== END CALL ====================
  const endCall = useCallback(async () => {
    if (isCleaningUp.current) {
      log('END_ALREADY_CLEANING');
      return;
    }
    isCleaningUp.current = true;

    const totalMs = Date.now() - callStartTs.current;
    log('END_CALL_START', { totalMs, callId });

    stopRingtone();
    stopDurationTimer();
    stopTimeout();
    setCallState('ended');

    // Leave Agora
    if (isInChannel.current && globalEngine) {
      log('END_LEAVE_CHANNEL');
      try {
        globalEngine.leaveChannel();
      } catch (e) {
        log('END_LEAVE_ERROR', e);
      }
      isInChannel.current = false;
    }

    activeCallId = null;
    onEnd();
    log('END_CALL_COMPLETE');

    setTimeout(() => {
      isCleaningUp.current = false;
      onClose();
    }, 400);
  }, [callId, onEnd, onClose, stopRingtone, stopDurationTimer, stopTimeout]);

  // ==================== JOIN CHANNEL (INSTANT - NO BLOCKING) ====================
  const joinChannelNow = useCallback(async () => {
    if (activeCallId && activeCallId !== callId) {
      log('JOIN_BLOCKED_OTHER_CALL');
      return false;
    }
    if (isInChannel.current) {
      log('JOIN_ALREADY_IN_CHANNEL');
      return true;
    }

    const startMs = Date.now();
    callStartTs.current = startMs;
    activeCallId = callId;

    log('JOIN_START', { callId, channelName, callType });

    // 1. Permissions (cached = instant)
    const isVideo = callType === 'video';
    const hasPerms = await ensurePermissions(isVideo);
    if (!hasPerms) {
      log('JOIN_NO_PERMS');
      endCall();
      return false;
    }
    log('JOIN_PERMS_OK', { ms: Date.now() - startMs });

    // 2. Engine (singleton = instant)
    const engine = await getOrCreateEngine(isVideo);
    if (!engine) {
      log('JOIN_NO_ENGINE');
      endCall();
      return false;
    }
    log('JOIN_ENGINE_OK', { ms: Date.now() - startMs });

    // 3. Event handlers
    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (conn, elapsed) => {
        const ms = Date.now() - startMs;
        log('AGORA_JOIN_SUCCESS', { channel: conn.channelId, ms, elapsed });
        isInChannel.current = true;
      },
      onUserJoined: (conn, uid) => {
        const ms = Date.now() - startMs;
        log('AGORA_USER_JOINED', { uid, ms });
        setRemoteUid(uid);
        setCallState('in_call');
        startDurationTimer();
        stopRingtone();
        stopTimeout();
        hapticFeedback('light');
      },
      onUserOffline: (conn, uid, reason) => {
        log('AGORA_USER_OFFLINE', { uid, reason });
        setRemoteUid(null);
        endCall();
      },
      onLeaveChannel: () => {
        log('AGORA_LEAVE_CHANNEL');
        isInChannel.current = false;
      },
      onError: (err, msg) => {
        log('AGORA_ERROR', { err, msg });
      },
      onRemoteVideoStateChanged: (conn, uid, state, reason) => {
        log('AGORA_REMOTE_VIDEO_STATE', { uid, state, reason });
      },
      onLocalVideoStateChanged: (source, state, error) => {
        log('AGORA_LOCAL_VIDEO_STATE', { source, state, error });
      },
    };
    engine.registerEventHandler(handler);

    // 4. JOIN NOW (no waiting!)
    const uid = Math.floor(Math.random() * 100000);
    log('JOIN_CHANNEL_NOW', { uid, isVideo });

    try {
      engine.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo, // ENFORCED: video only if callType === 'video'
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo, // ENFORCED: video only if callType === 'video'
      });

      const joinMs = Date.now() - startMs;
      log('JOIN_CHANNEL_CALLED', { ms: joinMs });
      return true;
    } catch (e) {
      log('JOIN_ERROR', e);
      endCall();
      return false;
    }
  }, [callId, channelName, agoraToken, callType, endCall, startDurationTimer, stopRingtone, stopTimeout]);

  // ==================== ACCEPT (RECEIVER) ====================
  const handleAccept = useCallback(async () => {
    if (!canPressButton()) return;
    hapticFeedback('medium');
    animateButtonPress();
    
    log('ACCEPT_PRESSED');
    setCallState('connecting');
    stopRingtone();
    onAccept();
    await joinChannelNow();
  }, [canPressButton, animateButtonPress, onAccept, joinChannelNow, stopRingtone]);

  // ==================== REJECT (RECEIVER) ====================
  const handleReject = useCallback(() => {
    if (!canPressButton()) return;
    hapticFeedback('heavy');
    animateButtonPress();

    log('REJECT_PRESSED');
    setCallState('ended');
    stopRingtone();
    stopTimeout();
    onReject();
    activeCallId = null;
    setTimeout(() => onClose(), 300);
  }, [canPressButton, animateButtonPress, onReject, onClose, stopRingtone, stopTimeout]);

  // ==================== END (BOTH) ====================
  const handleEnd = useCallback(() => {
    if (!canPressButton()) return;
    hapticFeedback('heavy');
    animateButtonPress();
    
    log('END_PRESSED');
    endCall();
  }, [canPressButton, animateButtonPress, endCall]);

  // ==================== CONTROLS ====================
  const toggleMute = useCallback(() => {
    if (!globalEngine) return;
    hapticFeedback('light');
    const newVal = !isMuted;
    globalEngine.muteLocalAudioStream(newVal);
    setIsMuted(newVal);
    log('TOGGLE_MUTE', { muted: newVal });
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    if (!globalEngine) return;
    hapticFeedback('light');
    const newVal = !isSpeaker;
    globalEngine.setEnableSpeakerphone(newVal);
    setIsSpeaker(newVal);
    log('TOGGLE_SPEAKER', { speaker: newVal });
  }, [isSpeaker]);

  const toggleCamera = useCallback(() => {
    if (!globalEngine || callType !== 'video') return;
    hapticFeedback('light');
    const newVal = !isCameraOff;
    globalEngine.muteLocalVideoStream(newVal);
    setIsCameraOff(newVal);
    log('TOGGLE_CAMERA', { off: newVal });
  }, [callType, isCameraOff]);

  const switchCamera = useCallback(() => {
    if (!globalEngine || callType !== 'video') return;
    hapticFeedback('light');
    globalEngine.switchCamera();
    log('SWITCH_CAMERA');
  }, [callType]);

  // ==================== MAIN EFFECT ====================
  useEffect(() => {
    if (!visible || !callId) return;

    if (activeCallId && activeCallId !== callId) {
      log('INIT_BLOCKED_OTHER_CALL');
      return;
    }

    log('SCREEN_OPEN', { mode, callType, callId });

    // Reset
    isCleaningUp.current = false;
    setCallState('idle');
    setDuration(0);
    setRemoteUid(null);
    setIsMuted(false);
    setIsSpeaker(true);
    setIsCameraOff(false);
    setShowSelfView(true);

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      log('CALLER_START');
      setCallState('calling');
      // JOIN IMMEDIATELY - no waiting!
      joinChannelNow();

      timeoutTimer.current = setTimeout(() => {
        log('CALLER_TIMEOUT_45S');
        endCall();
      }, 45000);
    } else {
      log('RECEIVER_START');
      setCallState('ringing');
      startRingtone();

      timeoutTimer.current = setTimeout(() => {
        log('RECEIVER_TIMEOUT_45S');
        handleReject();
      }, 45000);
    }

    return () => {
      log('SCREEN_CLEANUP');
      stopRingtone();
      stopDurationTimer();
      stopTimeout();
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ==================== EXTERNAL EVENTS ====================
  useEffect(() => {
    if (callRejected) {
      log('EXT_REJECTED');
      endCall();
    }
  }, [callRejected, endCall]);

  useEffect(() => {
    if (callEnded) {
      log('EXT_ENDED');
      endCall();
    }
  }, [callEnded, endCall]);

  useEffect(() => {
    if (receiverOffline) {
      log('EXT_OFFLINE');
      endCall();
    }
  }, [receiverOffline, endCall]);

  // ==================== RENDER ====================
  if (!visible) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Status text with call type
  const getStatusText = () => {
    const isVideo = callType === 'video';
    switch (callState) {
      case 'idle': return 'Hazırlanıyor...';
      case 'calling': return isVideo ? 'Video Aranıyor...' : 'Sesli Aranıyor...';
      case 'ringing': return isVideo ? 'Video Gelen Arama' : 'Sesli Gelen Arama';
      case 'connecting': return 'Bağlanıyor...';
      case 'in_call': return formatTime(duration);
      case 'ended': return 'Arama Bitti';
      default: return '';
    }
  };

  const statusColor = {
    idle: '#FFC107',
    calling: '#FF9800',
    ringing: '#4CAF50',
    connecting: '#2196F3',
    in_call: '#4CAF50',
    ended: '#f44336',
  }[callState];

  const isVideo = callType === 'video';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video (Full Screen) */}
        {isVideo && remoteUid && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ 
              uid: remoteUid,
              renderMode: RenderModeType.RenderModeHidden,
            }}
          />
        )}

        {/* Self Video PIP (Draggable) - Always visible in video call */}
        {isVideo && showSelfView && !isCameraOff && (
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
            {/* PIP close button */}
            <TouchableOpacity 
              style={styles.pipClose}
              onPress={() => setShowSelfView(false)}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Show self view button if hidden */}
        {isVideo && !showSelfView && (
          <TouchableOpacity 
            style={styles.showPipBtn}
            onPress={() => setShowSelfView(true)}
          >
            <Ionicons name="person" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Call Type Badge */}
        <View style={styles.callTypeBadge}>
          <Ionicons 
            name={isVideo ? "videocam" : "call"} 
            size={16} 
            color="#fff" 
          />
          <Text style={styles.callTypeText}>
            {isVideo ? 'Video' : 'Sesli'}
          </Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusBadgeText}>{callState.toUpperCase()}</Text>
        </View>

        {/* Avatar (hide during video call with remote) */}
        {!(isVideo && remoteUid) && (
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
              <Ionicons name={isVideo ? "videocam" : "person"} size={60} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.statusText}>{getStatusText()}</Text>

        {/* Connected indicator */}
        {remoteUid && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlandı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {callState === 'ringing' && mode === 'receiver' ? (
            // Incoming call
            <View style={styles.incomingRow}>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity 
                  style={styles.rejectBtn} 
                  onPress={handleReject}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={32} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity 
                  style={[styles.acceptBtn, isVideo && styles.acceptBtnVideo]} 
                  onPress={handleAccept}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : callState === 'in_call' ? (
            // In call
            <View style={styles.callRow}>
              <TouchableOpacity 
                style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} 
                onPress={toggleMute}
                activeOpacity={0.7}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>

              {isVideo && (
                <>
                  <TouchableOpacity 
                    style={[styles.ctrlBtn, isCameraOff && styles.ctrlBtnActive]} 
                    onPress={toggleCamera}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.ctrlBtn} 
                    onPress={switchCamera}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity 
                style={styles.endBtn} 
                onPress={handleEnd}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.ctrlBtn, isSpeaker && styles.ctrlBtnActive]} 
                onPress={toggleSpeaker}
                activeOpacity={0.7}
              >
                <Ionicons name={isSpeaker ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Calling/Connecting
            <TouchableOpacity 
              style={styles.endBtn} 
              onPress={handleEnd}
              activeOpacity={0.7}
            >
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
    width: 130,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    backgroundColor: '#000',
  },
  pipVideo: {
    flex: 1,
  },
  pipClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showPipBtn: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callTypeBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(67, 97, 238, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  avatarVideo: {
    backgroundColor: '#9C27B0',
    shadowColor: '#9C27B0',
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
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.25)',
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
    gap: 14,
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
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptBtnVideo: {
    backgroundColor: '#9C27B0',
    shadowColor: '#9C27B0',
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
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
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
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    marginHorizontal: 10,
  },
});
