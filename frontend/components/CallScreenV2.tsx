/**
 * CallScreenV2 - FINAL PRODUCTION VERSION v3.0
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * CRITICAL AUDIO FIX - v3.0
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * AUDIO REQUIREMENTS:
 *   1. enableAudio() + enableLocalAudio(true)
 *   2. muteLocalAudioStream(false) explicitly
 *   3. adjustRecordingSignalVolume(100) for microphone
 *   4. adjustPlaybackSignalVolume(100) for speaker
 *   5. setEnableSpeakerphone(true) for output
 *   6. Proper audio scenario: AudioScenarioDefault
 *   7. Subscribe + unmute remote audio on onUserPublished
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
const CONNECT_TIMEOUT_MS = 20000;  // 20s max for entire connection

// ════════════════════════════════════════════════════════════════════════════════
// CALL STATES
// ════════════════════════════════════════════════════════════════════════════════
type CallState = 
  | 'calling'      // Caller: Waiting for callee to answer
  | 'ringing'      // Callee: Incoming call
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
// LOGGING
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
// PERMISSION - CHECK ONLY (permissions already granted at app start)
// ════════════════════════════════════════════════════════════════════════════════
const checkPermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    // Check if RECORD_AUDIO is already granted
    const audioGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    const cameraGranted = !needVideo || await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    
    log('PERMISSION_CHECK', { audioGranted, cameraGranted, needVideo });
    
    if (!audioGranted) {
      log('PERMISSION_AUDIO_NOT_GRANTED - Cannot start call');
      return false;
    }
    
    return audioGranted && cameraGranted;
  } catch (e) {
    log('PERMISSION_CHECK_ERROR', { error: String(e) });
    return false;
  }
};
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

  // RTC internal state tracking
  const [rtcJoined, setRtcJoined] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [remoteAudioReceived, setRemoteAudioReceived] = useState(false);

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
  
  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Lifecycle flags
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);
  const isCleaningUp = useRef(false);

  // ══════════════════════════════════════════════════════════════════════════════
  // TRANSITION TO CONNECTED
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
        
        // Disable audio/video before leaving
        try {
          engineRef.current.enableLocalAudio(false);
          engineRef.current.muteLocalAudioStream(true);
          if (isVideo) {
            engineRef.current.stopPreview();
            engineRef.current.enableLocalVideo(false);
          }
        } catch {}
        
        await engineRef.current.leaveChannel();
        log('AGORA_LEAVE_CHANNEL');
        engineRef.current.release();
        log('AGORA_ENGINE_RELEASED');
        engineRef.current = null;
      } catch (e) {
        log('CLEANUP_ERROR', { error: String(e) });
      }
    }

    isInitializing.current = false;
    hasInitialized.current = false;
    isCleaningUp.current = false;
    log('CLEANUP_DONE');
  }, [clearAllTimers, isVideo]);

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
  // ════════════════════════════════════════════════════════════════════════════
  // CRITICAL: INITIALIZE RTC WITH PROPER AUDIO CONFIGURATION
  // ════════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════════
  const initializeRTC = useCallback(async (token: string, channel: string) => {
    if (isInitializing.current || hasInitialized.current) {
      log('RTC_INIT_SKIP', { isInitializing: isInitializing.current, hasInitialized: hasInitialized.current });
      return;
    }

    if (!token || !channel) {
      log('RTC_INIT_MISSING_PARAMS', { hasToken: !!token, hasChannel: !!channel });
      return;
    }

    isInitializing.current = true;
    const startTime = Date.now();
    log('RTC_INIT_START', { channel, uid: localUid.current, isVideo, mode });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Check Permissions BEFORE creating engine (already granted at app start)
    // ═══════════════════════════════════════════════════════════════════════════
    const hasPermission = await checkPermissions(isVideo);
    if (!hasPermission) {
      log('PERMISSION_NOT_GRANTED_ABORT');
      isInitializing.current = false;
      failCall('Mikrofon izni gerekli. Lütfen ayarlardan izin verin.');
      return;
    }
    log('RTC_PERMISSION_OK', { elapsed: Date.now() - startTime });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Create and Configure Engine
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      log('AGORA_ENGINE_CREATE');
      const engine = createAgoraRtcEngine();
      
      // Initialize with communication profile
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      log('AGORA_ENGINE_INITIALIZED', { elapsed: Date.now() - startTime });

      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL AUDIO CONFIGURATION - DO NOT MODIFY ORDER
      // ═══════════════════════════════════════════════════════════════════════
      
      // 1. Set audio profile FIRST
      engine.setAudioProfile(
        AudioProfileType.AudioProfileDefault,
        AudioScenarioType.AudioScenarioDefault
      );
      log('AUDIO_PROFILE_SET');

      // 2. Enable audio module
      engine.enableAudio();
      log('AUDIO_ENABLED');

      // 3. Enable local audio capture (microphone)
      engine.enableLocalAudio(true);
      log('LOCAL_AUDIO_ENABLED');

      // 4. Unmute local audio stream
      engine.muteLocalAudioStream(false);
      log('LOCAL_AUDIO_UNMUTED');

      // 5. Set recording volume (microphone input) - 100 = normal
      engine.adjustRecordingSignalVolume(100);
      log('RECORDING_VOLUME_SET');

      // 6. Set playback volume (speaker output) - 100 = normal
      engine.adjustPlaybackSignalVolume(100);
      log('PLAYBACK_VOLUME_SET');

      // 7. Route audio to speaker
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      log('SPEAKER_ENABLED');

      setLocalAudioEnabled(true);
      log('AUDIO_SETUP_COMPLETE', { elapsed: Date.now() - startTime });

      // ═══════════════════════════════════════════════════════════════════════
      // Video configuration (if video call)
      // ═══════════════════════════════════════════════════════════════════════
      if (isVideo) {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.muteLocalVideoStream(false);
        engine.setVideoEncoderConfiguration({
          dimensions: { width: 480, height: 640 },
          frameRate: 15,
          bitrate: 400,
          mirrorMode: VideoMirrorModeType.VideoMirrorModeDisabled,
        });
        engine.startPreview();
        log('VIDEO_SETUP_COMPLETE', { elapsed: Date.now() - startTime });
      }

      // Set as broadcaster to publish tracks
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 3: Register Event Handlers
      // ═══════════════════════════════════════════════════════════════════════════
      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection, elapsed) => {
          log('RTC_JOIN_SUCCESS', { 
            channel: connection.channelId, 
            uid: connection.localUid, 
            elapsed,
            totalMs: Date.now() - callStartTs.current
          });
          hasInitialized.current = true;
          setRtcJoined(true);
          
          // Double-check audio is enabled after join
          if (engineRef.current) {
            engineRef.current.enableLocalAudio(true);
            engineRef.current.muteLocalAudioStream(false);
            log('POST_JOIN_AUDIO_CHECK');
          }
        },

        onUserJoined: (connection, uid, elapsed) => {
          log('REMOTE_USER_JOINED', { uid, elapsed, totalMs: Date.now() - callStartTs.current });
          setRemoteUid(uid);
        },

        // ═══════════════════════════════════════════════════════════════════════
        // CRITICAL: Subscribe to remote tracks and ensure audio is unmuted
        // ═══════════════════════════════════════════════════════════════════════
        onUserPublished: async (connection, uid, mediaType) => {
          log('REMOTE_USER_PUBLISHED', { uid, mediaType, totalMs: Date.now() - callStartTs.current });
          
          if (!engineRef.current) {
            log('SUBSCRIBE_ERROR_NO_ENGINE');
            return;
          }
          
          try {
            // Subscribe to the remote user's track
            await engineRef.current.subscribe(uid, mediaType);
            log('SUBSCRIBE_SUCCESS', { uid, mediaType });
            
            if (mediaType === 1) { // Audio = 1
              // CRITICAL: Unmute remote audio
              engineRef.current.muteRemoteAudioStream(uid, false);
              // Ensure playback volume is up
              engineRef.current.adjustPlaybackSignalVolume(100);
              log('REMOTE_AUDIO_SUBSCRIBED_AND_UNMUTED', { uid });
              setRemoteAudioReceived(true);
            } else if (mediaType === 2) { // Video = 2
              engineRef.current.muteRemoteVideoStream(uid, false);
              log('REMOTE_VIDEO_SUBSCRIBED_AND_UNMUTED', { uid });
            }
            
            setRemoteUid(uid);
            
          } catch (e) {
            log('SUBSCRIBE_ERROR', { uid, mediaType, error: String(e) });
          }
        },

        onUserUnpublished: (connection, uid, mediaType) => {
          log('REMOTE_USER_UNPUBLISHED', { uid, mediaType });
          if (mediaType === 1) {
            setRemoteAudioReceived(false);
          }
        },

        onUserOffline: (connection, uid, reason) => {
          log('REMOTE_USER_OFFLINE', { uid, reason });
          setRemoteUid(null);
          setRemoteAudioReceived(false);
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
          hasInitialized.current = false;
          setRtcJoined(false);
          setLocalAudioEnabled(false);
        },

        // ═══════════════════════════════════════════════════════════════════════
        // Audio state tracking - CRITICAL FOR DEBUGGING
        // ═══════════════════════════════════════════════════════════════════════
        onLocalAudioStateChanged: (state, reason) => {
          log('LOCAL_AUDIO_STATE_CHANGED', { state, reason });
          // state: 0=stopped, 1=recording, 2=encoding, 3=failed
          // reason: 0=ok, 1=failure, 2=no_permission, 3=busy, 4=capture_fail, 5=encode_fail
          if (state === 3) { // Failed
            log('LOCAL_AUDIO_FAILED', { reason });
          }
          if (state === 1) { // Recording
            setLocalAudioEnabled(true);
          }
        },

        onRemoteAudioStateChanged: (connection, uid, state, reason, elapsed) => {
          log('REMOTE_AUDIO_STATE_CHANGED', { uid, state, reason, elapsed });
          // state: 0=stopped, 1=starting, 2=decoding, 3=frozen, 4=failed
          if (state === 2) { // Decoding = receiving audio
            setRemoteAudioReceived(true);
            log('REMOTE_AUDIO_NOW_PLAYING', { uid });
          } else if (state === 0 || state === 4) {
            setRemoteAudioReceived(false);
          }
        },

        onLocalVideoStateChanged: (source, state, reason) => {
          log('LOCAL_VIDEO_STATE', { source, state, reason });
        },

        onRemoteVideoStateChanged: (connection, uid, state, reason, elapsed) => {
          log('REMOTE_VIDEO_STATE', { uid, state, reason });
        },

        // Audio volume indication (useful for debugging)
        onAudioVolumeIndication: (connection, speakers, speakerNumber, totalVolume) => {
          if (totalVolume > 0) {
            log('AUDIO_VOLUME', { speakerNumber, totalVolume });
          }
        },

        // First remote audio frame received
        onFirstRemoteAudioFrame: (connection, uid, elapsed) => {
          log('FIRST_REMOTE_AUDIO_FRAME', { uid, elapsed });
          setRemoteAudioReceived(true);
        },

        // First local audio frame published
        onFirstLocalAudioFramePublished: (connection, elapsed) => {
          log('FIRST_LOCAL_AUDIO_FRAME_PUBLISHED', { elapsed });
          setLocalAudioEnabled(true);
        },
      };

      eventHandlerRef.current = handler;
      engine.registerEventHandler(handler);
      engineRef.current = engine;
      
      // Enable audio volume indication for debugging
      engine.enableAudioVolumeIndication(2000, 3, true);
      
      log('AGORA_HANDLERS_REGISTERED', { elapsed: Date.now() - startTime });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 4: JOIN CHANNEL WITH AUDIO ENABLED
      // ═══════════════════════════════════════════════════════════════════════════
      log('RTC_JOIN_CHANNEL', { channel, uid: localUid.current });
      
      engine.joinChannel(token, channel, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,           // PUBLISH AUDIO
        publishCameraTrack: isVideo,            // PUBLISH VIDEO (if video call)
        autoSubscribeAudio: true,               // AUTO SUBSCRIBE TO REMOTE AUDIO
        autoSubscribeVideo: isVideo,            // AUTO SUBSCRIBE TO REMOTE VIDEO
      });

      log('RTC_JOIN_EXECUTED', { elapsed: Date.now() - startTime });

    } catch (e) {
      log('RTC_INIT_ERROR', { error: String(e) });
      isInitializing.current = false;
      failCall('RTC başlatılamadı');
    }
  }, [isVideo, mode, failCall, endCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: INITIALIZE ON MOUNT - IMMEDIATELY START RTC
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('CALL_SCREEN_OPEN', { mode, callId, channelName, hasToken: !!agoraToken, isVideo });
    callStartTs.current = Date.now();
    
    // Reset state
    setCallState(mode === 'caller' ? 'calling' : 'ringing');
    setDuration(0);
    setRtcJoined(false);
    setLocalAudioEnabled(false);
    setRemoteAudioReceived(false);
    setRemoteUid(null);
    setErrorMessage('');

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

    // Initialize RTC IMMEDIATELY for BOTH caller AND callee
    if (agoraToken && channelName) {
      log('RTC_INIT_IMMEDIATE', { mode });
      initializeRTC(agoraToken, channelName);
    }

    return () => {
      log('CALL_SCREEN_UNMOUNT');
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: TOKEN ARRIVES LATER (backup)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible && agoraToken && channelName && !hasInitialized.current && !isInitializing.current) {
      log('TOKEN_ARRIVED_LATE_INIT', { channel: channelName });
      initializeRTC(agoraToken, channelName);
    }
  }, [visible, agoraToken, channelName, initializeRTC]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CALL ACCEPTED (CALLER RECEIVES THIS FROM CALLEE)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('CALL_ACCEPTED_SIGNAL', { ms: Date.now() - callStartTs.current });
      transitionToConnected();
    }
  }, [callAccepted, mode, transitionToConnected]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: EXTERNAL EVENTS
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callRejected) {
      log('CALL_REJECTED_SIGNAL');
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
      log('CALL_ENDED_SIGNAL');
      endCall();
    }
  }, [callEnded, endCall]);

  useEffect(() => {
    if (receiverOffline) {
      log('RECEIVER_OFFLINE_SIGNAL');
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
  
  // ACCEPT - ONLY changes UI state, RTC is already running!
  const handleAccept = useCallback(() => {
    log('ACCEPT_PRESSED', { callId, ms: Date.now() - callStartTs.current, rtcJoined });
    haptic('medium');
    
    stopRingtone();
    
    // Emit socket event to notify caller
    onAccept();
    
    // Transition to connected
    transitionToConnected();
    
  }, [callId, rtcJoined, stopRingtone, onAccept, transitionToConnected]);

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

  // Status text
  const getStatusText = () => {
    switch (callState) {
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
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

        {/* Local Video (PIP) - Show when RTC joined and camera is on */}
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

        {/* Audio Status Badge - Debug info */}
        <View style={styles.audioBadge}>
          <View style={[styles.audioIndicator, localAudioEnabled ? styles.audioOn : styles.audioOff]} />
          <Text style={styles.audioText}>MIC</Text>
          <View style={[styles.audioIndicator, remoteAudioReceived ? styles.audioOn : styles.audioOff]} />
          <Text style={styles.audioText}>SPK</Text>
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
            // Calling/error - end button only
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
  audioBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  audioIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  audioOn: { backgroundColor: '#4CAF50' },
  audioOff: { backgroundColor: '#f44336' },
  audioText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginRight: 6,
  },
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
