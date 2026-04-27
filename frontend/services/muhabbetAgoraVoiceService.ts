import {
  createAgoraRtcEngine,
  IRtcEngine,
  IRtcEngineEventHandler,
  ChannelProfileType,
  ClientRoleType,
  RtcConnection,
} from 'react-native-agora';
import { MUHABBET_AGORA_APP_ID } from '../lib/muhabbetAgoraAppId';

export type MuhabbetAgoraVoiceCallbacks = {
  onJoinChannelSuccess?: (connection: RtcConnection, elapsed: number) => void;
  onUserJoined?: (connection: RtcConnection, uid: number, elapsed: number) => void;
  onUserOffline?: (connection: RtcConnection, uid: number, reason: number) => void;
  onError?: (err: number, msg: string) => void;
};

class MuhabbetAgoraVoiceService {
  private engine: IRtcEngine | null = null;
  private eventHandler: IRtcEngineEventHandler | null = null;
  private callbacks: MuhabbetAgoraVoiceCallbacks = {};
  private joinRequested = false;

  isJoinPending(): boolean {
    return this.joinRequested;
  }

  resetJoinGate(): void {
    this.joinRequested = false;
  }

  setCallbacks(next: MuhabbetAgoraVoiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...next };
  }

  resetCallbacks(): void {
    this.callbacks = {};
  }

  private buildHandler(): IRtcEngineEventHandler {
    return {
      onJoinChannelSuccess: (connection, elapsed) => {
        this.joinRequested = true;
        this.callbacks.onJoinChannelSuccess?.(connection, elapsed);
      },
      onUserJoined: (connection, uid, elapsed) => {
        this.callbacks.onUserJoined?.(connection, uid, elapsed);
      },
      onUserOffline: (connection, uid, reason) => {
        this.callbacks.onUserOffline?.(connection, uid, reason);
      },
      onError: (err, msg) => {
        this.joinRequested = false;
        this.callbacks.onError?.(err, msg);
      },
    };
  }

  async initialize(): Promise<IRtcEngine> {
    if (this.engine) return this.engine;
    const engine = createAgoraRtcEngine() as IRtcEngine;
    engine.initialize({
      appId: MUHABBET_AGORA_APP_ID,
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

  async joinChannel(channelName: string, token: string, uid: number): Promise<void> {
    if (!this.engine) {
      throw new Error('muhabbetAgoraVoiceService.initialize() önce çağrılmalı');
    }
    if (this.joinRequested) return;
    this.joinRequested = true;
    this.engine.joinChannel(token, channelName, uid, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishCameraTrack: false,
      autoSubscribeAudio: true,
      autoSubscribeVideo: false,
    });
  }

  async leaveChannelAndDestroy(): Promise<void> {
    const eng = this.engine;
    const handler = this.eventHandler;
    this.joinRequested = false;
    this.engine = null;
    this.eventHandler = null;
    if (!eng) return;
    try {
      eng.leaveChannel();
    } catch {
      /* noop */
    }
    try {
      if (handler) eng.unregisterEventHandler(handler);
    } catch {
      /* noop */
    }
    try {
      eng.release();
    } catch {
      /* noop */
    }
  }

  setMuted(muted: boolean): void {
    this.engine?.muteLocalAudioStream(muted);
  }

  setSpeakerOn(on: boolean): void {
    this.engine?.setEnableSpeakerphone(on);
  }
}

export const muhabbetAgoraVoiceService = new MuhabbetAgoraVoiceService();
