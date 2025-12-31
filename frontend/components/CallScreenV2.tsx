/**
 * CallScreenV2 - FINAL AUDIO FIX v6.0
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * AUDIO FIX - Strict order implementation
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * SIRA:
 * 1. createEngine
 * 2. setAudioProfile  
 * 3. setClientRole
 * 4. register ALL event handlers
 * 5. enableAudio + enableLocalAudio(true) + unmute
 * 6. joinChannel(publishMicrophoneTrack: true)
 * 7. onJoinChannelSuccess sonrası audio tekrar doğrula
 * 
 * MIC INDICATOR:
 * - SADECE onFirstLocalAudioFramePublished event'i ile yeşil olur
 * - onLocalAudioStateChanged KULLANILMAZ
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
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';
const CONNECT_TIMEOUT_MS = 30000;

type CallState = 'ringing' | 'connecting' | 'connected' | 'ended' | 'error';

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
// LOGGING - Her adımda timestamp ile
// ════════════════════════════════════════════════════════════════════════════════
const getTs = () => {
  const now = new Date();
  return `${now.getMinutes()}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
};

const log = (event: string, data?: any) => {
  const d = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${getTs()}] 🎙️ ${event}${d}`);
};

const haptic = async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    await Haptics.impactAsync(
      type === 'light' ? Haptics.ImpactFeedbackStyle.Light 
      : type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy 
      : Haptics.ImpactFeedbackStyle.Medium
    );
  } catch {}
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
  
  const [callState, setCallState] = useState<CallState>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // MIC indicator - SADECE onFirstLocalAudioFramePublished ile değişir
  const [micPublished, setMicPublished] = useState(false);
  const [remoteAudioReceived, setRemoteAudioReceived] = useState(false);
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
  // CONNECTED STATE
  // ══════════════════════════════════════════════════════════════════════════════
  const transitionToConnected = useCallback(() => {
    if (callState === 'connected' || callState === 'ended' || callState === 'error') return;
    
    log('STATE → CONNECTED', { from: callState, elapsed: Date.now() - callStartTs.current });
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
  // INITIALIZE RTC - STRICT ORDER
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
    
    log('════════════════════════════════════════════════════════════════');
    log('RTC_INIT_START', { channel, uid: localUid.current, mode, isVideo });

    // ═══════════════════════════════════════════════════════════════════════════
    // İZİN KONTROLÜ - Sadece kontrol, istek YOK (uygulama başında alındı)
    // ═══════════════════════════════════════════════════════════════════════════
    if (Platform.OS === 'android') {
      const audioOK = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      const cameraOK = !isVideo || await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      log('PERMISSION_CHECK', { audioOK, cameraOK });
      
      if (!audioOK) {
        log('PERMISSION_DENIED - BLOCKING CALL');
        isInitializing.current = false;
        failCall('Mikrofon izni verilmemiş');
        return;
      }
    }

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 1: CREATE ENGINE
      // ═══════════════════════════════════════════════════════════════════════════
      log('STEP 1: createEngine');
      const engine = createAgoraRtcEngine();
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      log('  → Engine initialized', { ms: Date.now() - t0 });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 2: SET AUDIO PROFILE
      // ═══════════════════════════════════════════════════════════════════════════
      log('STEP 2: setAudioProfile');
      engine.setAudioProfile(
        AudioProfileType.AudioProfileDefault,
        AudioScenarioType.AudioScenarioDefault
      );
      log('  → Audio profile set', { ms: Date.now() - t0 });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 3: SET CLIENT ROLE
      // ═══════════════════════════════════════════════════════════════════════════
      log('STEP 3: setClientRole');
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      log('  → Client role set to BROADCASTER', { ms: Date.now() - t0 });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 4: REGISTER ALL EVENT HANDLERS
      // ═══════════════════════════════════════════════════════════════════════════
      log('STEP 4: registerEventHandlers');
      
      const handler: IRtcEngineEventHandler = {
        
        onJoinChannelSuccess: (connection, elapsed) => {
          log('════════════════════════════════════════════════════════════════');
          log('EVENT: onJoinChannelSuccess', { 
            channel: connection.channelId, 
            uid: connection.localUid, 
            elapsed,
            totalMs: Date.now() - callStartTs.current
          });
          hasInitialized.current = true;
          setRtcJoined(true);
          
          // ═══════════════════════════════════════════════════════════════════════
          // STEP 7: POST-JOIN AUDIO VERIFICATION
          // ═══════════════════════════════════════════════════════════════════════
          log('STEP 7: Post-join audio verification');
          if (engineRef.current) {
            engineRef.current.enableLocalAudio(true);
            engineRef.current.muteLocalAudioStream(false);
            engineRef.current.adjustRecordingSignalVolume(100);
            engineRef.current.adjustPlaybackSignalVolume(100);
            log('  → Audio re-verified after join');
          }
        },

        onUserJoined: (connection, uid, elapsed) => {
          log('EVENT: onUserJoined', { uid, elapsed });
          setRemoteUid(uid);
          
          if (engineRef.current) {
            engineRef.current.muteRemoteAudioStream(uid, false);
            if (isVideo) engineRef.current.muteRemoteVideoStream(uid, false);
            log('  → Remote streams unmuted', { uid });
          }
        },

        onUserOffline: (connection, uid, reason) => {
          log('EVENT: onUserOffline', { uid, reason });
          setRemoteUid(null);
          setRemoteAudioReceived(false);
          setRemoteVideoOn(false);
          endCall();
        },

        // ═══════════════════════════════════════════════════════════════════════
        // MIC INDICATOR - SADECE BU EVENT İLE YEŞİL OLUR
        // ═══════════════════════════════════════════════════════════════════════
        onFirstLocalAudioFramePublished: (connection, elapsed) => {
          log('════════════════════════════════════════════════════════════════');
          log('EVENT: onFirstLocalAudioFramePublished ✅✅✅', { 
            elapsed, 
            totalMs: Date.now() - callStartTs.current 
          });
          setMicPublished(true);
          log('  → MIC INDICATOR NOW GREEN');
        },

        onFirstRemoteAudioFrame: (connection, uid, elapsed) => {
          log('════════════════════════════════════════════════════════════════');
          log('EVENT: onFirstRemoteAudioFrame ✅✅✅', { uid, elapsed });
          setRemoteAudioReceived(true);
          setRemoteUid(uid);
          log('  → SPK INDICATOR NOW GREEN');
          log('  → TRANSITIONING TO CONNECTED');
          transitionToConnected();
        },

        onFirstLocalVideoFramePublished: (connection, elapsed) => {
          log('EVENT: onFirstLocalVideoFramePublished', { elapsed });
          setLocalVideoOn(true);
        },

        onFirstRemoteVideoFrame: (connection, uid, width, height, elapsed) => {
          log('EVENT: onFirstRemoteVideoFrame', { uid, width, height, elapsed });
          setRemoteVideoOn(true);
          setRemoteUid(uid);
        },

        onRemoteAudioStateChanged: (connection, uid, state, reason, elapsed) => {
          // State 2 = DECODING = audio flowing
          log('EVENT: onRemoteAudioStateChanged', { uid, state, reason });
          if (state === 2) {
            setRemoteAudioReceived(true);
            setRemoteUid(uid);
            transitionToConnected();
          }
        },

        onConnectionStateChanged: (connection, state, reason) => {
          const states = ['', 'DISCONNECTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING', 'FAILED'];
          log('EVENT: onConnectionStateChanged', { state: states[state] || state, reason });
          if (state === 5) failCall('Bağlantı kurulamadı');
        },

        onError: (err, msg) => {
          log('EVENT: onError', { err, msg });
        },

        onLeaveChannel: (connection, stats) => {
          log('EVENT: onLeaveChannel', { duration: stats.duration });
          hasInitialized.current = false;
          setRtcJoined(false);
          setMicPublished(false);
          setLocalVideoOn(false);
        },

        onAudioVolumeIndication: (connection, speakers, speakerNumber, totalVolume) => {
          if (totalVolume > 20) {
            log('EVENT: onAudioVolumeIndication', { speakerNumber, totalVolume });
          }
        },
      };

      eventHandlerRef.current = handler;
      engine.registerEventHandler(handler);
      engineRef.current = engine;
      
      engine.enableAudioVolumeIndication(2000, 3, true);
      log('  → Event handlers registered', { ms: Date.now() - t0 });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 5: ENABLE AUDIO + LOCAL AUDIO + UNMUTE
      // ═══════════════════════════════════════════════════════════════════════════
      log('STEP 5: enableAudio + enableLocalAudio + unmute');
      
      engine.enableAudio();
      log('  → enableAudio() called');
      
      engine.enableLocalAudio(true);
      log('  → enableLocalAudio(true) called');
      
      engine.muteLocalAudioStream(false);
      log('  → muteLocalAudioStream(false) called');
      
      engine.adjustRecordingSignalVolume(100);
      log('  → adjustRecordingSignalVolume(100) called');
      
      engine.adjustPlaybackSignalVolume(100);
      log('  → adjustPlaybackSignalVolume(100) called');
      
      engine.setEnableSpeakerphone(true);
      engine.setDefaultAudioRouteToSpeakerphone(true);
      log('  → Speaker route enabled');
      
      log('  → Audio setup complete', { ms: Date.now() - t0 });

      // VIDEO SETUP (if video call)
      if (isVideo) {
        log('STEP 5b: Video setup');
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
        log('  → Video setup complete', { ms: Date.now() - t0 });
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 6: JOIN CHANNEL with publishMicrophoneTrack: true
      // ═══════════════════════════════════════════════════════════════════════════
      log('STEP 6: joinChannel');
      log('════════════════════════════════════════════════════════════════');
      
      engine.joinChannel(token, channel, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,    // CRITICAL: Must be TRUE
        publishCameraTrack: isVideo,     // TRUE for video calls
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });

      log('  → joinChannel called with options:', { 
        publishMicrophoneTrack: true, 
        publishCameraTrack: isVideo,
        ms: Date.now() - t0 
      });
      log('════════════════════════════════════════════════════════════════');

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
    
    setCallState(mode === 'caller' ? 'ringing' : 'ringing');
    setDuration(0);
    setRtcJoined(false);
    setMicPublished(false);
    setRemoteAudioReceived(false);
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
      case 'ringing': return mode === 'caller' ? 'Aranıyor...' : 'Gelen Arama';
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return formatTime(duration);
      case 'ended': return errorMessage || 'Arama Bitti';
      case 'error': return errorMessage || 'Hata';
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (callState) {
      case 'ringing': return mode === 'caller' ? '#FFA500' : '#4CAF50';
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

        {/* Audio Status Badge - MIC ve SPK göstergesi */}
        <View style={styles.debugBadge}>
          <View style={styles.debugRow}>
            <View style={[styles.ind, micPublished ? styles.indOn : styles.indOff]} />
            <Text style={styles.debugText}>MIC</Text>
            <View style={[styles.ind, remoteAudioReceived ? styles.indOn : styles.indOff]} />
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
