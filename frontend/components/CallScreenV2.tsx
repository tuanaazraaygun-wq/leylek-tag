/**
 * CallScreenV2 - PRODUCTION RTC v5.0
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * CRITICAL FIX: DRIVER AUDIO NOT PUBLISHING
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * ROOT CAUSE: Audio must be enabled BEFORE joinChannel, not after
 * 
 * FIX:
 * 1. Enable audio BEFORE joinChannel
 * 2. Use publishMicrophoneTrack: true in joinChannel
 * 3. Verify with hard logs
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

const CONNECT_TIMEOUT_MS = 25000;

type CallState = 
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'error';

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
const getTs = () => {
  const now = new Date();
  return `${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
};

const log = (event: string, data?: any) => {
  const d = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${getTs()}] 🎙️ ${event}${d}`);
};

const haptic = async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    const style = type === 'light' ? Haptics.ImpactFeedbackStyle.Light 
                : type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy 
                : Haptics.ImpactFeedbackStyle.Medium;
    await Haptics.impactAsync(style);
  } catch {}
};

const checkPermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  try {
    const audioGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    const cameraGranted = !needVideo || await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    log('PERMISSION_CHECK', { audioGranted, cameraGranted });
    return audioGranted && cameraGranted;
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
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Track indicators
  const [localAudioOn, setLocalAudioOn] = useState(false);
  const [remoteAudioOn, setRemoteAudioOn] = useState(false);
  const [localVideoOn, setLocalVideoOn] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [rtcJoined, setRtcJoined] = useState(false);

  const isVideo = useRef(callType === 'video').current;

  const engineRef = useRef<IRtcEngine | null>(null);
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const localUid = useRef<number>(Math.floor(Math.random() * 100000) + 1);
  const callStartTs = useRef<number>(Date.now());
  
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);
  const isCleaningUp = useRef(false);

  // ══════════════════════════════════════════════════════════════════════════════
  // TRANSITION TO CONNECTED
  // ══════════════════════════════════════════════════════════════════════════════
  const transitionToConnected = useCallback(() => {
    if (callState === 'connected' || callState === 'ended' || callState === 'error') return;
    
    log('>>> STATE_TO_CONNECTED', { from: callState, elapsed: Date.now() - callStartTs.current });
    setCallState('connected');
    
    Vibration.cancel();
    if (ringbackTimerRef.current) {
      clearInterval(ringbackTimerRef.current);
      ringbackTimerRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    
    if (!durationTimerRef.current) {
      durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    
    haptic('light');
  }, [callState]);

  const startRingback = useCallback(() => {
    if (mode !== 'caller' || ringbackTimerRef.current) return;
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

  const startRingtone = useCallback(() => {
    if (mode !== 'receiver') return;
    log('RINGTONE_START');
    Vibration.vibrate([0, 500, 300, 500], true);
  }, [mode]);

  const stopRingtone = useCallback(() => {
    Vibration.cancel();
  }, []);

  const clearAllTimers = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (ringbackTimerRef.current) clearInterval(ringbackTimerRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    durationTimerRef.current = null;
    ringbackTimerRef.current = null;
    connectTimeoutRef.current = null;
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
        try {
          engineRef.current.muteLocalAudioStream(true);
          engineRef.current.enableLocalAudio(false);
          if (isVideo) {
            engineRef.current.muteLocalVideoStream(true);
            engineRef.current.enableLocalVideo(false);
            engineRef.current.stopPreview();
          }
        } catch {}
        await engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
        log('ENGINE_RELEASED');
      } catch (e) {
        log('CLEANUP_ERROR', { error: String(e) });
      }
    }

    isInitializing.current = false;
    hasInitialized.current = false;
    isCleaningUp.current = false;
  }, [clearAllTimers, isVideo]);

  const endCall = useCallback(async () => {
    log('END_CALL', { elapsed: Date.now() - callStartTs.current });
    setCallState('ended');
    await cleanup();
    onEnd();
    setTimeout(() => onClose(), 300);
  }, [cleanup, onEnd, onClose]);

  const failCall = useCallback((reason: string) => {
    log('CALL_FAILED', { reason });
    setErrorMessage(reason);
    setCallState('error');
    clearAllTimers();
  }, [clearAllTimers]);

  // ══════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // CRITICAL: INITIALIZE RTC WITH AUDIO ENABLED BEFORE JOIN
  // ════════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════════
  const initializeRTC = useCallback(async (token: string, channel: string) => {
    if (isInitializing.current || hasInitialized.current) {
      log('INIT_SKIP', { isInit: isInitializing.current, hasInit: hasInitialized.current });
      return;
    }
    if (!token || !channel) {
      log('INIT_MISSING_PARAMS');
      return;
    }

    isInitializing.current = true;
    const t0 = Date.now();
    log('═══════════════════════════════════════════════════════');
    log('RTC_INIT_START', { channel, uid: localUid.current, mode, isVideo });

    // Step 1: Check permissions
    const hasPerms = await checkPermissions(isVideo);
    if (!hasPerms) {
      log('PERMISSION_DENIED');
      isInitializing.current = false;
      failCall('Mikrofon izni gerekli');
      return;
    }
    log('PERMISSION_OK', { ms: Date.now() - t0 });

    try {
      // Step 2: Create engine
      log('ENGINE_CREATE');
      const engine = createAgoraRtcEngine();
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      log('ENGINE_INITIALIZED', { ms: Date.now() - t0 });

      // Step 3: Set audio profile FIRST
      engine.setAudioProfile(
        AudioProfileType.AudioProfileDefault,
        AudioScenarioType.AudioScenarioDefault
      );
      log('AUDIO_PROFILE_SET');

      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL: Enable audio BEFORE joinChannel
      // ═══════════════════════════════════════════════════════════════════════
      log('>>> AUDIO_ENABLE_START');
      
      engine.enableAudio();
      log('>>> enableAudio() called');
      
      engine.enableLocalAudio(true);
      log('>>> enableLocalAudio(true) called');
      
      engine.muteLocalAudioStream(false);
      log('>>> muteLocalAudioStream(false) called');
      
      engine.adjustRecordingSignalVolume(100);
      log('>>> adjustRecordingSignalVolume(100) called');
      
      engine.adjustPlaybackSignalVolume(100);
      log('>>> adjustPlaybackSignalVolume(100) called');
      
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      log('>>> Speaker enabled');
      
      log('>>> AUDIO_ENABLE_COMPLETE', { ms: Date.now() - t0 });

      // Step 4: Enable video if needed (AFTER audio)
      if (isVideo) {
        log('>>> VIDEO_ENABLE_START');
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
        log('>>> VIDEO_ENABLE_COMPLETE', { ms: Date.now() - t0 });
      }

      // Step 5: Set role
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      log('CLIENT_ROLE_SET');

      // Step 6: Register handlers
      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection, elapsed) => {
          log('═══════════════════════════════════════════════════════');
          log('>>> JOIN_SUCCESS', { 
            channel: connection.channelId, 
            uid: connection.localUid, 
            elapsed,
            totalMs: Date.now() - callStartTs.current
          });
          hasInitialized.current = true;
          setRtcJoined(true);
          
          // CRITICAL: Re-ensure audio is enabled after join
          if (engineRef.current) {
            log('>>> POST_JOIN: Re-enabling audio');
            engineRef.current.enableLocalAudio(true);
            engineRef.current.muteLocalAudioStream(false);
            log('>>> POST_JOIN: Audio re-enabled');
          }
        },

        onUserJoined: (connection, uid, elapsed) => {
          log('>>> REMOTE_USER_JOINED', { uid, elapsed });
          setRemoteUid(uid);
          
          // Unmute remote streams
          if (engineRef.current) {
            engineRef.current.muteRemoteAudioStream(uid, false);
            if (isVideo) engineRef.current.muteRemoteVideoStream(uid, false);
            log('>>> REMOTE_STREAMS_UNMUTED', { uid });
          }
        },

        onUserOffline: (connection, uid, reason) => {
          log('>>> REMOTE_USER_OFFLINE', { uid, reason });
          setRemoteUid(null);
          setRemoteAudioOn(false);
          setRemoteVideoOn(false);
          endCall();
        },

        onLocalAudioStateChanged: (state, reason) => {
          const states = ['STOPPED', 'RECORDING', 'ENCODING', 'FAILED'];
          const reasons = ['OK', 'FAILURE', 'NO_PERM', 'BUSY', 'CAPTURE_FAIL', 'ENCODE_FAIL'];
          log('>>> LOCAL_AUDIO_STATE', { 
            state: states[state] || state, 
            reason: reasons[reason] || reason 
          });
          
          // State 1 = RECORDING, State 2 = ENCODING = Audio is working
          if (state === 1 || state === 2) {
            setLocalAudioOn(true);
            log('>>> LOCAL_AUDIO_ON ✓');
          } else {
            setLocalAudioOn(false);
            log('>>> LOCAL_AUDIO_OFF ✗');
          }
        },

        onRemoteAudioStateChanged: (connection, uid, state, reason, elapsed) => {
          const states = ['STOPPED', 'STARTING', 'DECODING', 'FROZEN', 'FAILED'];
          log('>>> REMOTE_AUDIO_STATE', { uid, state: states[state] || state, reason });
          
          // State 2 = DECODING = Receiving audio
          if (state === 2) {
            setRemoteAudioOn(true);
            setRemoteUid(uid);
            log('>>> REMOTE_AUDIO_ON ✓ - TRANSITIONING TO CONNECTED');
            transitionToConnected();
          } else if (state === 0 || state === 4) {
            setRemoteAudioOn(false);
          }
        },

        onLocalVideoStateChanged: (source, state, reason) => {
          const states = ['STOPPED', 'CAPTURING', 'ENCODING', 'FAILED'];
          log('>>> LOCAL_VIDEO_STATE', { source, state: states[state] || state });
          setLocalVideoOn(state === 1 || state === 2);
        },

        onRemoteVideoStateChanged: (connection, uid, state, reason, elapsed) => {
          const states = ['STOPPED', 'STARTING', 'DECODING', 'FROZEN', 'FAILED'];
          log('>>> REMOTE_VIDEO_STATE', { uid, state: states[state] || state });
          if (state === 2) {
            setRemoteVideoOn(true);
            setRemoteUid(uid);
          } else if (state === 0 || state === 4) {
            setRemoteVideoOn(false);
          }
        },

        onFirstLocalAudioFramePublished: (connection, elapsed) => {
          log('═══════════════════════════════════════════════════════');
          log('>>> FIRST_LOCAL_AUDIO_PUBLISHED ✓✓✓', { elapsed, totalMs: Date.now() - callStartTs.current });
          setLocalAudioOn(true);
        },

        onFirstRemoteAudioFrame: (connection, uid, elapsed) => {
          log('═══════════════════════════════════════════════════════');
          log('>>> FIRST_REMOTE_AUDIO_FRAME ✓✓✓', { uid, elapsed });
          setRemoteAudioOn(true);
          setRemoteUid(uid);
          transitionToConnected();
        },

        onFirstLocalVideoFramePublished: (connection, elapsed) => {
          log('>>> FIRST_LOCAL_VIDEO_PUBLISHED', { elapsed });
          setLocalVideoOn(true);
        },

        onFirstRemoteVideoFrame: (connection, uid, width, height, elapsed) => {
          log('>>> FIRST_REMOTE_VIDEO_FRAME', { uid, width, height, elapsed });
          setRemoteVideoOn(true);
          setRemoteUid(uid);
        },

        onConnectionStateChanged: (connection, state, reason) => {
          const states = ['', 'DISCONNECTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING', 'FAILED'];
          log('CONNECTION_STATE', { state: states[state] || state, reason });
          if (state === 5) failCall('Bağlantı kurulamadı');
        },

        onError: (err, msg) => {
          log('AGORA_ERROR', { err, msg });
        },

        onLeaveChannel: (connection, stats) => {
          log('LEAVE_CHANNEL', { duration: stats.duration });
          hasInitialized.current = false;
          setRtcJoined(false);
          setLocalAudioOn(false);
          setLocalVideoOn(false);
        },

        onAudioVolumeIndication: (connection, speakers, speakerNumber, totalVolume) => {
          if (totalVolume > 10) {
            log('AUDIO_VOLUME', { speakerNumber, totalVolume });
          }
        },
      };

      eventHandlerRef.current = handler;
      engine.registerEventHandler(handler);
      engineRef.current = engine;
      
      engine.enableAudioVolumeIndication(2000, 3, true);
      log('HANDLERS_REGISTERED', { ms: Date.now() - t0 });

      // ═══════════════════════════════════════════════════════════════════════
      // CRITICAL: Join with publishMicrophoneTrack: TRUE
      // ═══════════════════════════════════════════════════════════════════════
      log('═══════════════════════════════════════════════════════');
      log('>>> JOIN_CHANNEL_START', { channel, uid: localUid.current });
      
      engine.joinChannel(token, channel, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,    // MUST BE TRUE
        publishCameraTrack: isVideo,     // TRUE for video calls
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });

      log('>>> JOIN_CHANNEL_CALLED', { 
        publishMicrophoneTrack: true, 
        publishCameraTrack: isVideo,
        ms: Date.now() - t0 
      });
      log('═══════════════════════════════════════════════════════');

    } catch (e) {
      log('RTC_INIT_ERROR', { error: String(e) });
      isInitializing.current = false;
      failCall('RTC başlatılamadı');
    }
  }, [isVideo, mode, failCall, endCall, transitionToConnected]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('CALL_SCREEN_OPEN', { mode, callId, channelName, hasToken: !!agoraToken, isVideo });
    callStartTs.current = Date.now();
    
    setCallState(mode === 'caller' ? 'calling' : 'ringing');
    setDuration(0);
    setRtcJoined(false);
    setLocalAudioOn(false);
    setRemoteAudioOn(false);
    setLocalVideoOn(false);
    setRemoteVideoOn(false);
    setRemoteUid(null);
    setErrorMessage('');

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
      pulseAnim.stopAnimation();
    };
  }, [visible, callId]);

  useEffect(() => {
    if (visible && agoraToken && channelName && !hasInitialized.current && !isInitializing.current) {
      log('TOKEN_LATE_INIT');
      initializeRTC(agoraToken, channelName);
    }
  }, [visible, agoraToken, channelName, initializeRTC]);

  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('CALL_ACCEPTED_SIGNAL');
      stopRingback();
      setCallState('connecting');
    }
  }, [callAccepted, mode, stopRingback]);

  useEffect(() => {
    if (callRejected) {
      log('CALL_REJECTED');
      stopRingback();
      setCallState('ended');
      setErrorMessage('Arama reddedildi');
      setTimeout(() => { cleanup(); onClose(); }, 1500);
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
      log('RECEIVER_OFFLINE');
      stopRingback();
      failCall('Karşı taraf çevrimdışı');
    }
  }, [receiverOffline, stopRingback, failCall]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  // ══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════════
  const handleAccept = useCallback(() => {
    log('ACCEPT_PRESSED', { rtcJoined });
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
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return formatTime(duration);
      case 'ended': return errorMessage || 'Arama Bitti';
      case 'error': return errorMessage || 'Hata';
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (callState) {
      case 'calling': return '#FFA500';
      case 'ringing': return '#4CAF50';
      case 'connecting': return '#2196F3';
      case 'connected': return '#4CAF50';
      default: return '#f44336';
    }
  };

  const isCallActive = callState === 'connected';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video */}
        {isVideo && remoteUid && isCallActive && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
          />
        )}

        {/* Local Video PIP */}
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
          </View>
        )}

        {/* Type Badge */}
        <View style={[styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* Debug Badge */}
        <View style={styles.debugBadge}>
          <View style={styles.debugRow}>
            <View style={[styles.ind, localAudioOn ? styles.indOn : styles.indOff]} />
            <Text style={styles.debugText}>MIC</Text>
            <View style={[styles.ind, remoteAudioOn ? styles.indOn : styles.indOff]} />
            <Text style={styles.debugText}>SPK</Text>
          </View>
          {isVideo && (
            <View style={styles.debugRow}>
              <View style={[styles.ind, localVideoOn ? styles.indOn : styles.indOff]} />
              <Text style={styles.debugText}>CAM</Text>
              <View style={[styles.ind, remoteVideoOn ? styles.indOn : styles.indOff]} />
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

        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={[styles.callStatus, { color: getStatusColor() }]}>{getStatusText()}</Text>

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
              <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlActive]} onPress={toggleMute}>
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
              {isVideo && (
                <>
                  <TouchableOpacity style={[styles.ctrlBtn, isCameraOff && styles.ctrlActive]} onPress={toggleCamera}>
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
              <TouchableOpacity style={[styles.ctrlBtn, isSpeaker && styles.ctrlActive]} onPress={toggleSpeaker}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  localVideoPip: {
    position: 'absolute', top: 100, right: 16, width: 130, height: 180,
    borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: '#fff',
    backgroundColor: '#000', zIndex: 100, elevation: 10,
  },
  localVideoInner: { flex: 1 },
  badge: {
    position: 'absolute', top: 50, right: 16, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6,
  },
  badgeVideo: { backgroundColor: '#9C27B0' },
  badgeAudio: { backgroundColor: '#4361ee' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  debugBadge: {
    position: 'absolute', top: 50, left: 16, backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, gap: 4,
  },
  debugRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ind: { width: 12, height: 12, borderRadius: 6 },
  indOn: { backgroundColor: '#4CAF50' },
  indOff: { backgroundColor: '#f44336' },
  debugText: { color: '#fff', fontSize: 11, fontWeight: '700', marginRight: 8 },
  avatar: {
    width: 130, height: 130, borderRadius: 65, backgroundColor: '#4361ee',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24, elevation: 10,
  },
  avatarVideo: { backgroundColor: '#9C27B0' },
  remoteName: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  callStatus: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  connectedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8,
  },
  connectedText: { color: '#4CAF50', fontSize: 16, fontWeight: '700' },
  controls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  incomingRow: { flexDirection: 'row', justifyContent: 'center', gap: 80 },
  callRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  acceptBtn: {
    width: 75, height: 75, borderRadius: 40, backgroundColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center', elevation: 8,
  },
  acceptBtnVideo: { backgroundColor: '#9C27B0' },
  rejectBtn: {
    width: 75, height: 75, borderRadius: 40, backgroundColor: '#f44336',
    justifyContent: 'center', alignItems: 'center', elevation: 8,
  },
  btnLabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
  endBtn: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#f44336',
    justifyContent: 'center', alignItems: 'center', elevation: 8,
  },
  ctrlBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
});
