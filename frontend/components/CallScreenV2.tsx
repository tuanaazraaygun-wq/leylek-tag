/**
 * CallScreenV2 - PRODUCTION RTC IMPLEMENTATION
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 * RTC LIFECYCLE RULES (ZORUNLU)
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * SOURCE OF TRUTH: Agora RTC lifecycle (NOT UI state)
 * 
 * SEQUENCE (MUTLAKA BU SIRAYA UYULACAK):
 * 1. createEngine (TEK instance, re-render'da yeniden yaratılmayacak)
 * 2. joinChannel
 * 3. getUserMedia (audio/video track'ler alınacak)
 * 4. publishLocalTracks (ZORUNLU)
 * 5. remote user publish
 * 6. subscribe(remoteTracks)
 * 7. UI in_call
 * 
 * PUBLISH GARANTİSİ:
 * - publishLocalTracks() başarılı olmadan state değişmeyecek
 * - publish başarısızsa state 'error' olacak
 * 
 * DEADLOCK ÖNLEME:
 * - "Ben publish etmeden karşı tarafı beklemem"
 * - joinChannelSuccess → IMMEDIATELY → publishLocalTracks
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
  ConnectionChangedReasonType,
} from 'react-native-agora';

const AGORA_APP_ID = '43c07f0cef814fd4a5ae3283c8bd77de';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════════════════════════
// STATE TYPES (STRICT)
// ════════════════════════════════════════════════════════════════════════════════
type CallState = 
  | 'calling'       // Socket outgoing
  | 'ringing'       // Socket incoming  
  | 'connecting'    // joinChannel in progress
  | 'media_ready'   // LOCAL publish DONE
  | 'in_call'       // BOTH SIDES publish & subscribe DONE
  | 'error'         // RTC error
  | 'ended';        // leaveChannel + cleanup

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
// LOGGING (ZORUNLU)
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
// PERMISSION (EXPO RULE)
// ════════════════════════════════════════════════════════════════════════════════
const requestPermissions = async (needVideo: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (needVideo) {
      permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    log('PERMISSION_REQUEST', { permissions });

    const results = await PermissionsAndroid.requestMultiple(permissions as any);
    
    const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
    const cameraGranted = !needVideo || results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';
    
    log('PERMISSION_RESULT', { audioGranted, cameraGranted });
    
    if (!audioGranted) {
      log('PERMISSION_DENIED_AUDIO');
      return false;
    }
    if (needVideo && !cameraGranted) {
      log('PERMISSION_DENIED_CAMERA');
      return false;
    }
    
    return true;
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

  // RTC State flags (SOURCE OF TRUTH)
  const [localJoined, setLocalJoined] = useState(false);
  const [localPublished, setLocalPublished] = useState(false);
  const [remotePublished, setRemotePublished] = useState(false);
  const [remoteSubscribed, setRemoteSubscribed] = useState(false);

  // Freeze callType to prevent video→audio downgrade
  const isVideo = useRef(callType === 'video').current;

  // ══════════════════════════════════════════════════════════════════════════════
  // REFS (SINGLE INSTANCE - NEVER RECREATE)
  // ══════════════════════════════════════════════════════════════════════════════
  const engineRef = useRef<IRtcEngine | null>(null);
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const isInitialized = useRef(false);
  const isJoining = useRef(false);
  const isPublishing = useRef(false);
  const isCleaningUp = useRef(false);
  const localUid = useRef<number>(Math.floor(Math.random() * 100000) + 1);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const callStartTs = useRef<number>(Date.now());

  // ══════════════════════════════════════════════════════════════════════════════
  // DURATION TIMER
  // ══════════════════════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════════════════
  // RINGTONE (CALLEE)
  // ══════════════════════════════════════════════════════════════════════════════
  const startRingtone = useCallback(() => {
    if (mode === 'receiver') {
      log('RINGTONE_START');
      Vibration.vibrate([0, 500, 300, 500], true);
    }
  }, [mode]);

  const stopRingtone = useCallback(() => {
    log('RINGTONE_STOP');
    Vibration.cancel();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // CLEANUP (DISPOSE TRACKS ONLY ON UNMOUNT)
  // ══════════════════════════════════════════════════════════════════════════════
  const cleanup = useCallback(async () => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    log('CLEANUP_START');
    stopDurationTimer();
    stopRingtone();

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

    isInitialized.current = false;
    isJoining.current = false;
    isPublishing.current = false;
    isCleaningUp.current = false;

    log('CLEANUP_DONE');
  }, [stopDurationTimer, stopRingtone]);

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
  // INITIALIZE ENGINE (RULE 1: SINGLE INSTANCE)
  // ══════════════════════════════════════════════════════════════════════════════
  const initializeEngine = useCallback(async (): Promise<boolean> => {
    if (isInitialized.current && engineRef.current) {
      log('ENGINE_ALREADY_INITIALIZED');
      return true;
    }

    log('AGORA_ENGINE_CREATE_START');

    try {
      const engine = createAgoraRtcEngine();
      
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      log('AGORA_ENGINE_CREATED');

      // Audio setup
      engine.setAudioProfile(
        AudioProfileType.AudioProfileSpeechStandard,
        AudioScenarioType.AudioScenarioChatroom
      );
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      log('AGORA_AUDIO_ENABLED');

      // Video setup (if needed)
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

      // Set as broadcaster (can send AND receive)
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // ════════════════════════════════════════════════════════════════════════
      // EVENT HANDLERS (RULE 3: ZORUNLU)
      // ════════════════════════════════════════════════════════════════════════
      const handler: IRtcEngineEventHandler = {
        
        // JOIN SUCCESS → IMMEDIATELY PUBLISH
        onJoinChannelSuccess: (connection, elapsed) => {
          log('AGORA_JOIN_SUCCESS', { 
            channel: connection.channelId, 
            uid: connection.localUid, 
            elapsed 
          });
          setLocalJoined(true);
          
          // RULE 4: DEADLOCK ÖNLEME - Hemen publish et
          // React Native Agora'da joinChannel ile birlikte publish otomatik yapılır
          // publishMicrophoneTrack: true ile
          log('LOCAL_TRACKS_PUBLISHING_AUTO');
        },

        // LOCAL AUDIO PUBLISH STATE
        onAudioPublishStateChanged: (channel, oldState, newState, elapseSinceLastState) => {
          log('AUDIO_PUBLISH_STATE_CHANGED', { oldState, newState, elapseSinceLastState });
          // 0: Idle, 1: NoPublish, 2: Publishing, 3: Published
          if (newState === 3) {
            log('LOCAL_TRACKS_PUBLISHED');
            setLocalPublished(true);
            isPublishing.current = false;
          }
        },

        // LOCAL VIDEO PUBLISH STATE
        onVideoPublishStateChanged: (source, channel, oldState, newState, elapseSinceLastState) => {
          log('VIDEO_PUBLISH_STATE_CHANGED', { source, oldState, newState });
          if (newState === 3 && isVideo) {
            log('LOCAL_VIDEO_PUBLISHED');
          }
        },

        // REMOTE USER JOINED CHANNEL
        onUserJoined: (connection, uid, elapsed) => {
          log('REMOTE_USER_JOINED', { uid, elapsed });
          setRemoteUid(uid);
        },

        // ════════════════════════════════════════════════════════════════════════
        // RULE 3: REMOTE USER PUBLISHED (EN KRİTİK EVENT)
        // ════════════════════════════════════════════════════════════════════════
        onUserPublished: (connection, uid, mediaType) => {
          log('REMOTE_USER_PUBLISHED', { uid, mediaType });
          setRemotePublished(true);
          
          // Subscribe to remote stream
          if (engineRef.current) {
            // mediaType: 1 = audio, 2 = video
            if (mediaType === 1) {
              engineRef.current.muteRemoteAudioStream(uid, false);
              log('REMOTE_AUDIO_SUBSCRIBED', { uid });
            } else if (mediaType === 2) {
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

        // CONNECTION STATE (RULE 3)
        onConnectionStateChanged: (connection, state, reason) => {
          log('CONNECTION_STATE_CHANGED', { state, reason });
          // ConnectionStateType: 1=Disconnected, 2=Connecting, 3=Connected, 4=Reconnecting, 5=Failed
          if (state === ConnectionStateType.ConnectionStateFailed) {
            log('CONNECTION_FAILED', { reason });
            setErrorMessage('Bağlantı başarısız');
            setCallState('error');
          }
        },

        // EXCEPTION (RULE 3)
        onError: (err, msg) => {
          log('AGORA_ERROR', { err, msg });
          if (err !== 0) {
            setErrorMessage(`Hata: ${msg}`);
          }
        },

        onLeaveChannel: (connection, stats) => {
          log('AGORA_LEAVE_CHANNEL_EVENT', { stats });
          setLocalJoined(false);
          setLocalPublished(false);
        },

        // First remote audio frame decoded - AUDIO PLAYING
        onFirstRemoteAudioDecoded: (connection, uid, elapsed) => {
          log('AUDIO_PLAYING', { uid, elapsed });
        },

        // First remote video frame rendered - VIDEO RENDERING  
        onFirstRemoteVideoFrame: (connection, uid, width, height, elapsed) => {
          log('VIDEO_RENDERING', { uid, width, height, elapsed });
        },
      };

      eventHandlerRef.current = handler;
      engine.registerEventHandler(handler);
      log('EVENT_HANDLER_REGISTERED');

      engineRef.current = engine;
      isInitialized.current = true;

      return true;
    } catch (e) {
      log('ENGINE_INIT_ERROR', { error: String(e) });
      setErrorMessage('Engine başlatılamadı');
      setCallState('error');
      return false;
    }
  }, [isVideo, endCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // JOIN CHANNEL (RULE 2: PUBLISH GARANTİSİ)
  // ══════════════════════════════════════════════════════════════════════════════
  const joinChannel = useCallback(async () => {
    if (isJoining.current) {
      log('JOIN_ALREADY_IN_PROGRESS');
      return;
    }
    
    if (!channelName || !agoraToken) {
      log('JOIN_MISSING_PARAMS', { channel: !!channelName, token: !!agoraToken });
      return;
    }

    isJoining.current = true;
    setCallState('connecting');

    log('JOIN_CHANNEL_START', { channel: channelName, uid: localUid.current, isVideo });

    // 1. Check permissions (EXPO RULE)
    const hasPermission = await requestPermissions(isVideo);
    if (!hasPermission) {
      log('JOIN_PERMISSION_DENIED');
      setErrorMessage('Mikrofon izni gerekli');
      setCallState('error');
      isJoining.current = false;
      return;
    }

    // 2. Initialize engine
    const initialized = await initializeEngine();
    if (!initialized) {
      log('JOIN_ENGINE_INIT_FAILED');
      isJoining.current = false;
      return;
    }

    // 3. Join channel with auto-publish
    try {
      isPublishing.current = true;
      
      // RULE 2: publishMicrophoneTrack ve publishCameraTrack ile
      // joinChannel çağrıldığında otomatik publish yapılır
      engineRef.current?.joinChannel(agoraToken, channelName, localUid.current, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
      });

      log('JOIN_CHANNEL_CALLED', { 
        channel: channelName, 
        uid: localUid.current,
        publishMic: true,
        publishCam: isVideo 
      });

    } catch (e) {
      log('JOIN_CHANNEL_ERROR', { error: String(e) });
      setErrorMessage('Kanala katılınamadı');
      setCallState('error');
      isJoining.current = false;
      isPublishing.current = false;
    }
  }, [channelName, agoraToken, isVideo, initializeEngine]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: STATE TRANSITIONS (RULE 8)
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // media_ready: LOCAL publish DONE
    if (localJoined && localPublished && callState === 'connecting') {
      log('STATE_TRANSITION: connecting → media_ready');
      setCallState('media_ready');
    }
  }, [localJoined, localPublished, callState]);

  useEffect(() => {
    // in_call: BOTH SIDES publish & subscribe DONE
    if (localPublished && remotePublished && remoteSubscribed && 
        (callState === 'media_ready' || callState === 'connecting')) {
      log('STATE_TRANSITION: → in_call (BOTH SIDES READY)');
      setCallState('in_call');
      stopRingtone();
      startDurationTimer();
      haptic('light');
    }
  }, [localPublished, remotePublished, remoteSubscribed, callState, stopRingtone, startDurationTimer]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CALLER FLOW
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!visible || mode !== 'caller') return;

    log('CALLER_FLOW_START', { callId, channelName, hasToken: !!agoraToken });

    // Caller joins immediately if token is available
    if (agoraToken && channelName) {
      joinChannel();
    }
  }, [visible, mode, callId, channelName, agoraToken, joinChannel]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CALLEE - Start ringtone
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (visible && mode === 'receiver' && callState === 'ringing') {
      log('CALLEE_RINGING', { callId });
      startRingtone();
    }
  }, [visible, mode, callState, callId, startRingtone]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: CALLER - Call accepted by callee
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (callAccepted && mode === 'caller') {
      log('CALLER_RECEIVED_ACCEPT');
      // Caller should already be in channel, just wait for remote publish
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
      endCall();
    }
  }, [receiverOffline, endCall]);

  // ══════════════════════════════════════════════════════════════════════════════
  // EFFECT: Cleanup on unmount
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      log('COMPONENT_UNMOUNT');
      cleanup();
    };
  }, [cleanup]);

  // ══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════════
  const handleAccept = useCallback(async () => {
    log('ACCEPT_PRESSED', { callId, channelName });
    haptic('medium');
    
    stopRingtone();
    onAccept(); // Signal socket
    
    // Join channel and publish
    await joinChannel();
  }, [callId, channelName, stopRingtone, onAccept, joinChannel]);

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
      case 'media_ready': return 'Medya Hazır...';
      case 'in_call': return formatTime(duration);
      case 'error': return errorMessage || 'Hata';
      case 'ended': return 'Arama Bitti';
      default: return '';
    }
  };

  const showConnectedBadge = callState === 'in_call' && localPublished && remotePublished && remoteSubscribed;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        
        {/* Remote Video */}
        {isVideo && remoteUid && callState === 'in_call' && (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
          />
        )}

        {/* Local Video PIP */}
        {isVideo && localJoined && !isCameraOff && (
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
            <View style={styles.pipLabel}>
              <Text style={styles.pipLabelText}>Sen</Text>
            </View>
          </View>
        )}

        {/* Call Type Badge */}
        <View style={[styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio]}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isVideo ? 'Görüntülü' : 'Sesli'}</Text>
        </View>

        {/* Debug: RTC State Indicators */}
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>RTC State:</Text>
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, localJoined && styles.debugDotActive]} />
            <Text style={styles.debugText}>Joined</Text>
          </View>
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, localPublished && styles.debugDotActive]} />
            <Text style={styles.debugText}>Published</Text>
          </View>
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, remotePublished && styles.debugDotActive]} />
            <Text style={styles.debugText}>Remote Pub</Text>
          </View>
          <View style={styles.debugRow}>
            <View style={[styles.debugDot, remoteSubscribed && styles.debugDotActive]} />
            <Text style={styles.debugText}>Subscribed</Text>
          </View>
        </View>

        {/* Avatar */}
        {!(isVideo && remoteUid && callState === 'in_call') && (
          <View style={[styles.avatar, isVideo && styles.avatarVideo]}>
            <Ionicons name={isVideo ? "videocam" : "person"} size={56} color="#fff" />
          </View>
        )}

        {/* Name & Status */}
        <Text style={styles.remoteName}>{remoteName}</Text>
        <Text style={styles.callStatus}>{getStatusText()}</Text>

        {/* Connected Badge - ONLY when both sides ready */}
        {showConnectedBadge && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.connectedText}>Bağlandı</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {callState === 'ringing' && mode === 'receiver' ? (
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
  pipLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pipLabelText: { color: '#fff', fontSize: 10, fontWeight: '600' },
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 10,
  },
  debugTitle: { color: '#fff', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  debugRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  debugDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#666', 
    marginRight: 6 
  },
  debugDotActive: { backgroundColor: '#4CAF50' },
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
