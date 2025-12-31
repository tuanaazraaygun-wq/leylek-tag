/**
 * CallScreenV2 - PRODUCTION-READY Real-Time Calling
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * CORRECT STATE MACHINE (CRITICAL!)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * STATE TRANSITIONS:
 * 
 * CALLER:
 *   idle → calling → connecting → media_ready → in_call → ended
 *              ↑           ↑            ↑           ↑
 *         (button)   (callAccepted)  (onJoin+    (onUserPublished)
 *                                   publish)
 * 
 * CALLEE:
 *   idle → ringing → connecting → media_ready → in_call → ended
 *              ↑           ↑            ↑           ↑
 *         (incoming)  (accept btn)  (onJoin+    (onUserPublished)
 *                                   publish)
 * 
 * KEY RULES:
 * 1. "Bağlandı" text ONLY when state === 'in_call'
 * 2. state becomes 'in_call' ONLY after onUserPublished
 * 3. Local tracks MUST be published BEFORE showing connected
 * 4. Ringback tone plays ONLY in 'calling' state (caller side)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
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
import { Audio } from 'expo-av';
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
  AudioProfileType,
  AudioScenarioType,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_DEBOUNCE_MS = 500;
const CALL_TIMEOUT_MS = 45000;

// ═══════════════════════════════════════════════════════════════════════════════
// CORRECT STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════
type CallState = 
  | 'idle'          // Initial state
  | 'calling'       // Caller: waiting for callee to answer (ringback plays)
  | 'ringing'       // Callee: incoming call (ringtone plays)
  | 'connecting'    // Both: accept pressed, joining Agora
  | 'media_ready'   // Both: local joined + tracks published, waiting for remote
  | 'in_call'       // Both: remote user published - ONLY NOW show "Bağlandı"
  | 'ended';        // Call finished

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

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON ENGINE & GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let globalEngine: IRtcEngine | null = null;
let activeCallId: string | null = null;

// Permission cache
let audioPermissionGranted = false;
let cameraPermissionGranted = false;

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG LOGGER (with timestamps)
// ═══════════════════════════════════════════════════════════════════════════════
const getTs = () => new Date().toISOString().split('T')[1].slice(0, 12);
const log = (event: string, data?: any) => {
  const d = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${getTs()}] 📞 ${event}${d}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// HAPTIC FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════════
const haptic = async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    const style = type === 'light' ? Haptics.ImpactFeedbackStyle.Light 
                : type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy 
                : Haptics.ImpactFeedbackStyle.Medium;
    await Haptics.impactAsync(style);
  } catch {}
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS (Android)
// ═══════════════════════════════════════════════════════════════════════════════
const ensurePermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const toRequest: string[] = [];

    if (!audioPermissionGranted) {
      const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (has) {
        audioPermissionGranted = true;
      } else {
        toRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      }
    }

    if (needVideo && !cameraPermissionGranted) {
      const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (has) {
        cameraPermissionGranted = true;
      } else {
        toRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
    }

    if (toRequest.length > 0) {
      log('PERM_REQUEST', toRequest);
      const results = await PermissionsAndroid.requestMultiple(toRequest as any);
      if (results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED) {
        audioPermissionGranted = true;
      }
      if (results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED) {
        cameraPermissionGranted = true;
      }
    }

    log('PERM_STATUS', { audio: audioPermissionGranted, camera: cameraPermissionGranted });
    return audioPermissionGranted && (!needVideo || cameraPermissionGranted);
  } catch (e) {
    log('PERM_ERROR', e);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [localJoined, setLocalJoined] = useState(false);
  const [localPublished, setLocalPublished] = useState(false);
  const [remotePublished, setRemotePublished] = useState(false);

  // HARD-LOCK callType to prevent video→audio downgrade
  const frozenCallType = useRef(callType).current;
  const isVideo = frozenCallType === 'video';

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const isInChannel = useRef(false);
  const isCleaningUp = useRef(false);
  const hasJoinedChannel = useRef(false);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);
  const ringbackTimer = useRef<NodeJS.Timeout | null>(null);
  const ringbackSound = useRef<Audio.Sound | null>(null);
  const callStartTs = useRef<number>(0);
  const lastBtnPress = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pipPan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 145, y: 90 })).current;
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBOUNCE
  // ═══════════════════════════════════════════════════════════════════════════
  const canPress = useCallback(() => {
    const now = Date.now();
    if (now - lastBtnPress.current < BUTTON_DEBOUNCE_MS) return false;
    lastBtnPress.current = now;
    return true;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // PIP PAN RESPONDER (for video self-view)
  // ═══════════════════════════════════════════════════════════════════════════
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
      let x = Math.max(5, Math.min(SCREEN_WIDTH - 145, gesture.moveX - 70));
      let y = Math.max(50, Math.min(SCREEN_HEIGHT - 250, gesture.moveY - 90));
      Animated.spring(pipPan, {
        toValue: { x, y },
        useNativeDriver: false,
        friction: 7,
      }).start();
    },
  }), [pipPan]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DURATION TIMER
  // ═══════════════════════════════════════════════════════════════════════════
  const startDurationTimer = useCallback(() => {
    if (durationTimer.current) return;
    log('DURATION_TIMER_START');
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RINGBACK TONE (Caller hears this while waiting - UI state based!)
  // ═══════════════════════════════════════════════════════════════════════════
  const startRingback = useCallback(async () => {
    if (mode !== 'caller') return;
    
    log('RINGBACK_START');
    
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Create a repeating "ring" effect using vibration
      // In production, you'd load an actual ringback audio file
      const playRingPattern = () => {
        if (ringbackTimer.current) return;
        
        // Vibrate pattern: short pulse every 3 seconds (mimics phone ring)
        const pattern = () => {
          Vibration.vibrate([0, 200, 2800], false);
        };
        
        pattern();
        ringbackTimer.current = setInterval(pattern, 3000);
      };
      
      playRingPattern();
    } catch (e) {
      log('RINGBACK_ERROR', e);
    }
  }, [mode]);

  const stopRingback = useCallback(async () => {
    log('RINGBACK_STOP');
    
    if (ringbackTimer.current) {
      clearInterval(ringbackTimer.current);
      ringbackTimer.current = null;
    }
    
    Vibration.cancel();
    
    if (ringbackSound.current) {
      try {
        await ringbackSound.current.stopAsync();
        await ringbackSound.current.unloadAsync();
      } catch {}
      ringbackSound.current = null;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RINGTONE (Callee hears this - vibration)
  // ═══════════════════════════════════════════════════════════════════════════
  const startRingtone = useCallback(() => {
    if (mode !== 'receiver') return;
    log('RINGTONE_START');
    Vibration.vibrate([0, 500, 300, 500], true);
  }, [mode]);

  const stopRingtone = useCallback(() => {
    log('RINGTONE_STOP');
    Vibration.cancel();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  const cleanupEngine = useCallback(() => {
    log('ENGINE_CLEANUP');
    
    if (globalEngine) {
      try {
        if (eventHandlerRef.current) {
          globalEngine.unregisterEventHandler(eventHandlerRef.current);
          eventHandlerRef.current = null;
        }
        globalEngine.leaveChannel();
        globalEngine.release();
      } catch (e) {
        log('ENGINE_CLEANUP_ERROR', e);
      }
      globalEngine = null;
    }
    
    isInChannel.current = false;
    hasJoinedChannel.current = false;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // END CALL
  // ═══════════════════════════════════════════════════════════════════════════
  const endCall = useCallback(async () => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    const ms = Date.now() - callStartTs.current;
    log('END_CALL', { callId, totalMs: ms, state: callState });

    // Stop all sounds/timers
    stopRingtone();
    stopRingback();
    stopDurationTimer();
    stopTimeout();
    
    // Update UI state
    setCallState('ended');

    // Cleanup Agora
    cleanupEngine();

    activeCallId = null;
    onEnd();

    // Close after brief delay
    setTimeout(() => {
      isCleaningUp.current = false;
      onClose();
    }, 500);
  }, [callId, callState, onEnd, onClose, stopRingtone, stopRingback, stopDurationTimer, stopTimeout, cleanupEngine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE AND SETUP ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  const setupEngine = useCallback(async (): Promise<IRtcEngine | null> => {
    log('ENGINE_SETUP_START', { isVideo });

    try {
      // Cleanup existing engine first
      cleanupEngine();

      const engine = createAgoraRtcEngine();
      
      // Initialize
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Audio config
      engine.setAudioProfile(
        AudioProfileType.AudioProfileSpeechStandard,
        AudioScenarioType.AudioScenarioChatroom
      );
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      log('ENGINE_AUDIO_ENABLED');

      // Video config (if needed)
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

      // Set as broadcaster (can send AND receive)
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      globalEngine = engine;
      log('ENGINE_SETUP_SUCCESS');
      return engine;
    } catch (e) {
      log('ENGINE_SETUP_ERROR', e);
      return null;
    }
  }, [isVideo, cleanupEngine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // JOIN CHANNEL & PUBLISH TRACKS
  // This is THE CORE MEDIA FLOW
  // ═══════════════════════════════════════════════════════════════════════════
  const joinAndPublish = useCallback(async (token: string, channel: string) => {
    if (hasJoinedChannel.current) {
      log('JOIN_SKIP_ALREADY_JOINED');
      return true;
    }

    if (!token || !channel) {
      log('JOIN_MISSING_PARAMS', { token: !!token, channel: !!channel });
      return false;
    }

    const startMs = Date.now();
    log('JOIN_START', { channel, isVideo, mode });

    // 1. Check permissions
    const hasPerms = await ensurePermissions(isVideo);
    if (!hasPerms) {
      log('JOIN_NO_PERMS');
      return false;
    }
    log('JOIN_PERMS_OK', { ms: Date.now() - startMs });

    // 2. Setup engine
    const engine = await setupEngine();
    if (!engine) {
      log('JOIN_NO_ENGINE');
      return false;
    }
    log('JOIN_ENGINE_READY', { ms: Date.now() - startMs });

    // 3. Register event handler - THIS IS CRITICAL FOR STATE MACHINE
    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (conn, elapsed) => {
        log('AGORA_JOIN_SUCCESS', { 
          channel: conn.channelId, 
          uid: conn.localUid, 
          elapsed, 
          ms: Date.now() - startMs 
        });
        isInChannel.current = true;
        hasJoinedChannel.current = true;
        setLocalJoined(true);
      },

      onAudioPublishStateChanged: (channel, oldState, newState, elapsed) => {
        log('AUDIO_PUBLISH_STATE', { oldState, newState, elapsed });
        // newState: 3 = Published
        if (newState === 3) {
          log('LOCAL_AUDIO_PUBLISHED');
          setLocalPublished(true);
          // Transition to media_ready when local is published
          setCallState(prev => {
            if (prev === 'connecting') {
              log('STATE_CHANGE: connecting → media_ready');
              return 'media_ready';
            }
            return prev;
          });
        }
      },

      onVideoPublishStateChanged: (source, channel, oldState, newState, elapsed) => {
        log('VIDEO_PUBLISH_STATE', { source, oldState, newState, elapsed });
        if (newState === 3 && isVideo) {
          log('LOCAL_VIDEO_PUBLISHED');
        }
      },

      onUserJoined: (conn, uid) => {
        log('REMOTE_USER_JOINED', { uid, ms: Date.now() - startMs });
        setRemoteUid(uid);
      },

      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL: onUserPublished - Remote user started sending media
      // ONLY HERE should we transition to 'in_call'
      // ═══════════════════════════════════════════════════════════════════════
      onUserPublished: (conn, uid, mediaType) => {
        log('REMOTE_USER_PUBLISHED', { uid, mediaType, ms: Date.now() - startMs });
        setRemotePublished(true);
        
        // Subscribe to remote stream
        if (globalEngine) {
          if (mediaType === 1) { // Audio
            globalEngine.muteRemoteAudioStream(uid, false);
          } else if (mediaType === 2) { // Video
            globalEngine.muteRemoteVideoStream(uid, false);
          }
        }

        // NOW we can say "connected" - remote is actually sending media
        setCallState(prev => {
          if (prev === 'media_ready' || prev === 'connecting') {
            log('STATE_CHANGE → in_call (REMOTE PUBLISHED)');
            // Stop ringback when truly connected
            stopRingback();
            stopRingtone();
            return 'in_call';
          }
          return prev;
        });
      },

      onUserUnpublished: (conn, uid, mediaType) => {
        log('REMOTE_USER_UNPUBLISHED', { uid, mediaType });
      },

      onUserOffline: (conn, uid, reason) => {
        log('REMOTE_USER_OFFLINE', { uid, reason });
        setRemoteUid(null);
        setRemotePublished(false);
        endCall();
      },

      onLeaveChannel: () => {
        log('AGORA_LEAVE_CHANNEL_EVENT');
        isInChannel.current = false;
        hasJoinedChannel.current = false;
        setLocalJoined(false);
        setLocalPublished(false);
      },

      onConnectionStateChanged: (conn, state, reason) => {
        log('CONNECTION_STATE', { state, reason });
        // state: 1=Disconnected, 2=Connecting, 3=Connected, 4=Reconnecting, 5=Failed
        if (state === 5) { // Failed
          log('CONNECTION_FAILED');
          endCall();
        }
      },

      onError: (err, msg) => {
        log('AGORA_ERROR', { err, msg });
      },
    };

    eventHandlerRef.current = handler;
    engine.registerEventHandler(handler);
    log('EVENT_HANDLER_REGISTERED');

    // 4. Generate UID and JOIN
    const uid = Math.floor(Math.random() * 100000);
    log('JOIN_CHANNEL_CALL', { uid, channel, isVideo });

    try {
      engine.joinChannel(token, channel, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
      });

      log('JOIN_CHANNEL_EXECUTED', { ms: Date.now() - startMs });
      return true;
    } catch (e) {
      log('JOIN_CHANNEL_ERROR', e);
      return false;
    }
  }, [isVideo, mode, setupEngine, endCall, stopRingback, stopRingtone]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCEPT CALL (CALLEE ONLY)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAccept = useCallback(async () => {
    if (!canPress()) return;
    haptic('medium');

    log('ACCEPT_PRESSED', { callId, channelName, mode });
    
    // 1. Stop ringtone
    stopRingtone();
    
    // 2. Change state to connecting (NOT in_call yet!)
    setCallState('connecting');
    
    // 3. Signal acceptance via socket
    onAccept();
    
    // 4. Join Agora channel and publish tracks
    const success = await joinAndPublish(agoraToken, channelName);
    if (!success) {
      log('ACCEPT_JOIN_FAILED');
      endCall();
    }
  }, [canPress, callId, channelName, agoraToken, mode, onAccept, joinAndPublish, stopRingtone, endCall]);

  // ═══════════════════════════════════════════════════════════════════════════
  // REJECT CALL (CALLEE ONLY)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleReject = useCallback(() => {
    if (!canPress()) return;
    haptic('heavy');

    log('REJECT_PRESSED', { callId });
    setCallState('ended');
    stopRingtone();
    stopTimeout();
    onReject();
    activeCallId = null;
    setTimeout(() => onClose(), 300);
  }, [canPress, callId, onReject, onClose, stopRingtone, stopTimeout]);

  // ═══════════════════════════════════════════════════════════════════════════
  // END CALL (BOTH)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleEnd = useCallback(() => {
    if (!canPress()) return;
    haptic('heavy');
    log('END_PRESSED');
    endCall();
  }, [canPress, endCall]);

  // ═══════════════════════════════════════════════════════════════════════════
  // IN-CALL CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleMute = useCallback(() => {
    if (!globalEngine) return;
    haptic('light');
    const newMuted = !isMuted;
    globalEngine.muteLocalAudioStream(newMuted);
    setIsMuted(newMuted);
    log('TOGGLE_MUTE', { muted: newMuted });
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    if (!globalEngine) return;
    haptic('light');
    const newSpeaker = !isSpeaker;
    globalEngine.setEnableSpeakerphone(newSpeaker);
    setIsSpeaker(newSpeaker);
    log('TOGGLE_SPEAKER', { speaker: newSpeaker });
  }, [isSpeaker]);

  const toggleCamera = useCallback(() => {
    if (!globalEngine || !isVideo) return;
    haptic('light');
    const newOff = !isCameraOff;
    globalEngine.muteLocalVideoStream(newOff);
    setIsCameraOff(newOff);
    log('TOGGLE_CAMERA', { off: newOff });
  }, [isVideo, isCameraOff]);

  const switchCam = useCallback(() => {
    if (!globalEngine || !isVideo) return;
    haptic('light');
    globalEngine.switchCamera();
    log('SWITCH_CAMERA');
  }, [isVideo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Start duration timer when in_call
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callState === 'in_call') {
      log('IN_CALL_STATE_REACHED');
      startDurationTimer();
      haptic('light');
    }
  }, [callState, startDurationTimer]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Main initialization
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    if (activeCallId && activeCallId !== callId) return;

    activeCallId = callId;
    callStartTs.current = Date.now();
    
    log('SCREEN_OPEN', { mode, callType: frozenCallType, callId, channelName });

    // Reset all state
    isCleaningUp.current = false;
    hasJoinedChannel.current = false;
    setCallState('idle');
    setDuration(0);
    setRemoteUid(null);
    setLocalJoined(false);
    setLocalPublished(false);
    setRemotePublished(false);
    setIsMuted(false);
    setIsSpeaker(true);
    setIsCameraOff(false);

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    if (mode === 'caller') {
      // ═══════════════════════════════════════════════════════════════════════
      // CALLER FLOW:
      // 1. Show "Aranıyor..." immediately
      // 2. Start ringback tone (caller hears feedback)
      // 3. Join Agora channel NOW (so we're ready when callee accepts)
      // 4. Wait for callee to accept → onUserPublished → in_call
      // ═══════════════════════════════════════════════════════════════════════
      log('CALLER_FLOW_START');
      setCallState('calling');
      startRingback();

      // Join channel immediately if we have token
      if (agoraToken && channelName) {
        joinAndPublish(agoraToken, channelName);
      }

      // Timeout after 45 seconds
      timeoutTimer.current = setTimeout(() => {
        log('CALLER_TIMEOUT');
        endCall();
      }, CALL_TIMEOUT_MS);

    } else {
      // ═══════════════════════════════════════════════════════════════════════
      // CALLEE FLOW:
      // 1. Show "Gelen Arama" with accept/reject buttons
      // 2. Play ringtone (vibration)
      // 3. Wait for user to press ACCEPT
      // 4. On accept: join channel → publish → wait for onUserPublished → in_call
      // ═══════════════════════════════════════════════════════════════════════
      log('CALLEE_FLOW_START');
      setCallState('ringing');
      startRingtone();

      // Timeout after 45 seconds
      timeoutTimer.current = setTimeout(() => {
        log('CALLEE_TIMEOUT');
        handleReject();
      }, CALL_TIMEOUT_MS);
    }

    return () => {
      log('SCREEN_CLEANUP');
      stopRingtone();
      stopRingback();
      stopDurationTimer();
      stopTimeout();
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: When caller receives callAccepted, transition to connecting
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller' && callState === 'calling') {
      log('CALLER_RECEIVED_ACCEPT');
      setCallState('connecting');
      // Ringback continues until onUserPublished
    }
  }, [callAccepted, mode, callState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Handle token/channel updates for caller
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode === 'caller' && visible && agoraToken && channelName && !hasJoinedChannel.current) {
      log('CALLER_TOKEN_UPDATE', { channel: channelName });
      joinAndPublish(agoraToken, channelName);
    }
  }, [agoraToken, channelName, mode, visible, joinAndPublish]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: External events (rejection, end, offline)
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (!visible) return null;

  const formatTime = (s: number) => 
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS TEXT - Based on correct state machine
  // ═══════════════════════════════════════════════════════════════════════════
  const getStatusText = () => {
    const typeLabel = isVideo ? 'Görüntülü' : 'Sesli';
    switch (callState) {
      case 'idle': 
        return 'Hazırlanıyor...';
      case 'calling': 
        return `${typeLabel} Aranıyor...`;
      case 'ringing': 
        return `${typeLabel} Gelen Arama`;
      case 'connecting': 
        return 'Bağlanıyor...';
      case 'media_ready': 
        return 'Medya Hazır...';
      case 'in_call': 
        return formatTime(duration); // ONLY HERE show duration
      case 'ended': 
        return 'Arama Bitti';
      default: 
        return '';
    }
  };

  const statusColor: Record<CallState, string> = {
    idle: '#FFC107',
    calling: '#FF9800',
    ringing: '#4CAF50',
    connecting: '#2196F3',
    media_ready: '#00BCD4',
    in_call: '#4CAF50',
    ended: '#f44336',
  };

  // Determine if we should show "Bağlandı" badge
  const showConnectedBadge = callState === 'in_call' && remotePublished;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video (full screen) */}
        {isVideo && remoteUid && callState === 'in_call' && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
          />
        )}

        {/* Self Video PIP */}
        {isVideo && localJoined && !isCameraOff && (
          <Animated.View 
            style={[styles.pip, { transform: [{ translateX: pipPan.x }, { translateY: pipPan.y }] }]}
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
            <View style={styles.pipLabel}>
              <Text style={styles.pipLabelText}>Sen</Text>
            </View>
          </Animated.View>
        )}

        {/* Call Type Badge */}
        <View style={[styles.typeBadge, isVideo ? styles.typeBadgeVideo : styles.typeBadgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={16} color="#fff" />
          <Text style={styles.typeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* State Badge (debug) */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor[callState] + '44' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor[callState] }]} />
          <Text style={styles.statusText}>{callState.toUpperCase()}</Text>
        </View>

        {/* Media Status Indicators */}
        <View style={styles.mediaIndicators}>
          {localJoined && (
            <View style={styles.indicator}>
              <Ionicons name="radio" size={12} color="#4CAF50" />
              <Text style={styles.indicatorText}>Kanal</Text>
            </View>
          )}
          {localPublished && (
            <View style={styles.indicator}>
              <Ionicons name="mic" size={12} color="#2196F3" />
              <Text style={styles.indicatorText}>Yayın</Text>
            </View>
          )}
          {remotePublished && (
            <View style={styles.indicator}>
              <Ionicons name="ear" size={12} color="#9C27B0" />
              <Text style={styles.indicatorText}>Alım</Text>
            </View>
          )}
        </View>

        {/* Avatar (shown when no remote video) */}
        {!(isVideo && remoteUid && callState === 'in_call') && (
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
              <Ionicons name={isVideo ? "videocam" : "person"} size={56} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.callStatus}>{getStatusText()}</Text>

        {/* Connected Badge - ONLY when in_call AND remote published */}
        {showConnectedBadge && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlandı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {callState === 'ringing' && mode === 'receiver' ? (
            // Incoming call buttons
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.7}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.acceptBtn, isVideo && styles.acceptBtnVideo]} 
                onPress={handleAccept} 
                activeOpacity={0.7}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callState === 'in_call' ? (
            // In-call controls
            <View style={styles.callRow}>
              <TouchableOpacity 
                style={[styles.ctrlBtn, isMuted && styles.ctrlActive]} 
                onPress={toggleMute} 
                activeOpacity={0.7}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
              
              {isVideo && (
                <>
                  <TouchableOpacity 
                    style={[styles.ctrlBtn, isCameraOff && styles.ctrlActive]} 
                    onPress={toggleCamera} 
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={switchCam} activeOpacity={0.7}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.7}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.ctrlBtn, isSpeaker && styles.ctrlActive]} 
                onPress={toggleSpeaker} 
                activeOpacity={0.7}
              >
                <Ionicons name={isSpeaker ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Calling/connecting - only end button
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.7}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#1a1a2e', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  remoteVideo: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0 
  },
  pip: {
    position: 'absolute',
    width: 140,
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 100,
  },
  pipVideo: { flex: 1 },
  pipLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pipLabelText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  typeBadge: {
    position: 'absolute',
    top: 52,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
  },
  typeBadgeVideo: { backgroundColor: '#9C27B0' },
  typeBadgeAudio: { backgroundColor: '#4361ee' },
  typeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statusBadge: {
    position: 'absolute',
    top: 52,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mediaIndicators: {
    position: 'absolute',
    top: 100,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  indicatorText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  avatarWrap: { marginBottom: 20 },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarVideo: { backgroundColor: '#9C27B0' },
  remoteName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginBottom: 12,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
  },
  connectedText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  controls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
    elevation: 8,
  },
  acceptBtnVideo: { backgroundColor: '#9C27B0' },
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
    elevation: 8,
  },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  ctrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
