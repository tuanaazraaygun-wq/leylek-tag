import {
  createAgoraRtcEngine,
  IRtcEngine,
  IRtcEngineEventHandler,
  ChannelProfileType,
  ClientRoleType,
  RtcConnection,
} from 'react-native-agora';
import { AGORA_APP_ID } from '../lib/agoraAppId';

export type AgoraVoiceCallbacks = {
  onJoinChannelSuccess?: (connection: RtcConnection, elapsed: number) => void;
  onUserJoined?: (connection: RtcConnection, uid: number, elapsed: number) => void;
  onUserOffline?: (connection: RtcConnection, uid: number, reason: number) => void;
  onError?: (err: number, msg: string) => void;
};

/**
 * Tekil ses kanalı Agora yöneticisi: join / leave + destroy, mute, hoparlör.
 */
export class AgoraVoiceService {
  private static instance: AgoraVoiceService;

  static getInstance(): AgoraVoiceService {
    if (!AgoraVoiceService.instance) {
      AgoraVoiceService.instance = new AgoraVoiceService();
    }
    return AgoraVoiceService.instance;
  }

  private engine: IRtcEngine | null = null;
  private eventHandler: IRtcEngineEventHandler | null = null;
  private callbacks: AgoraVoiceCallbacks = {};
  private joinRequested = false;

  /** joinChannel bir kez çağrıldıysa true (caller index’te join ettiğinde CallScreen tekrar join denemesin) */
  isJoinPending(): boolean {
    return this.joinRequested;
  }

  /** Join hatası / yeniden deneme için kapıyı aç */
  resetJoinGate(): void {
    this.joinRequested = false;
  }

  setCallbacks(next: AgoraVoiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...next };
  }

  resetCallbacks(): void {
    this.callbacks = {};
  }

  private buildHandler(): IRtcEngineEventHandler {
    return {
      onJoinChannelSuccess: (connection, elapsed) => {
        this.callbacks.onJoinChannelSuccess?.(connection, elapsed);
      },
      onUserJoined: (connection, uid, elapsed) => {
        this.callbacks.onUserJoined?.(connection, uid, elapsed);
      },
      onUserOffline: (connection, uid, reason) => {
        this.callbacks.onUserOffline?.(connection, uid, reason);
      },
      onError: (err, msg) => {
        console.log('AGORA JOIN ERROR', err);
        this.joinRequested = false;
        this.callbacks.onError?.(err, msg);
      },
    };
  }

  async initialize(): Promise<IRtcEngine> {
    if (this.engine) {
      return this.engine;
    }
    const engine = createAgoraRtcEngine() as IRtcEngine;
    engine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });
    this.eventHandler = this.buildHandler();
    engine.registerEventHandler(this.eventHandler);
    engine.enableAudio();
    engine.setAudioProfile(0, 1);
    engine.setDefaultAudioRouteToSpeakerphone(true);
    engine.setEnableSpeakerphone(true);
    this.engine = engine;
    return engine;
  }

  /**
   * @param token Boş string token yok projelerinde denenebilir; prod'da RTC token gerekir.
   */
  async joinChannel(channelName: string, token: string, uid: number): Promise<void> {
    if (!this.engine) {
      throw new Error('AgoraVoiceService.initialize() önce çağrılmalı');
    }
    if (this.joinRequested) {
      return;
    }
    this.joinRequested = true;
    this.engine.joinChannel(token, channelName, uid, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishCameraTrack: false,
      autoSubscribeAudio: true,
      autoSubscribeVideo: false,
    });
  }

  setMuted(muted: boolean): void {
    this.engine?.muteLocalAudioStream(muted);
  }

  setSpeakerOn(on: boolean): void {
    this.engine?.setEnableSpeakerphone(on);
  }

  async leaveChannelAndDestroy(): Promise<void> {
    const eng = this.engine;
    const handler = this.eventHandler;
    this.joinRequested = false;
    this.engine = null;
    this.eventHandler = null;
    if (!eng) {
      return;
    }
    try {
      eng.leaveChannel();
    } catch {
      /* noop */
    }
    try {
      if (handler) {
        eng.unregisterEventHandler(handler);
      }
    } catch {
      /* noop */
    }
    try {
      eng.release();
    } catch {
      /* noop */
    }
  }
}

export const agoraVoiceService = AgoraVoiceService.getInstance();
