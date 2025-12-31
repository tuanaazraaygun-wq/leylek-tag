/**
 * CallScreenV2 - FINAL PRODUCTION VERSION
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * CALL STATE MACHINE (FINAL - MANDATORY)
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * STATES:
 *   IDLE → RINGING → ACCEPTED → CONNECTING → CONNECTED → ENDED
 * 
 * KEY RULE:
 *   CONNECTED state is driven by SOCKET SIGNALING, NOT by media tracks!
 * 
 * CALLER FLOW:
 *   1. Press call → state = CALLING, emit call_invite, start ringback
 *   2. Receive callAccepted → state = CONNECTED, stop ringback
 *   3. RTC media runs in parallel (doesn't block state)
 * 
 * CALLEE FLOW:
 *   1. Receive incoming_call → state = RINGING, play ringtone
 *   2. Press Accept → emit call_accepted, state = CONNECTED
 *   3. RTC media runs in parallel (doesn't block state)
 * 
 * SAFETY:
 *   - Max 1s timeout after RTC join → force CONNECTED
 *   - Never infinite "Bağlanıyor..."
 * 
 * ════════════════════════════════════════════════════════════════════════════════
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
  Dimensions,
  Animated,
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
  AudioProfileType,
  AudioScenarioType,
  ConnectionStateType,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TIMEOUTS
const CONNECT_TIMEOUT_MS = 10000;  // 10s max for entire connection
const FORCE_CONNECTED_MS = 1000;  // Force CONNECTED after 1s if RTC joined

// ════════════════════════════════════════════════════════════════════════════════
// CALL STATES (CLEAR & FINAL)
// ════════════════════════════════════════════════════════════════════════════════
type CallState = 
  | 'calling'      // Caller: Waiting for callee to answer
  | 'ringing'      // Callee: Incoming call
  | 'accepted'     // Callee pressed accept, transitioning
  | 'connecting'   // RTC handshake in progress
  | 'connected'    // CALL ACTIVE - show duration timer
  | 'ended'        // Call finished
  | 'error';       // Error state

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

// ════════════════════════════════════════════════════════════════════════════════
// LOGGING (MANDATORY)
// ════════════════════════════════════════════════════════════════════════════════
const getTs = () => new Date().toISOString().split('T')[1].slice(0, 12);
const log = (event: string, data?: any) => {
  const d = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${getTs()}] 📞 ${event}${d}`);
};

// ════════════════════════════════════════════════════════════════════════════════
// HAPTIC
// ════════════════════════════════════════════════════════════════════════════════
const haptic = async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    const style = type === 'light' ? Haptics.ImpactFeedbackStyle.Light 
                : type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy 
                : Haptics.ImpactFeedbackStyle.Medium;
    await Haptics.impactAsync(style);
  } catch {}
};

// ════════════════════════════════════════════════════════════════════════════════
// PERMISSION
// ════════════════════════════════════════════════════════════════════════════════
const requestPermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (needVideo) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);

    log('PERMISSION_REQUEST', { needVideo });
    const results = await PermissionsAndroid.requestMultiple(permissions as any);
    
    const audioOK = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
    const cameraOK = !needVideo || results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';
    
    log('PERMISSION_RESULT', { audioOK, cameraOK });
    return audioOK && cameraOK;
  } catch (e) {
    log('PERMISSION_ERROR', { error: String(e) });
    return false;
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
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
  
  // ══════════════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════════════
  const [callState, setCallState] = useState<CallState>(mode === 'caller' ? 'calling' : 'ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // RTC internal state (not for UI decisions)
  const [rtcJoined, setRtcJoined] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);

  const isVideo = useRef(callType === 'video').current;

  // ══════════════════════════════════════════════════════════════════════════════
  // REFS
  // ══════════════════════════════════════════════════════════════════════════════
  const engineRef = useRef<IRtcEngine | null>(null);
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const localUid = useRef<number>(Math.floor(Math.random() * 100000) + 1);
  const callStartTs = useRef<number>(Date.now());
  
  // Timers
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceConnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Lifecycle flags
  const isJoining = useRef(false);
  const hasJoined = useRef(false);
  const isCleaningUp = useRef(false);

  // ══════════════════════════════════════════════════════════════════════════════
  // TRANSITION TO CONNECTED (CENTRAL FUNCTION)
  // ══════════════════════════════════════════════════════════════════════════════
  const transitionToConnected = useCallback(() => {
    if (callState === 'connected' || callState === 'ended' || callState === 'error') {
      return;
    }
    
    log('STATE_TRANSITION_TO_CONNECTED', { 
      from: callState, 
      ms: Date.now() - callStartTs.current 
    });
    
    setCallState('connected');
    
    // Stop ringback/ringtone
    Vibration.cancel();
    if (ringbackTimerRef.current) {
      clearInterval(ringbackTimerRef.current);
      ringbackTimerRef.current = null;
    }
    
    // Clear force connected timer
    if (forceConnectedTimerRef.current) {
      clearTimeout(forceConnectedTimerRef.current);
      forceConnectedTimerRef.current = null;
    }
    
    // Clear connect timeout
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    
    // Start duration timer
    if (!durationTimerRef.current) {
      log('DURATION_TIMER_START');
      durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    
    haptic('light');
  }, [callState]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RINGBACK (Caller hears while waiting)
  // ══════════════════════════════════════════════════════════════════════════════
  const startRingback = useCallback(() => {
    if (mode !== 'caller') return;
    if (ringbackTimerRef.current) return;
    
    log('RINGBACK_START');
    
    const playPattern = () => {
      Vibration.vibrate([0, 200, 200, 200], false);
    };
    
    playPattern();
    ringbackTimerRef.current = setInterval(playPattern, 3000);
  }, [mode]);

  const stopRingback = useCallback(() => {
    if (ringbackTimerRef.current) {
      clearInterval(ringbackTimerRef.current);
      ringbackTimerRef.current = null;
    }
    Vibration.cancel();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // RINGTONE (Callee hears)
  // ══════════════════════════════════════════════════════════════════════════════
  const startRingtone = useCallback(() => {
    if (mode !== 'receiver') return;
    log('RINGTONE_START');
    Vibration.vibrate([0, 500, 300, 500], true);
  }, [mode]);

  const stopRingtone = useCallback(() => {
    Vibration.cancel();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // CLEAR ALL TIMERS
  // ══════════════════════════════════════════════════════════════════════════════
  const clearAllTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (ringbackTimerRef.current) {
      clearInterval(ringbackTimerRef.current);
      ringbackTimerRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (forceConnectedTimerRef.current) {
      clearTimeout(forceConnectedTimerRef.current);
      forceConnectedTimerRef.current = null;
    }
    Vibration.cancel();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════════
  const cleanup = useCallback(async () => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    log('CLEANUP_START');
    clearAllTimers();

    if (engineRef.current) {
      try {
        if (eventHandlerRef.current) {
          engineRef.current.unregisterEventHandler(eventHandlerRef.current);
          eventHandlerRef.current = null;
        }
        await engineRef.current.leaveChannel();
        log('AGORA_LEAVE_CHANNEL');
        engineRef.current.release();
        log('AGORA_ENGINE_RELEASED');
        engineRef.current = null;
      } catch (e) {
        log('CLEANUP_ERROR', { error: String(e) });
      }
    }

    isJoining.current = false;
    hasJoined.current = false;
    isCleaningUp.current = false;
    log('CLEANUP_DONE');
  }, [clearAllTimers]);

  // ══════════════════════════════════════════════════════════════════════════════
  // END CALL
  // ══════════════════════════════════════════════════════════════════════════════
  const endCall = useCallback(async () => {
    const totalMs = Date.now() - callStartTs.current;
    log('END_CALL', { callId, totalMs, state: callState });

    setCallState('ended');
    await cleanup();
    onEnd();
    setTimeout(() => onClose(), 300);
  }, [callId, callState, cleanup, onEnd, onClose]);

  // ══════════════════════════════════════════════════════════════════════════════
  // FAIL CALL
  // ══════════════════════════════════════════════════════════════════════════════
  const failCall = useCallback((reason: string) => {
    log('CALL_FAILED', { reason });
    setErrorMessage(reason);
    setCallState('error');
    clearAllTimers();
  }, [clearAllTimers]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RTC JOIN CHANNEL
  // ══════════════════════════════════════════════════════════════════════════════
  const joinChannel = useCallback(async (token: string, channel: string) => {
    if (isJoining.current || hasJoined.current) {
      log('JOIN_SKIP', { isJoining: isJoining.current, hasJoined: hasJoined.current });
      return;
    }

    if (!token || !channel) {
      log('JOIN_MISSING_PARAMS', { hasToken: !!token, hasChannel: !!channel });
      return;
    }

    isJoining.current = true;
    log('RTC_JOIN_START', { channel, uid: localUid.current, isVideo });

    // Permission
    const hasPermission = await requestPermissions(isVideo);
    if (!hasPermission) {
      log('PERMISSION_DENIED');
      isJoining.current = false;
      return;
    }

    // Create engine
    if (!engineRef.current) {
      try {
        log('AGORA_ENGINE_CREATE');
        const engine = createAgoraRtcEngine();
        
        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        engine.setAudioProfile(
          AudioProfileType.AudioProfileSpeechStandard,
          AudioScenarioType.AudioScenarioChatroom
        );
        engine.enableAudio();
        engine.setDefaultAudioRouteToSpeakerphone(true);
        engine.setEnableSpeakerphone(true);
        log('AGORA_AUDIO_ENABLED');

        if (isVideo) {
          engine.enableVideo();
          engine.setVideoEncoderConfiguration({
            dimensions: { width: 480, height: 640 },
            frameRate: 15,
            bitrate: 400,
            mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
          });
          engine.startPreview();
          log('AGORA_VIDEO_ENABLED');
        }

        engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

        // Event handlers
        const handler: IRtcEngineEventHandler = {
          onJoinChannelSuccess: (connection, elapsed) => {
            log('RTC_JOIN_COMPLETED', { 
              channel: connection.channelId, 
              uid: connection.localUid, 
              elapsed,
              ms: Date.now() - callStartTs.current
            });
            hasJoined.current = true;
            setRtcJoined(true);
            
            // ════════════════════════════════════════════════════════════════
            // SAFETY: Force CONNECTED after 1s if still connecting
            // ════════════════════════════════════════════════════════════════
            forceConnectedTimerRef.current = setTimeout(() => {
              log('FORCE_CONNECTED_TIMEOUT', { ms: Date.now() - callStartTs.current });
              transitionToConnected();
            }, FORCE_CONNECTED_MS);
          },

          onUserJoined: (connection, uid, elapsed) => {
            log('REMOTE_USER_JOINED', { uid, elapsed });
            setRemoteUid(uid);
            setRemoteJoined(true);
            
            // Remote joined → transition to connected
            transitionToConnected();
          },

          onUserPublished: (connection, uid, mediaType) => {
            log('REMOTE_USER_PUBLISHED', { uid, mediaType });
            
            if (engineRef.current) {
              if (mediaType === 1) {
                engineRef.current.muteRemoteAudioStream(uid, false);
              } else if (mediaType === 2) {
                engineRef.current.muteRemoteVideoStream(uid, false);
              }
            }
          },

          onUserOffline: (connection, uid, reason) => {
            log('REMOTE_USER_OFFLINE', { uid, reason });
            setRemoteUid(null);
            setRemoteJoined(false);
            endCall();
          },

          onConnectionStateChanged: (connection, state, reason) => {
            log('CONNECTION_STATE', { state, reason });
            if (state === ConnectionStateType.ConnectionStateFailed) {
              failCall('Bağlantı kurulamadı');
            }
          },

          onError: (err, msg) => {
            log('AGORA_ERROR', { err, msg });
          },

          onLeaveChannel: () => {
            log('AGORA_LEAVE_CHANNEL_EVENT');
            hasJoined.current = false;
            setRtcJoined(false);
          },
        };

        eventHandlerRef.current = handler;
        engine.registerEventHandler(handler);
        engineRef.current = engine;

      } catch (e) {
        log('ENGINE_CREATE_ERROR', { error: String(e) });
        isJoining.current = false;
        return;
      }
    }

    // Join
    try {
      log('JOIN_CHANNEL_CALL', { channel, uid: localUid.current });
      
      engineRef.current!.joinChannel(token, channel, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
      });

      log('JOIN_CHANNEL_EXECUTED');

    } catch (e) {
      log('JOIN_CHANNEL_ERROR', { error: String(e) });
      isJoining.current = false;
    }
  }, [isVideo, transitionToConnected, failCall, endCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: INITIAL SETUP ON MOUNT
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('CALL_SCREEN_OPEN', { mode, callId, channelName, hasToken: !!agoraToken, isVideo });
    callStartTs.current = Date.now();
    
    // Reset state
    setCallState(mode === 'caller' ? 'calling' : 'ringing');
    setDuration(0);
    setRtcJoined(false);
    setRemoteJoined(false);
    setRemoteUid(null);

    // Start sounds
    if (mode === 'caller') {
      startRingback();
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      startRingtone();
    }

    // Connect timeout
    connectTimeoutRef.current = setTimeout(() => {
      if (callState !== 'connected' && callState !== 'ended') {
        log('CONNECT_TIMEOUT_EXPIRED');
        failCall('Bağlantı zaman aşımı');
      }
    }, CONNECT_TIMEOUT_MS);

    // Join RTC immediately if we have token
    if (agoraToken && channelName) {
      joinChannel(agoraToken, channelName);
    }

    return () => {
      log('CALL_SCREEN_UNMOUNT');
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: TOKEN UPDATE (for caller when token arrives later)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible && agoraToken && channelName && !hasJoined.current && !isJoining.current) {
      log('TOKEN_RECEIVED_JOINING', { channel: channelName });
      joinChannel(agoraToken, channelName);
    }
  }, [visible, agoraToken, channelName, joinChannel]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CALL ACCEPTED (CALLER RECEIVES THIS)
  // ════════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('CALL_ACCEPTED_RECEIVED', { ms: Date.now() - callStartTs.current });
      
      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL: Transition to CONNECTED immediately on callAccepted
      // Do NOT wait for media tracks!
      // ═══════════════════════════════════════════════════════════════════════
      transitionToConnected();
    }
  }, [callAccepted, mode, transitionToConnected]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: EXTERNAL EVENTS
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callRejected) {
      log('CALL_REJECTED_RECEIVED');
      stopRingback();
      setCallState('ended');
      setErrorMessage('Arama reddedildi');
      setTimeout(() => {
        cleanup();
        onClose();
      }, 1500);
    }
  }, [callRejected, stopRingback, cleanup, onClose]);

  useEffect(() => {
    if (callEnded) {
      log('CALL_ENDED_RECEIVED');
      endCall();
    }
  }, [callEnded, endCall]);

  useEffect(() => {
    if (receiverOffline) {
      log('RECEIVER_OFFLINE');
      stopRingback();
      failCall('Karşı taraf çevrimdışı');
    }
  }, [receiverOffline, stopRingback, failCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CLEANUP ON UNMOUNT
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════════
  
  // ACCEPT (Callee only)
  const handleAccept = useCallback(() => {
    log('ACCEPT_PRESSED', { callId, ms: Date.now() - callStartTs.current });
    haptic('medium');
    
    stopRingtone();
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: Emit callAccepted AND transition to CONNECTED immediately
    // ═══════════════════════════════════════════════════════════════════════════
    onAccept();
    
    setCallState('accepted');
    
    // Join RTC if not already
    if (!hasJoined.current && agoraToken && channelName) {
      joinChannel(agoraToken, channelName);
    }
    
    // Transition to connected after brief moment (give socket time to deliver)
    setTimeout(() => {
      log('CALLEE_FORCE_CONNECTED');
      transitionToConnected();
    }, 500);
    
  }, [callId, agoraToken, channelName, stopRingtone, onAccept, joinChannel, transitionToConnected]);

  // REJECT (Callee only)
  const handleReject = useCallback(() => {
    log('REJECT_PRESSED', { callId });
    haptic('heavy');
    
    stopRingtone();
    setCallState('ended');
    onReject();
    setTimeout(() => onClose(), 300);
  }, [callId, stopRingtone, onReject, onClose]);

  // END (Both)
  const handleEnd = useCallback(() => {
    log('END_PRESSED');
    haptic('heavy');
    endCall();
  }, [endCall]);

  // In-call controls
  const toggleMute = useCallback(() => {
    if (!engineRef.current) return;
    haptic('light');
    const newMuted = !isMuted;
    engineRef.current.muteLocalAudioStream(newMuted);
    setIsMuted(newMuted);
    log('TOGGLE_MUTE', { muted: newMuted });
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    if (!engineRef.current) return;
    haptic('light');
    const newSpeaker = !isSpeaker;
    engineRef.current.setEnableSpeakerphone(newSpeaker);
    setIsSpeaker(newSpeaker);
    log('TOGGLE_SPEAKER', { speaker: newSpeaker });
  }, [isSpeaker]);

  const toggleCamera = useCallback(() => {
    if (!engineRef.current || !isVideo) return;
    haptic('light');
    const newOff = !isCameraOff;
    engineRef.current.muteLocalVideoStream(newOff);
    setIsCameraOff(newOff);
    log('TOGGLE_CAMERA', { off: newOff });
  }, [isVideo, isCameraOff]);

  const switchCamera = useCallback(() => {
    if (!engineRef.current || !isVideo) return;
    haptic('light');
    engineRef.current.switchCamera();
    log('SWITCH_CAMERA');
  }, [isVideo]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  if (!visible) return null;

  const formatTime = (s: number) => 
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // ════════════════════════════════════════════════════════════════════════════════
  // STATUS TEXT (CLEAR & VISIBLE)
  // ════════════════════════════════════════════════════════════════════════════════
  const getStatusText = () => {
    switch (callState) {
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
      case 'accepted': return 'Bağlanıyor...';
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return formatTime(duration);
      case 'ended': return errorMessage || 'Arama Bitti';
      case 'error': return errorMessage || 'Bağlantı kurulamadı';
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (callState) {
      case 'calling': return '#FFA500';
      case 'ringing': return '#4CAF50';
      case 'accepted': 
      case 'connecting': return '#2196F3';
      case 'connected': return '#4CAF50';
      case 'ended':
      case 'error': return '#f44336';
      default: return '#fff';
    }
  };

  const isCallActive = callState === 'connected';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video (fullscreen) */}
        {isVideo && remoteUid && isCallActive && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
          />
        )}

        {/* Local Video (PIP - always visible when video call) */}
        {isVideo && rtcJoined && !isCameraOff && (
          <View style={styles.localVideoPip}>
            <RtcSurfaceView
              style={styles.localVideoInner}
              canvas={{ 
                uid: 0, 
                sourceType: VideoSourceType.VideoSourceCamera,
                renderMode: RenderModeType.RenderModeHidden,
                mirrorMode: VideoMirrorModeType.VideoMirrorModeEnabled,
              }}
            />
            <Text style={styles.localVideoLabel}>Sen</Text>
          </View>
        )}

        {/* Call Type Badge */}
        <View style={[styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* State Badge */}
        <View style={[styles.stateBadge, { backgroundColor: getStatusColor() + '33' }]}>
          <View style={[styles.stateDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.stateText, { color: getStatusColor() }]}>
            {callState.toUpperCase()}
          </Text>
        </View>

        {/* Avatar (shown when no remote video) */}
        {!(isVideo && remoteUid && isCallActive) && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
              <Ionicons name={isVideo ? "videocam" : "person"} size={56} color="#fff" />
            </View>
          </Animated.View>
        )}

        {/* Name */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        
        {/* Status */}
        <Text style={[styles.callStatus, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>

        {/* Connected Badge */}
        {isCallActive && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlandı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {callState === 'ringing' && mode === 'receiver' ? (
            // Incoming call buttons
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#fff" />
                <Text style={styles.btnLabel}>Reddet</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.acceptBtn, isVideo && styles.acceptBtnVideo]} 
                onPress={handleAccept}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
                <Text style={styles.btnLabel}>Kabul</Text>
              </TouchableOpacity>
            </View>
          ) : isCallActive ? (
            // In-call controls
            <View style={styles.callRow}>
              <TouchableOpacity 
                style={[styles.ctrlBtn, isMuted && styles.ctrlActive]} 
                onPress={toggleMute}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
              
              {isVideo && (
                <>
                  <TouchableOpacity 
                    style={[styles.ctrlBtn, isCameraOff && styles.ctrlActive]} 
                    onPress={toggleCamera}
                  >
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={switchCamera}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.ctrlBtn, isSpeaker && styles.ctrlActive]} 
                onPress={toggleSpeaker}
              >
                <Ionicons name={isSpeaker ? "volume-high" : "volume-low"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            // Calling/connecting - end button only
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════════
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
  localVideoPip: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 130,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#000',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  localVideoInner: { 
    flex: 1 
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badge: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  badgeVideo: { backgroundColor: '#9C27B0' },
  badgeAudio: { backgroundColor: '#4361ee' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  stateBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  stateDot: { width: 10, height: 10, borderRadius: 5 },
  stateText: { fontSize: 11, fontWeight: '700' },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  connectedText: { color: '#4CAF50', fontSize: 16, fontWeight: '700' },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  acceptBtn: {
    width: 75,
    height: 75,
    borderRadius: 40,
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
    width: 75,
    height: 75,
    borderRadius: 40,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  btnLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
    elevation: 8,
  },
  ctrlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
