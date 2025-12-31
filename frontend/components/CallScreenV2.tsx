/**
 * CallScreenV2 - PRODUCTION RTC (ZERO DELAY)
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * KRİTİK KURAL: INCOMING CALL GELDİĞİ AN RTC JOIN BAŞLAR
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * CALLEE FLOW (DEĞİŞTİ!):
 * 1. incoming_call socket event gelir
 * 2. UI "ringing" gösterir + AYNI ANDA RTC join + publish başlar (ARKA PLANDA)
 * 3. Accept butonu → SADECE UI state değişir (RTC zaten hazır!)
 * 4. onUserPublished → subscribe → in_call
 * 
 * CALLER FLOW:
 * 1. Arama butonu → UI açılır + AYNI ANDA RTC join + publish
 * 2. callAccepted → UI güncelle (RTC zaten hazır!)
 * 3. onUserPublished → subscribe → in_call
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
import { Audio } from 'expo-av';
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
const PUBLISH_TIMEOUT_MS = 10000;
const REMOTE_TIMEOUT_MS = 20000;

// ════════════════════════════════════════════════════════════════════════════════
// STATE TYPES
// ════════════════════════════════════════════════════════════════════════════════
type CallState = 
  | 'ringing'        // Callee: Gelen arama (RTC join ARKA PLANDA başlıyor!)
  | 'calling'        // Caller: Aranıyor (RTC join ARKA PLANDA başlıyor!)
  | 'connecting'     // Her iki taraf da accept etti, medya bekleniyor
  | 'in_call'        // SES + GÖRÜNTÜ VAR
  | 'error'
  | 'ended';

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
  console.log(`[${getTs()}] 🎙️ ${event}${d}`);
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

  // RTC State flags
  const [rtcJoined, setRtcJoined] = useState(false);
  const [localPublished, setLocalPublished] = useState(false);
  const [remotePublished, setRemotePublished] = useState(false);
  const [remoteSubscribed, setRemoteSubscribed] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // UI state - Accept edildi mi?
  const [userAccepted, setUserAccepted] = useState(mode === 'caller'); // Caller zaten "accept" etmiş sayılır

  const isVideo = useRef(callType === 'video').current;

  // ══════════════════════════════════════════════════════════════════════════════
  // REFS
  // ══════════════════════════════════════════════════════════════════════════════
  const engineRef = useRef<IRtcEngine | null>(null);
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const localUid = useRef<number>(Math.floor(Math.random() * 100000) + 1);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const publishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTs = useRef<number>(Date.now());
  
  const isJoining = useRef(false);
  const hasJoined = useRef(false);
  const isCleaningUp = useRef(false);
  
  // Ringback tone ref
  const ringbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ══════════════════════════════════════════════════════════════════════════════
  // RINGBACK TONE (Caller için - "Aranıyor" sırasında çalacak)
  // ══════════════════════════════════════════════════════════════════════════════
  const startRingback = useCallback(() => {
    if (mode !== 'caller') return;
    if (ringbackIntervalRef.current) return;
    
    log('RINGBACK_START');
    
    // Vibration pattern ile ringback simülasyonu (gerçek ses yerine)
    // Her 3 saniyede bir kısa titreşim
    const playRingPattern = () => {
      Vibration.vibrate([0, 200, 200, 200], false);
    };
    
    playRingPattern();
    ringbackIntervalRef.current = setInterval(playRingPattern, 3000);
  }, [mode]);

  const stopRingback = useCallback(() => {
    log('RINGBACK_STOP');
    if (ringbackIntervalRef.current) {
      clearInterval(ringbackIntervalRef.current);
      ringbackIntervalRef.current = null;
    }
    Vibration.cancel();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // TIMERS
  // ══════════════════════════════════════════════════════════════════════════════
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) return;
    log('DURATION_TIMER_START');
    durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (publishTimeoutRef.current) {
      clearTimeout(publishTimeoutRef.current);
      publishTimeoutRef.current = null;
    }
    if (remoteTimeoutRef.current) {
      clearTimeout(remoteTimeoutRef.current);
      remoteTimeoutRef.current = null;
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // RINGTONE
  // ══════════════════════════════════════════════════════════════════════════════
  const startRingtone = useCallback(() => {
    if (mode === 'receiver') {
      log('RINGTONE_START');
      Vibration.vibrate([0, 500, 300, 500], true);
    }
  }, [mode]);

  const stopRingtone = useCallback(() => {
    Vibration.cancel();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // FAIL CALL
  // ══════════════════════════════════════════════════════════════════════════════
  const failCall = useCallback((reason: string) => {
    log('CALL_FAILED', { reason });
    setErrorMessage(reason);
    setCallState('error');
    clearAllTimers();
    stopRingtone();
    stopRingback();
  }, [clearAllTimers, stopRingtone, stopRingback]);

  // ══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════════
  const cleanup = useCallback(async () => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    log('CLEANUP_START');
    clearAllTimers();
    stopRingtone();
    stopRingback();

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
  }, [clearAllTimers, stopRingtone, stopRingback]);

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
  // CORE: RTC JOIN + PUBLISH (HEMEN BAŞLAR - ACCEPT BEKLEMİYOR!)
  // ══════════════════════════════════════════════════════════════════════════════
  const initAndJoinChannel = useCallback(async (token: string, channel: string) => {
    if (isJoining.current || hasJoined.current) {
      log('JOIN_SKIP', { isJoining: isJoining.current, hasJoined: hasJoined.current });
      return;
    }

    if (!token || !channel) {
      log('JOIN_MISSING_PARAMS', { hasToken: !!token, hasChannel: !!channel });
      return;
    }

    isJoining.current = true;
    log('RTC_JOIN_START_IMMEDIATELY', { channel, uid: localUid.current, isVideo, mode });

    // STEP 1: PERMISSION
    const hasPermission = await requestPermissions(isVideo);
    if (!hasPermission) {
      log('PERMISSION_DENIED');
      // Permission reddedildi ama call UI'ı göstermeye devam et
      // Kullanıcı accept ederse hata göster
      isJoining.current = false;
      return;
    }

    // STEP 2: CREATE ENGINE
    if (!engineRef.current) {
      try {
        log('AGORA_ENGINE_CREATE');
        const engine = createAgoraRtcEngine();
        
        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });
        log('AGORA_ENGINE_INITIALIZED');

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

        // EVENT HANDLERS
        const handler: IRtcEngineEventHandler = {
          
          onJoinChannelSuccess: (connection, elapsed) => {
            log('AGORA_JOIN_SUCCESS', { 
              channel: connection.channelId, 
              uid: connection.localUid, 
              elapsed,
              ms: Date.now() - callStartTs.current
            });
            hasJoined.current = true;
            setRtcJoined(true);
          },

          onAudioPublishStateChanged: (channel, oldState, newState, elapsed) => {
            log('AUDIO_PUBLISH_STATE', { oldState, newState, elapsed });
            if (newState === 3) {
              log('LOCAL_TRACKS_PUBLISHED', { ms: Date.now() - callStartTs.current });
              setLocalPublished(true);
              
              if (publishTimeoutRef.current) {
                clearTimeout(publishTimeoutRef.current);
                publishTimeoutRef.current = null;
              }
            }
          },

          onVideoPublishStateChanged: (source, channel, oldState, newState, elapsed) => {
            log('VIDEO_PUBLISH_STATE', { source, oldState, newState });
          },

          onUserJoined: (connection, uid, elapsed) => {
            log('REMOTE_USER_JOINED', { uid, elapsed });
            setRemoteUid(uid);
          },

          // ════════════════════════════════════════════════════════════════════
          // KRİTİK: REMOTE USER PUBLISHED - MUTLAKA SUBSCRIBE ET
          // ════════════════════════════════════════════════════════════════════
          onUserPublished: (connection, uid, mediaType) => {
            log('REMOTE_USER_PUBLISHED', { uid, mediaType, ms: Date.now() - callStartTs.current });
            setRemotePublished(true);

            if (remoteTimeoutRef.current) {
              clearTimeout(remoteTimeoutRef.current);
              remoteTimeoutRef.current = null;
            }

            // MUTLAKA SUBSCRIBE ET
            if (engineRef.current) {
              if (mediaType === 1) { // Audio
                engineRef.current.muteRemoteAudioStream(uid, false);
                log('REMOTE_AUDIO_SUBSCRIBED', { uid });
              } else if (mediaType === 2) { // Video
                engineRef.current.muteRemoteVideoStream(uid, false);
                log('REMOTE_VIDEO_SUBSCRIBED', { uid });
              }
              setRemoteSubscribed(true);
              log('REMOTE_TRACK_SUBSCRIBED', { uid, mediaType });
            }
          },

          onUserUnpublished: (connection, uid, mediaType) => {
            log('REMOTE_USER_UNPUBLISHED', { uid, mediaType });
          },

          onUserOffline: (connection, uid, reason) => {
            log('REMOTE_USER_OFFLINE', { uid, reason });
            setRemoteUid(null);
            setRemotePublished(false);
            setRemoteSubscribed(false);
            endCall();
          },

          // AUDIO PLAYING
          onFirstRemoteAudioDecoded: (connection, uid, elapsed) => {
            log('AUDIO_PLAYING', { uid, elapsed, ms: Date.now() - callStartTs.current });
            setAudioPlaying(true);
          },

          // VIDEO RENDERING
          onFirstRemoteVideoFrame: (connection, uid, width, height, elapsed) => {
            log('VIDEO_RENDERING', { uid, width, height, elapsed, ms: Date.now() - callStartTs.current });
            setVideoPlaying(true);
          },

          onConnectionStateChanged: (connection, state, reason) => {
            log('CONNECTION_STATE', { state, reason });
            if (state === ConnectionStateType.ConnectionStateFailed) {
              failCall('Bağlantı başarısız');
            }
          },

          onError: (err, msg) => {
            log('AGORA_ERROR', { err, msg });
          },

          onLeaveChannel: (connection, stats) => {
            log('AGORA_LEAVE_CHANNEL_EVENT');
            hasJoined.current = false;
            setRtcJoined(false);
            setLocalPublished(false);
          },
        };

        eventHandlerRef.current = handler;
        engine.registerEventHandler(handler);
        log('EVENT_HANDLER_REGISTERED');

        engineRef.current = engine;

      } catch (e) {
        log('ENGINE_CREATE_ERROR', { error: String(e) });
        isJoining.current = false;
        return;
      }
    }

    // STEP 3: JOIN CHANNEL + AUTO PUBLISH (HEMEN!)
    try {
      log('JOIN_CHANNEL_CALL', { channel, uid: localUid.current });
      
      publishTimeoutRef.current = setTimeout(() => {
        log('PUBLISH_TIMEOUT_EXPIRED');
        // Timeout olsa bile UI'ı bozmayalım
      }, PUBLISH_TIMEOUT_MS);

      engineRef.current!.joinChannel(token, channel, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
      });

      log('JOIN_CHANNEL_EXECUTED', { ms: Date.now() - callStartTs.current });

      // Remote timeout başlat (Accept edilse bile remote gelmezse)
      remoteTimeoutRef.current = setTimeout(() => {
        if (!remotePublished) {
          log('REMOTE_TIMEOUT_EXPIRED');
        }
      }, REMOTE_TIMEOUT_MS);

    } catch (e) {
      log('JOIN_CHANNEL_ERROR', { error: String(e) });
      isJoining.current = false;
    }
  }, [isVideo, mode, failCall, endCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: in_call STATE TRANSİTİON
  // "Bağlandı" = audioPlaying && (isVideo ? videoPlaying : true) && userAccepted
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const mediaReady = isVideo 
      ? (audioPlaying && videoPlaying)
      : audioPlaying;

    if (mediaReady && userAccepted && localPublished && remoteSubscribed) {
      if (callState !== 'in_call' && callState !== 'ended' && callState !== 'error') {
        log('STATE_TRANSITION_IN_CALL', { 
          audioPlaying, 
          videoPlaying: isVideo ? videoPlaying : 'N/A',
          userAccepted,
          localPublished,
          remoteSubscribed,
          ms: Date.now() - callStartTs.current
        });
        setCallState('in_call');
        stopRingtone();
        stopRingback();  // Bağlanınca ringback'i durdur
        startDurationTimer();
        haptic('light');
      }
    }
  }, [audioPlaying, videoPlaying, userAccepted, localPublished, remoteSubscribed, callState, isVideo, stopRingtone, stopRingback, startDurationTimer]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: COMPONENT MOUNT - HEMEN RTC JOIN BAŞLAT (ACCEPT BEKLEMİYOR!)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || !callId) return;
    
    log('CALL_SCREEN_OPEN', { mode, callId, channelName, hasToken: !!agoraToken, isVideo });
    callStartTs.current = Date.now();

    // Ringtone (sadece callee)
    if (mode === 'receiver') {
      startRingtone();
    }
    
    // Ringback (sadece caller - "Aranıyor" sırasında)
    if (mode === 'caller') {
      startRingback();
      // Pulse animation başlat
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // KRİTİK: Token varsa HEMEN RTC join başlat - ACCEPT BEKLEMİYOR!
    // ════════════════════════════════════════════════════════════════════════════
    if (agoraToken && channelName) {
      log('RTC_JOIN_ON_MOUNT_IMMEDIATELY', { mode });
      initAndJoinChannel(agoraToken, channelName);
    }

    return () => {
      log('CALL_SCREEN_UNMOUNT');
    };
  }, [visible, callId]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: Token sonradan gelebilir (caller için)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible && agoraToken && channelName && !hasJoined.current && !isJoining.current) {
      log('RTC_JOIN_ON_TOKEN_RECEIVED', { mode });
      initAndJoinChannel(agoraToken, channelName);
    }
  }, [visible, agoraToken, channelName, initAndJoinChannel]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: Caller - callAccepted geldiğinde
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('CALLER_RECEIVED_ACCEPT', { ms: Date.now() - callStartTs.current });
      // RTC zaten join edilmiş, sadece state güncelle
      setCallState('connecting');
    }
  }, [callAccepted, mode]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: External events
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callRejected) {
      log('CALL_REJECTED_EXTERNAL');
      endCall();
    }
  }, [callRejected, endCall]);

  useEffect(() => {
    if (callEnded) {
      log('CALL_ENDED_EXTERNAL');
      endCall();
    }
  }, [callEnded, endCall]);

  useEffect(() => {
    if (receiverOffline) {
      log('RECEIVER_OFFLINE');
      failCall('Karşı taraf çevrimdışı');
    }
  }, [receiverOffline, failCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: Cleanup on unmount
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════════
  
  // ACCEPT - SADECE UI STATE DEĞİŞİR (RTC zaten join edilmiş!)
  const handleAccept = useCallback(() => {
    log('ACCEPT_PRESSED', { 
      callId, 
      rtcJoined, 
      localPublished,
      ms: Date.now() - callStartTs.current 
    });
    haptic('medium');
    
    stopRingtone();
    setUserAccepted(true);
    setCallState('connecting');
    
    // Socket'e bildir
    onAccept();
    
    // RTC zaten join edilmiş olmalı - tekrar join YAPMA!
    if (!hasJoined.current && agoraToken && channelName) {
      log('ACCEPT_RTC_NOT_JOINED_YET_JOINING_NOW');
      initAndJoinChannel(agoraToken, channelName);
    }
  }, [callId, rtcJoined, localPublished, agoraToken, channelName, stopRingtone, onAccept, initAndJoinChannel]);

  const handleReject = useCallback(() => {
    log('REJECT_PRESSED', { callId });
    haptic('heavy');
    
    stopRingtone();
    setCallState('ended');
    onReject();
    setTimeout(() => onClose(), 300);
  }, [callId, stopRingtone, onReject, onClose]);

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

  const getStatusText = () => {
    switch (callState) {
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
      case 'connecting': return 'Bağlanıyor...';
      case 'in_call': return formatTime(duration);
      case 'error': return errorMessage || 'Hata';
      case 'ended': return 'Arama Bitti';
      default: return '';
    }
  };

  // "Bağlandı" = in_call && audioPlaying && (video ? videoPlaying : true)
  const mediaReady = isVideo ? (audioPlaying && videoPlaying) : audioPlaying;
  const showConnectedBadge = callState === 'in_call' && mediaReady;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video */}
        {isVideo && remoteUid && (callState === 'in_call' || callState === 'connecting') && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
          />
        )}

        {/* Local Video PIP */}
        {isVideo && rtcJoined && !isCameraOff && (
          <View style={styles.pip}>
            <RtcSurfaceView
              style={styles.pipVideo}
              canvas={{ 
                uid: 0, 
                sourceType: VideoSourceType.VideoSourceCamera,
                renderMode: RenderModeType.RenderModeHidden,
                mirrorMode: VideoMirrorModeType.VideoMirrorModeEnabled,
              }}
            />
          </View>
        )}

        {/* Call Type Badge */}
        <View style={[styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* RTC State Debug Panel */}
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>RTC:</Text>
          <View style={styles.debugRow}>
            <View style={[styles.dot, rtcJoined && styles.dotGreen]} />
            <Text style={styles.debugText}>Joined</Text>
          </View>
          <View style={styles.debugRow}>
            <View style={[styles.dot, localPublished && styles.dotGreen]} />
            <Text style={styles.debugText}>Published</Text>
          </View>
          <View style={styles.debugRow}>
            <View style={[styles.dot, remotePublished && styles.dotGreen]} />
            <Text style={styles.debugText}>Remote</Text>
          </View>
          <View style={styles.debugRow}>
            <View style={[styles.dot, audioPlaying && styles.dotGreen]} />
            <Text style={styles.debugText}>Audio</Text>
          </View>
          {isVideo && (
            <View style={styles.debugRow}>
              <View style={[styles.dot, videoPlaying && styles.dotGreen]} />
              <Text style={styles.debugText}>Video</Text>
            </View>
          )}
        </View>

        {/* Avatar */}
        {!(isVideo && remoteUid && (callState === 'in_call' || callState === 'connecting')) && (
          <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
            <Ionicons name={isVideo ? "videocam" : "person"} size={56} color="#fff" />
          </View>
        )}

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.callStatus}>{getStatusText()}</Text>

        {/* Connected Badge */}
        {showConnectedBadge && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlandı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {callState === 'ringing' && mode === 'receiver' && !userAccepted ? (
            <View style={styles.incomingRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.acceptBtn, isVideo && styles.acceptBtnVideo]} 
                onPress={handleAccept}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : callState === 'in_call' ? (
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
          ) : callState === 'error' ? (
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
              <Text style={styles.errorBtnText}>Kapat</Text>
            </TouchableOpacity>
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
  pip: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#000',
    zIndex: 100,
  },
  pipVideo: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  badgeVideo: { backgroundColor: '#9C27B0' },
  badgeAudio: { backgroundColor: '#4361ee' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  debugPanel: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 10,
  },
  debugTitle: { color: '#fff', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  debugRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#666', 
    marginRight: 6 
  },
  dotGreen: { backgroundColor: '#4CAF50' },
  debugText: { color: '#fff', fontSize: 10 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarVideo: { backgroundColor: '#9C27B0' },
  remoteName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 10,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
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
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnVideo: { backgroundColor: '#9C27B0' },
  rejectBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  errorBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
