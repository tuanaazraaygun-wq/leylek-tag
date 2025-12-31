/**
 * useAgoraEngine - Agora Singleton Engine Hook
 * 
 * Agora engine'i uygulama başlangıcında başlatır ve singleton olarak tutar.
 * - Engine bir kez oluşturulur ve yeniden kullanılır
 * - Token önceden alınır ve cache'lenir
 * - Arama anında joinChannel() hızlıca çağrılır
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcConnection,
  IRtcEngineEventHandler,
} from 'react-native-agora';
import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';

const AGORA_APP_ID = Constants.expoConfig?.extra?.agoraAppId || 
                     process.env.EXPO_PUBLIC_AGORA_APP_ID || 
                     '43c07f0cef814fd4a5ae3283c8bd77de';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://ride-call-system.preview.emergentagent.com';

console.log('🎙️ Agora App ID:', AGORA_APP_ID);

// Singleton engine instance
let engineInstance: IRtcEngine | null = null;
let engineInitialized = false;

// Token cache
interface TokenCache {
  token: string;
  channelName: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

interface UseAgoraEngineProps {
  userId: string | null;
  onUserJoined?: (uid: number) => void;
  onUserOffline?: (uid: number) => void;
  onJoinChannelSuccess?: (channel: string, uid: number) => void;
  onError?: (error: string) => void;
}

export default function useAgoraEngine({
  userId,
  onUserJoined,
  onUserOffline,
  onJoinChannelSuccess,
  onError,
}: UseAgoraEngineProps) {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isInChannel, setIsInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const currentChannelRef = useRef<string | null>(null);

  // Request permissions
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
        
        const audioGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 
                            PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted = granted[PermissionsAndroid.PERMISSIONS.CAMERA] === 
                             PermissionsAndroid.RESULTS.GRANTED;
        
        console.log('🎙️ Permissions:', { audioGranted, cameraGranted });
        return audioGranted && cameraGranted;
      } catch (err) {
        console.error('Permission error:', err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  };

  // Initialize engine (singleton)
  const initializeEngine = useCallback(async () => {
    if (engineInitialized && engineInstance) {
      console.log('🎙️ Engine already initialized');
      setIsEngineReady(true);
      return engineInstance;
    }

    console.log('🎙️ Initializing Agora engine...');

    try {
      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        console.error('❌ Permissions not granted');
        onError?.('Mikrofon ve kamera izinleri gerekli');
        return null;
      }

      // Create engine
      const engine = createAgoraRtcEngine();
      
      // Initialize with App ID
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Set up event handlers
      const eventHandler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
          console.log('✅ Joined channel:', connection.channelId, 'uid:', connection.localUid);
          setIsInChannel(true);
          onJoinChannelSuccess?.(connection.channelId || '', connection.localUid || 0);
        },
        onUserJoined: (connection: RtcConnection, remoteUid: number, elapsed: number) => {
          console.log('👤 User joined:', remoteUid);
          onUserJoined?.(remoteUid);
        },
        onUserOffline: (connection: RtcConnection, remoteUid: number, reason: number) => {
          console.log('👤 User offline:', remoteUid, 'reason:', reason);
          onUserOffline?.(remoteUid);
        },
        onError: (err: number, msg: string) => {
          console.error('❌ Agora error:', err, msg);
          onError?.(msg);
        },
        onLeaveChannel: (connection: RtcConnection, stats: any) => {
          console.log('📴 Left channel');
          setIsInChannel(false);
        },
      };

      engine.registerEventHandler(eventHandler);

      // Enable audio
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);
      engine.setEnableSpeakerphone(true);
      
      // Enable video (for video calls)
      engine.enableVideo();
      
      // Set client role
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      engineInstance = engine;
      engineInitialized = true;
      setIsEngineReady(true);
      
      console.log('✅ Agora engine initialized successfully');
      return engine;
    } catch (error) {
      console.error('❌ Failed to initialize Agora engine:', error);
      onError?.('Agora başlatılamadı');
      return null;
    }
  }, [onUserJoined, onUserOffline, onJoinChannelSuccess, onError]);

  // Pre-fetch token (call this on app start or when user logs in)
  const prefetchToken = useCallback(async (channelName: string): Promise<string | null> => {
    try {
      // Check cache first
      if (tokenCache && 
          tokenCache.channelName === channelName && 
          tokenCache.expiresAt > Date.now()) {
        console.log('🎫 Using cached token');
        return tokenCache.token;
      }

      console.log('🎫 Fetching Agora token for channel:', channelName);
      
      const response = await fetch(
        `${BACKEND_URL}/api/agora/token?channel_name=${channelName}&uid=0`
      );
      const data = await response.json();
      
      if (data.success && data.token) {
        // Cache token for 50 minutes (tokens typically expire in 1 hour)
        tokenCache = {
          token: data.token,
          channelName: channelName,
          expiresAt: Date.now() + 50 * 60 * 1000,
        };
        console.log('✅ Token fetched and cached');
        return data.token;
      } else {
        console.error('❌ Token fetch failed:', data);
        return null;
      }
    } catch (error) {
      console.error('❌ Token fetch error:', error);
      return null;
    }
  }, []);

  // Join channel IMMEDIATELY (no waiting for socket response)
  const joinChannel = useCallback(async (
    channelName: string, 
    token?: string,
    uid: number = 0
  ): Promise<boolean> => {
    if (!engineInstance) {
      console.error('❌ Engine not initialized');
      await initializeEngine();
      if (!engineInstance) return false;
    }

    try {
      // Use provided token or fetch new one
      let agoraToken = token;
      if (!agoraToken) {
        agoraToken = await prefetchToken(channelName);
      }

      if (!agoraToken) {
        console.error('❌ No token available');
        onError?.('Token alınamadı');
        return false;
      }

      console.log('📞 Joining channel IMMEDIATELY:', channelName);
      
      // Leave current channel if any
      if (currentChannelRef.current) {
        engineInstance.leaveChannel();
      }

      // Join channel with token
      engineInstance.joinChannel(agoraToken, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: false, // Audio call by default
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });

      currentChannelRef.current = channelName;
      return true;
    } catch (error) {
      console.error('❌ Join channel error:', error);
      onError?.('Kanala katılınamadı');
      return false;
    }
  }, [initializeEngine, prefetchToken, onError]);

  // Leave channel
  const leaveChannel = useCallback(() => {
    if (engineInstance && currentChannelRef.current) {
      console.log('📴 Leaving channel:', currentChannelRef.current);
      engineInstance.leaveChannel();
      currentChannelRef.current = null;
      setIsInChannel(false);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (engineInstance) {
      const newMuteState = !isMuted;
      engineInstance.muteLocalAudioStream(newMuteState);
      setIsMuted(newMuteState);
      console.log('🔇 Mute:', newMuteState);
    }
  }, [isMuted]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    if (engineInstance) {
      const newSpeakerState = !isSpeakerOn;
      engineInstance.setEnableSpeakerphone(newSpeakerState);
      setIsSpeakerOn(newSpeakerState);
      console.log('🔊 Speaker:', newSpeakerState);
    }
  }, [isSpeakerOn]);

  // Enable/disable video
  const enableVideo = useCallback((enable: boolean) => {
    if (engineInstance) {
      if (enable) {
        engineInstance.enableVideo();
        engineInstance.startPreview();
      } else {
        engineInstance.stopPreview();
        engineInstance.disableVideo();
      }
      console.log('📹 Video:', enable);
    }
  }, []);

  // Initialize engine on mount
  useEffect(() => {
    if (userId) {
      initializeEngine();
    }
  }, [userId, initializeEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't destroy engine on unmount - keep it as singleton
      // Only leave channel
      if (currentChannelRef.current && engineInstance) {
        engineInstance.leaveChannel();
      }
    };
  }, []);

  return {
    engine: engineInstance,
    isEngineReady,
    isInChannel,
    isMuted,
    isSpeakerOn,
    initializeEngine,
    prefetchToken,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleSpeaker,
    enableVideo,
  };
}

// Utility function to get engine instance
export function getAgoraEngine(): IRtcEngine | null {
  return engineInstance;
}

// Utility function to check if engine is ready
export function isAgoraEngineReady(): boolean {
  return engineInitialized && engineInstance !== null;
}
