/**
 * CallScreenV2 - PRODUCTION RTC v4.0
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * CRITICAL FIX: MANUAL TRACK PUBLISH + PROPER RTC LIFECYCLE
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * KEY CHANGES:
 * 1. NO auto-publish - manual track creation and publishing
 * 2. Audio track created and published FIRST
 * 3. Video track created and published SECOND
 * 4. Tracks published AFTER joinChannel success
 * 5. "Connected" state ONLY after remote track received
 * 6. Comprehensive debug logging
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
  LocalAudioStreamState,
  LocalAudioStreamReason,
  RemoteAudioState,
  RemoteAudioStateReason,
  LocalVideoStreamState,
  LocalVideoStreamReason,
  RemoteVideoState,
  RemoteVideoStateReason,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TIMEOUTS
const CONNECT_TIMEOUT_MS = 25000;  // 25s max for entire connection
const TRACK_PUBLISH_DELAY_MS = 500; // Wait before publishing tracks

// ════════════════════════════════════════════════════════════════════════════════
// CALL STATES - Strict state machine
// ════════════════════════════════════════════════════════════════════════════════
type CallState = 
  | 'idle'         // Initial state
  | 'calling'      // Caller: Waiting for callee to answer
  | 'ringing'      // Callee: Incoming call
  | 'connecting'   // RTC joining/connecting
  | 'connected'    // CALL ACTIVE - audio/video flowing
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
// LOGGING - Comprehensive debug output
// ════════════════════════════════════════════════════════════════════════════════
const getTs = () => {
  const now = new Date();
  return `${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
};

const log = (event: string, data?: any) => {
  const d = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${getTs()}] 🎙️ RTC: ${event}${d}`);
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
// PERMISSION CHECK (permissions already granted at app start)
// ════════════════════════════════════════════════════════════════════════════════
const checkPermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const audioGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    const cameraGranted = !needVideo || await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    
    log('PERMISSION_CHECK', { audioGranted, cameraGranted, needVideo });
    
    return audioGranted && cameraGranted;
  } catch (e) {
    log('PERMISSION_CHECK_ERROR', { error: String(e) });
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
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Track state indicators
  const [localAudioState, setLocalAudioState] = useState<string>('OFF');
  const [localVideoState, setLocalVideoState] = useState<string>('OFF');
  const [remoteAudioState, setRemoteAudioState] = useState<string>('OFF');
  const [remoteVideoState, setRemoteVideoState] = useState<string>('OFF');

  // RTC state
  const [rtcJoined, setRtcJoined] = useState(false);
  const [audioPublished, setAudioPublished] = useState(false);
  const [videoPublished, setVideoPublished] = useState(false);

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
  const tracksPublished = useRef(false);

  // ══════════════════════════════════════════════════════════════════════════════
  // TRANSITION TO CONNECTED - Only when audio/video actually flowing
  // ══════════════════════════════════════════════════════════════════════════════
  const transitionToConnected = useCallback(() => {
    if (callState === 'connected' || callState === 'ended' || callState === 'error') {
      return;
    }
    
    const elapsed = Date.now() - callStartTs.current;
    log('STATE_TO_CONNECTED', { from: callState, elapsed });
    
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
    Vibration.vibrate([0, 200, 200, 200], false);
    ringbackTimerRef.current = setInterval(() => {
      Vibration.vibrate([0, 200, 200, 200], false);
    }, 3000);
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
        // Unregister handler first
        if (eventHandlerRef.current) {
          engineRef.current.unregisterEventHandler(eventHandlerRef.current);
          eventHandlerRef.current = null;
        }
        
        // Disable tracks
        try {
          engineRef.current.muteLocalAudioStream(true);
          engineRef.current.enableLocalAudio(false);
          if (isVideo) {
            engineRef.current.muteLocalVideoStream(true);
            engineRef.current.enableLocalVideo(false);
            engineRef.current.stopPreview();
          }
        } catch (e) {
          log('CLEANUP_DISABLE_ERROR', { error: String(e) });
        }
        
        await engineRef.current.leaveChannel();
        log('AGORA_LEFT_CHANNEL');
        
        engineRef.current.release();
        log('AGORA_ENGINE_RELEASED');
        engineRef.current = null;
      } catch (e) {
        log('CLEANUP_ERROR', { error: String(e) });
      }
    }

    // Reset state
    isInitializing.current = false;
    hasInitialized.current = false;
    isCleaningUp.current = false;
    tracksPublished.current = false;
    
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
  // PUBLISH TRACKS - Called AFTER joinChannel success
  // ════════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════════
  const publishTracks = useCallback(async () => {
    if (!engineRef.current || tracksPublished.current) {
      log('PUBLISH_SKIP', { hasEngine: !!engineRef.current, alreadyPublished: tracksPublished.current });
      return;
    }

    tracksPublished.current = true;
    const engine = engineRef.current;
    
    log('PUBLISH_TRACKS_START', { isVideo });

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // STEP 1: Enable and publish AUDIO FIRST
      // ═══════════════════════════════════════════════════════════════════════
      log('AUDIO_ENABLE_START');
      
      // Enable audio module
      engine.enableAudio();
      log('AUDIO_MODULE_ENABLED');
      
      // Enable local audio (microphone)
      engine.enableLocalAudio(true);
      log('LOCAL_AUDIO_ENABLED');
      
      // Unmute local audio stream
      engine.muteLocalAudioStream(false);
      log('LOCAL_AUDIO_UNMUTED');
      
      // Set volume levels
      engine.adjustRecordingSignalVolume(100);
      engine.adjustPlaybackSignalVolume(100);
      log('AUDIO_VOLUMES_SET', { recording: 100, playback: 100 });
      
      // Enable speaker
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      log('SPEAKER_ENABLED');
      
      setAudioPublished(true);
      setLocalAudioState('ON');
      log('AUDIO_PUBLISH_COMPLETE');

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 2: Enable and publish VIDEO SECOND (if video call)
      // ═══════════════════════════════════════════════════════════════════════
      if (isVideo) {
        log('VIDEO_ENABLE_START');
        
        // Small delay to ensure audio is stable
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Enable video module
        engine.enableVideo();
        log('VIDEO_MODULE_ENABLED');
        
        // Enable local video (camera)
        engine.enableLocalVideo(true);
        log('LOCAL_VIDEO_ENABLED');
        
        // Unmute local video stream
        engine.muteLocalVideoStream(false);
        log('LOCAL_VIDEO_UNMUTED');
        
        // Start preview
        engine.startPreview();
        log('VIDEO_PREVIEW_STARTED');
        
        setVideoPublished(true);
        setLocalVideoState('ON');
        log('VIDEO_PUBLISH_COMPLETE');
      }

      log('ALL_TRACKS_PUBLISHED', { 
        audioPublished: true, 
        videoPublished: isVideo,
        elapsed: Date.now() - callStartTs.current 
      });

    } catch (e) {
      log('PUBLISH_TRACKS_ERROR', { error: String(e) });
    }
  }, [isVideo]);

  // ══════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // INITIALIZE RTC - Create engine and join channel
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
    // STEP 1: Check permissions
    // ═══════════════════════════════════════════════════════════════════════════
    const hasPermission = await checkPermissions(isVideo);
    if (!hasPermission) {
      log('PERMISSION_DENIED');
      isInitializing.current = false;
      failCall('Mikrofon izni gerekli');
      return;
    }
    log('PERMISSION_OK', { elapsed: Date.now() - startTime });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Create Agora engine
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      log('ENGINE_CREATE_START');
      const engine = createAgoraRtcEngine();
      
      // Initialize engine
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      log('ENGINE_INITIALIZED', { elapsed: Date.now() - startTime });

      // Set audio profile BEFORE enabling audio
      engine.setAudioProfile(
        AudioProfileType.AudioProfileDefault,
        AudioScenarioType.AudioScenarioDefault
      );
      log('AUDIO_PROFILE_SET');

      // Set client role
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      log('CLIENT_ROLE_SET');

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 3: Register event handlers BEFORE joining
      // ═══════════════════════════════════════════════════════════════════════
      const handler: IRtcEngineEventHandler = {
        
        // ─────────────────────────────────────────────────────────────────────
        // JOIN SUCCESS - Publish tracks here
        // ─────────────────────────────────────────────────────────────────────
        onJoinChannelSuccess: (connection, elapsed) => {
          log('JOIN_CHANNEL_SUCCESS', { 
            channel: connection.channelId, 
            uid: connection.localUid, 
            elapsed,
            totalMs: Date.now() - callStartTs.current
          });
          
          hasInitialized.current = true;
          setRtcJoined(true);
          
          // CRITICAL: Publish tracks AFTER join success
          setTimeout(() => {
            publishTracks();
          }, TRACK_PUBLISH_DELAY_MS);
        },

        // ─────────────────────────────────────────────────────────────────────
        // REMOTE USER JOINED
        // ─────────────────────────────────────────────────────────────────────
        onUserJoined: (connection, uid, elapsed) => {
          log('REMOTE_USER_JOINED', { uid, elapsed, totalMs: Date.now() - callStartTs.current });
          setRemoteUid(uid);
          
          // Ensure we're subscribed to remote streams
          if (engineRef.current) {
            engineRef.current.muteRemoteAudioStream(uid, false);
            if (isVideo) {
              engineRef.current.muteRemoteVideoStream(uid, false);
            }
            log('REMOTE_STREAMS_UNMUTED', { uid });
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // REMOTE USER OFFLINE
        // ─────────────────────────────────────────────────────────────────────
        onUserOffline: (connection, uid, reason) => {
          log('REMOTE_USER_OFFLINE', { uid, reason });
          setRemoteUid(null);
          setRemoteAudioState('OFF');
          setRemoteVideoState('OFF');
          endCall();
        },

        // ─────────────────────────────────────────────────────────────────────
        // LOCAL AUDIO STATE - Critical for debugging
        // ─────────────────────────────────────────────────────────────────────
        onLocalAudioStateChanged: (state, reason) => {
          const stateNames: Record<number, string> = {
            0: 'STOPPED',
            1: 'RECORDING',
            2: 'ENCODING',
            3: 'FAILED'
          };
          const reasonNames: Record<number, string> = {
            0: 'OK',
            1: 'FAILURE',
            2: 'NO_PERMISSION',
            3: 'BUSY',
            4: 'CAPTURE_FAIL',
            5: 'ENCODE_FAIL'
          };
          
          const stateName = stateNames[state] || `UNKNOWN(${state})`;
          const reasonName = reasonNames[reason] || `UNKNOWN(${reason})`;
          
          log('LOCAL_AUDIO_STATE', { state: stateName, reason: reasonName });
          
          if (state === 1 || state === 2) { // RECORDING or ENCODING
            setLocalAudioState('ON');
          } else if (state === 0 || state === 3) { // STOPPED or FAILED
            setLocalAudioState('OFF');
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // REMOTE AUDIO STATE - Critical for debugging
        // ─────────────────────────────────────────────────────────────────────
        onRemoteAudioStateChanged: (connection, uid, state, reason, elapsed) => {
          const stateNames: Record<number, string> = {
            0: 'STOPPED',
            1: 'STARTING',
            2: 'DECODING',
            3: 'FROZEN',
            4: 'FAILED'
          };
          const reasonNames: Record<number, string> = {
            0: 'INTERNAL',
            1: 'NETWORK_CONGESTION',
            2: 'NETWORK_RECOVERY',
            3: 'LOCAL_MUTED',
            4: 'LOCAL_UNMUTED',
            5: 'REMOTE_MUTED',
            6: 'REMOTE_UNMUTED',
            7: 'REMOTE_OFFLINE'
          };
          
          const stateName = stateNames[state] || `UNKNOWN(${state})`;
          const reasonName = reasonNames[reason] || `UNKNOWN(${reason})`;
          
          log('REMOTE_AUDIO_STATE', { uid, state: stateName, reason: reasonName, elapsed });
          
          if (state === 2) { // DECODING = receiving audio
            setRemoteAudioState('ON');
            setRemoteUid(uid);
            
            // Audio is flowing - transition to connected
            log('REMOTE_AUDIO_FLOWING', { uid, elapsed: Date.now() - callStartTs.current });
            transitionToConnected();
          } else if (state === 0 || state === 4) { // STOPPED or FAILED
            setRemoteAudioState('OFF');
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // LOCAL VIDEO STATE
        // ─────────────────────────────────────────────────────────────────────
        onLocalVideoStateChanged: (source, state, reason) => {
          const stateNames: Record<number, string> = {
            0: 'STOPPED',
            1: 'CAPTURING',
            2: 'ENCODING',
            3: 'FAILED'
          };
          const stateName = stateNames[state] || `UNKNOWN(${state})`;
          
          log('LOCAL_VIDEO_STATE', { source, state: stateName, reason });
          
          if (state === 1 || state === 2) { // CAPTURING or ENCODING
            setLocalVideoState('ON');
          } else {
            setLocalVideoState('OFF');
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // REMOTE VIDEO STATE
        // ─────────────────────────────────────────────────────────────────────
        onRemoteVideoStateChanged: (connection, uid, state, reason, elapsed) => {
          const stateNames: Record<number, string> = {
            0: 'STOPPED',
            1: 'STARTING',
            2: 'DECODING',
            3: 'FROZEN',
            4: 'FAILED'
          };
          const stateName = stateNames[state] || `UNKNOWN(${state})`;
          
          log('REMOTE_VIDEO_STATE', { uid, state: stateName, reason, elapsed });
          
          if (state === 2) { // DECODING = receiving video
            setRemoteVideoState('ON');
            setRemoteUid(uid);
          } else if (state === 0 || state === 4) {
            setRemoteVideoState('OFF');
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // FIRST REMOTE AUDIO FRAME
        // ─────────────────────────────────────────────────────────────────────
        onFirstRemoteAudioFrame: (connection, uid, elapsed) => {
          log('FIRST_REMOTE_AUDIO_FRAME', { uid, elapsed, totalMs: Date.now() - callStartTs.current });
          setRemoteAudioState('ON');
          setRemoteUid(uid);
          transitionToConnected();
        },

        // ─────────────────────────────────────────────────────────────────────
        // FIRST LOCAL AUDIO FRAME PUBLISHED
        // ─────────────────────────────────────────────────────────────────────
        onFirstLocalAudioFramePublished: (connection, elapsed) => {
          log('FIRST_LOCAL_AUDIO_PUBLISHED', { elapsed, totalMs: Date.now() - callStartTs.current });
          setLocalAudioState('ON');
          setAudioPublished(true);
        },

        // ─────────────────────────────────────────────────────────────────────
        // FIRST REMOTE VIDEO FRAME
        // ─────────────────────────────────────────────────────────────────────
        onFirstRemoteVideoFrame: (connection, uid, width, height, elapsed) => {
          log('FIRST_REMOTE_VIDEO_FRAME', { uid, width, height, elapsed, totalMs: Date.now() - callStartTs.current });
          setRemoteVideoState('ON');
          setRemoteUid(uid);
        },

        // ─────────────────────────────────────────────────────────────────────
        // FIRST LOCAL VIDEO FRAME PUBLISHED
        // ─────────────────────────────────────────────────────────────────────
        onFirstLocalVideoFramePublished: (connection, elapsed) => {
          log('FIRST_LOCAL_VIDEO_PUBLISHED', { elapsed, totalMs: Date.now() - callStartTs.current });
          setLocalVideoState('ON');
          setVideoPublished(true);
        },

        // ─────────────────────────────────────────────────────────────────────
        // CONNECTION STATE
        // ─────────────────────────────────────────────────────────────────────
        onConnectionStateChanged: (connection, state, reason) => {
          const stateNames: Record<number, string> = {
            1: 'DISCONNECTED',
            2: 'CONNECTING',
            3: 'CONNECTED',
            4: 'RECONNECTING',
            5: 'FAILED'
          };
          log('CONNECTION_STATE', { state: stateNames[state] || state, reason });
          
          if (state === 5) { // FAILED
            failCall('Bağlantı kurulamadı');
          }
        },

        // ─────────────────────────────────────────────────────────────────────
        // ERROR
        // ─────────────────────────────────────────────────────────────────────
        onError: (err, msg) => {
          log('AGORA_ERROR', { err, msg });
        },

        // ─────────────────────────────────────────────────────────────────────
        // LEAVE CHANNEL
        // ─────────────────────────────────────────────────────────────────────
        onLeaveChannel: (connection, stats) => {
          log('LEAVE_CHANNEL', { duration: stats.duration, txBytes: stats.txBytes, rxBytes: stats.rxBytes });
          hasInitialized.current = false;
          setRtcJoined(false);
          setAudioPublished(false);
          setVideoPublished(false);
        },

        // ─────────────────────────────────────────────────────────────────────
        // AUDIO VOLUME INDICATION
        // ─────────────────────────────────────────────────────────────────────
        onAudioVolumeIndication: (connection, speakers, speakerNumber, totalVolume) => {
          if (totalVolume > 10) {
            // Only log when there's actual audio
            log('AUDIO_VOLUME', { speakerNumber, totalVolume });
          }
        },
      };

      eventHandlerRef.current = handler;
      engine.registerEventHandler(handler);
      engineRef.current = engine;
      
      // Enable volume indication for debugging
      engine.enableAudioVolumeIndication(2000, 3, true);
      
      log('EVENT_HANDLERS_REGISTERED', { elapsed: Date.now() - startTime });

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 4: Join channel (NO auto-publish)
      // ═══════════════════════════════════════════════════════════════════════
      log('JOIN_CHANNEL_START', { channel, uid: localUid.current });
      
      // Join WITHOUT auto-publish - we'll publish manually after join success
      engine.joinChannel(token, channel, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: false,  // DO NOT auto-publish
        publishCameraTrack: false,      // DO NOT auto-publish
        autoSubscribeAudio: true,       // Auto-subscribe to remote audio
        autoSubscribeVideo: true,       // Auto-subscribe to remote video
      });

      log('JOIN_CHANNEL_CALLED', { elapsed: Date.now() - startTime });

    } catch (e) {
      log('RTC_INIT_ERROR', { error: String(e) });
      isInitializing.current = false;
      failCall('RTC başlatılamadı');
    }
  }, [isVideo, mode, failCall, endCall, publishTracks, transitionToConnected]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: INITIALIZE ON MOUNT
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('CALL_SCREEN_OPEN', { mode, callId, channelName, hasToken: !!agoraToken, isVideo });
    callStartTs.current = Date.now();
    
    // Reset state
    setCallState(mode === 'caller' ? 'calling' : 'ringing');
    setDuration(0);
    setRtcJoined(false);
    setAudioPublished(false);
    setVideoPublished(false);
    setLocalAudioState('OFF');
    setLocalVideoState('OFF');
    setRemoteAudioState('OFF');
    setRemoteVideoState('OFF');
    setRemoteUid(null);
    setErrorMessage('');
    tracksPublished.current = false;

    // Start sounds
    if (mode === 'caller') {
      startRingback();
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
        log('CONNECT_TIMEOUT');
        failCall('Bağlantı zaman aşımı');
      }
    }, CONNECT_TIMEOUT_MS);

    // Initialize RTC immediately
    if (agoraToken && channelName) {
      initializeRTC(agoraToken, channelName);
    }

    return () => {
      log('CALL_SCREEN_UNMOUNT');
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: TOKEN ARRIVES LATER
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible && agoraToken && channelName && !hasInitialized.current && !isInitializing.current) {
      log('TOKEN_LATE_INIT');
      initializeRTC(agoraToken, channelName);
    }
  }, [visible, agoraToken, channelName, initializeRTC]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CALL ACCEPTED
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('CALL_ACCEPTED_SIGNAL', { elapsed: Date.now() - callStartTs.current });
      stopRingback();
      setCallState('connecting');
    }
  }, [callAccepted, mode, stopRingback]);

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
  
  const handleAccept = useCallback(() => {
    log('ACCEPT_PRESSED', { elapsed: Date.now() - callStartTs.current, rtcJoined });
    haptic('medium');
    
    stopRingtone();
    setCallState('connecting');
    onAccept();
    
  }, [rtcJoined, stopRingtone, onAccept]);

  const handleReject = useCallback(() => {
    log('REJECT_PRESSED');
    haptic('heavy');
    
    stopRingtone();
    setCallState('ended');
    onReject();
    setTimeout(() => onClose(), 300);
  }, [stopRingtone, onReject, onClose]);

  const handleEnd = useCallback(() => {
    log('END_PRESSED');
    haptic('heavy');
    endCall();
  }, [endCall]);

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

  const getStatusText = () => {
    switch (callState) {
      case 'idle': return '';
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
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

        {/* Local Video (PIP) */}
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

        {/* Track Status Debug Badge */}
        <View style={styles.debugBadge}>
          <View style={styles.debugRow}>
            <View style={[styles.indicator, localAudioState === 'ON' ? styles.indicatorOn : styles.indicatorOff]} />
            <Text style={styles.debugText}>MIC</Text>
            <View style={[styles.indicator, remoteAudioState === 'ON' ? styles.indicatorOn : styles.indicatorOff]} />
            <Text style={styles.debugText}>SPK</Text>
          </View>
          {isVideo && (
            <View style={styles.debugRow}>
              <View style={[styles.indicator, localVideoState === 'ON' ? styles.indicatorOn : styles.indicatorOff]} />
              <Text style={styles.debugText}>CAM</Text>
              <View style={[styles.indicator, remoteVideoState === 'ON' ? styles.indicatorOn : styles.indicatorOff]} />
              <Text style={styles.debugText}>REM</Text>
            </View>
          )}
        </View>

        {/* Avatar */}
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
    elevation: 10,
  },
  localVideoInner: { flex: 1 },
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
  debugBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorOn: { backgroundColor: '#4CAF50' },
  indicatorOff: { backgroundColor: '#f44336' },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginRight: 8,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 10,
  },
  avatarVideo: { backgroundColor: '#9C27B0' },
  remoteName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
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
