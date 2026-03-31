import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Vibration,
  Platform,
  Animated,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InCallManager from 'react-native-incall-manager';
import type { RtcConnection } from 'react-native-agora';
import { agoraVoiceService } from '../services/agoraVoiceService';
import { agoraUidFromUserId } from '../lib/agoraUid';
import { API_BASE_URL } from '../lib/backendConfig';

type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'ended';

export interface CallScreenV2Props {
  visible: boolean;
  mode: 'caller' | 'receiver';
  callId: string;
  channelName: string;
  agoraToken?: string /** Arayan için start-call yanıtı; alıcı accept-call sonrası doldurulur */;
  userId: string;
  remoteUserId: string;
  remoteName: string;
  /** UI uyumluluğu; Agora tarafı yalnızca ses */
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

const LOG = (msg: string, data?: unknown) => {
  const t = new Date().toISOString().split('T')[1]?.split('.')[0];
  console.log(`📞 [${t}] ${msg}`, data !== undefined ? data : '');
};

export default function CallScreenV2({
  visible,
  mode,
  callId,
  channelName,
  agoraToken: agoraTokenProp = '',
  userId,
  remoteUserId: _remoteUserId,
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
}: CallScreenV2Props) {
  void _remoteUserId;

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [remoteUid, setRemoteUid] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [status, setStatus] = useState('');
  const [joined, setJoined] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speakerRef = useRef(true);
  speakerRef.current = speakerOn;
  const prevSessionKeyRef = useRef('');
  /** Caller oturumunda useEffect’in ikinci kez startOutgoing çalıştırmasını engeller */
  const callerJoinExecutedRef = useRef(false);

  const myUid = agoraUidFromUserId(userId);

  const stopTimersAndRing = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Vibration.cancel();
    try {
      InCallManager.stopRingtone();
    } catch {
      /* noop */
    }
    try {
      InCallManager.stop();
    } catch {
      /* noop */
    }
  }, []);

  const runCleanup = useCallback(async () => {
    stopTimersAndRing();
    agoraVoiceService.resetCallbacks();
    await agoraVoiceService.leaveChannelAndDestroy();
    setJoined(false);
  }, [stopTimersAndRing]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('İzin gerekli', 'Sesli arama için mikrofon izni şart.');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const attachEngineHandlers = useCallback(() => {
    agoraVoiceService.setCallbacks({
      onJoinChannelSuccess: (_connection: RtcConnection) => {
        LOG('Kanala katılındı', { channelName, uid: myUid });
        setStatus('Bağlandı');
      },
      onUserJoined: (_connection: RtcConnection, uid: number) => {
        LOG('Karşı taraf kanalda', { uid });
        setRemoteUid(uid);
        setPhase('active');
        setStatus('Görüşmedesiniz');
        stopTimersAndRing();
        try {
          InCallManager.start({ media: 'audio' });
          InCallManager.setForceSpeakerphoneOn(speakerRef.current);
        } catch {
          /* noop */
        }
        startDurationTimer();
      },
      onUserOffline: (_connection: RtcConnection, uid: number) => {
        LOG('Karşı taraf ayrıldı', { uid });
        setRemoteUid(0);
        setStatus('Bağlantı kesildi');
        setPhase('ended');
      },
      onError: (err, msg) => {
        console.log('AGORA JOIN ERROR', err);
        LOG('Agora hata', { err, msg });
        setStatus('Bağlantı hatası');
      },
    });
  }, [channelName, myUid, startDurationTimer, stopTimersAndRing]);

  const startOutgoing = useCallback(async () => {
    LOG('Giden arama (Agora ses)');
    setPhase('outgoing');
    setStatus('Aranıyor…');
    try {
      /* Giden aramada ringback kullanma — kullanıcıda “kendi telefonum çalıyor” algısı oluşuyor */
      InCallManager.start({ media: 'audio' });
    } catch {
      /* noop */
    }

    const ok = await requestMicPermission();
    if (!ok) {
      setPhase('ended');
      return;
    }
    await agoraVoiceService.initialize();

    const ch = channelName?.trim();
    const tok = agoraTokenProp?.trim();
    if (!tok || !ch) {
      Alert.alert('Hata', 'Arama bileti (token) alınamadı.');
      setPhase('ended');
      return;
    }
    attachEngineHandlers();
    if (agoraVoiceService.isJoinPending()) {
      setJoined(true);
      callerJoinExecutedRef.current = true;
      return;
    }
    await agoraVoiceService.joinChannel(ch, tok, myUid);
    setJoined(true);
    callerJoinExecutedRef.current = true;
  }, [agoraTokenProp, channelName, attachEngineHandlers, myUid, requestMicPermission]);

  const acceptIncoming = useCallback(async () => {
    if (joined) return;
    LOG('Gelen arama kabul');
    setPhase('connecting');
    setStatus('Bağlanıyor…');
    stopTimersAndRing();

    try {
      const response = await fetch(
        `${API_BASE_URL}/voice/accept-call?user_id=${encodeURIComponent(
          userId
        )}&call_id=${encodeURIComponent(callId)}`,
        { method: 'POST' }
      );
      const data = await response.json();

      console.log('ACCEPT TOKEN', data.agora_token);
      console.log('CHANNEL', data.channel_name);

      if (!data?.success) {
        Alert.alert('Hata', (data?.detail as string) || 'Arama kabul edilemedi');
        setPhase('ended');
        return;
      }

      if (!data.agora_token || !data.channel_name) {
        return;
      }

      onAccept();

      const micOk = await requestMicPermission();
      if (!micOk) {
        setPhase('ended');
        return;
      }

      if (agoraVoiceService.isJoinPending()) {
        await agoraVoiceService.leaveChannelAndDestroy();
      }

      await agoraVoiceService.initialize();
      attachEngineHandlers();
      console.log('RECEIVER JOIN', {
        channel: data.channel_name,
        token: data.agora_token,
        uid: agoraUidFromUserId(userId),
      });
      try {
        await agoraVoiceService.joinChannel(
          data.channel_name,
          data.agora_token,
          agoraUidFromUserId(userId)
        );
      } catch (e) {
        console.log('JOIN FAILED', e);
        setStatus('Bağlantı hatası');
        return;
      }
      setJoined(true);
      setStatus('Bağlandı');
    } catch (e) {
      console.log('ACCEPT ERROR', e);
      LOG('accept-call hata', e);
      Alert.alert('Hata', 'Sunucuya ulaşılamadı');
      setPhase('ended');
    }
  }, [callId, joined, onAccept, requestMicPermission, stopTimersAndRing, userId, attachEngineHandlers]);

  const rejectIncoming = useCallback(() => {
    LOG('Gelen arama red');
    stopTimersAndRing();
    setPhase('ended');
    onReject();
    setTimeout(onClose, 250);
  }, [onClose, onReject, stopTimersAndRing]);

  const hangUp = useCallback(async (reason: string = 'user') => {
    console.log('HANGUP TRIGGERED', reason);
    console.log('CALLER HANGUP', reason);
    LOG('Arama bitiriliyor', { reason });
    stopTimersAndRing();
    await runCleanup();
    setPhase('ended');
    onEnd();
    setTimeout(onClose, 250);
  }, [onClose, onEnd, runCleanup, stopTimersAndRing]);

  const endWithoutNotify = useCallback(async (reason: string) => {
    console.log('HANGUP TRIGGERED', reason);
    LOG('Arama lokal kapatılıyor', { reason });
    stopTimersAndRing();
    await runCleanup();
    setPhase('ended');
    setTimeout(onClose, 250);
  }, [onClose, runCleanup, stopTimersAndRing]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    agoraVoiceService.setMuted(next);
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    agoraVoiceService.setSpeakerOn(next);
    try {
      InCallManager.setForceSpeakerphoneOn(next);
    } catch {
      /* noop */
    }
    setSpeakerOn(next);
  }, [speakerOn]);

  useEffect(() => {
    if (!visible) {
      void runCleanup();
      prevSessionKeyRef.current = '';
      return;
    }
    if (!callId) {
      return;
    }

    const sessionKey = `${callId}|${channelName}|${mode}`;
    let cancelled = false;

    void (async () => {
      const prev = prevSessionKeyRef.current;
      if (prev && prev !== sessionKey) {
        await runCleanup();
      }
      if (cancelled) return;

      prevSessionKeyRef.current = sessionKey;

      LOG('CallScreenV2 açıldı', { mode, callId, channelName });
      setRemoteUid(0);
      setDuration(0);
      setMuted(false);
      setSpeakerOn(true);
      setPhase('idle');
      setStatus('');
      setJoined(false);
      callerJoinExecutedRef.current = false;

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();

      if (mode === 'caller') {
        if (callerJoinExecutedRef.current) return;
        await startOutgoing();
      } else {
        setPhase('incoming');
        setStatus('Gelen arama');
        try {
          InCallManager.startRingtone('_DEFAULT_');
          Vibration.vibrate([0, 600, 300, 600], true);
        } catch {
          /* noop */
        }
      }
    })();

    return () => {
      cancelled = true;
      pulseAnim.stopAnimation();
    };
    // runCleanup cleanup’ta yok: ring/kabul sırasında effect’in yeniden çalışması motoru öldürmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startOutgoing/runCleanup dep'e alınmaz
  }, [visible, callId, mode, channelName, pulseAnim]);

  useEffect(() => {
    if (callAccepted && mode === 'caller' && phase === 'outgoing') {
      setPhase('active');
      setStatus('Görüşmedesiniz');
      stopTimersAndRing();
    }
  }, [callAccepted, mode, phase, stopTimersAndRing]);

  useEffect(() => {
    if (!callRejected) return;
    if (mode === 'receiver') {
      console.log('AUTO HANGUP BLOCKED', 'callRejected');
      return;
    }
    setStatus('Arama reddedildi');
    setPhase('ended');
    stopTimersAndRing();
    const t = setTimeout(() => void endWithoutNotify('remote_rejected'), 1200);
    return () => clearTimeout(t);
  }, [callRejected, endWithoutNotify, mode, stopTimersAndRing]);

  useEffect(() => {
    if (!callEnded) return;
    setStatus('Arama sonlandı');
    setPhase('ended');
    const t = setTimeout(() => void endWithoutNotify('remote_call_ended'), 400);
    return () => clearTimeout(t);
  }, [callEnded, endWithoutNotify]);

  useEffect(() => {
    if (!receiverOffline) return;
    if (mode === 'receiver') {
      console.log('AUTO HANGUP BLOCKED', 'receiverOffline');
      return;
    }
    setStatus('Kullanıcı çevrimdışı');
    setPhase('ended');
    stopTimersAndRing();
    const t = setTimeout(() => void endWithoutNotify('receiver_offline'), 2000);
    return () => clearTimeout(t);
  }, [endWithoutNotify, mode, receiverOffline, stopTimersAndRing]);

  if (!visible) return null;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const showIncoming = phase === 'incoming';
  const showConnecting = phase === 'outgoing' || phase === 'connecting';
  const showActive = phase === 'active' && remoteUid > 0;

  const headerLabel =
    callType === 'video' ? 'Görüntülü arama (ses)' : 'Sesli arama';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.headerType}>{headerLabel}</Text>
        </View>

        <View style={styles.center}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {remoteName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          </Animated.View>
          <Text style={styles.name}>{remoteName}</Text>
          <Text style={styles.sub}>
            {showActive ? formatTime(duration) : status || '—'}
          </Text>
        </View>

        <View style={styles.bottom}>
          {showIncoming ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnDecline} onPress={rejectIncoming}>
                <Ionicons name="call" size={32} color="#fff" style={styles.iconHangup} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAccept} onPress={() => void acceptIncoming()}>
                <Ionicons name="call" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}

          {showConnecting && !showIncoming ? (
            <TouchableOpacity style={styles.fabHangup} onPress={() => void hangUp('user')}>
              <Ionicons name="call" size={30} color="#fff" style={styles.iconHangup} />
            </TouchableOpacity>
          ) : null}

          {showActive ? (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.fabSmall, muted && styles.fabSmallOn]}
                onPress={toggleMute}
                accessibilityLabel="Sesi kapat"
              >
                <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fabHangup} onPress={() => void hangUp('user')}>
                <Ionicons name="call" size={30} color="#fff" style={styles.iconHangup} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabSmall, speakerOn && styles.fabSmallOn]}
                onPress={toggleSpeaker}
                accessibilityLabel="Hoparlör"
              >
                <Ionicons name={speakerOn ? 'volume-high' : 'volume-low'} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {__DEV__ ? (
          <Text style={styles.devLine}>
            {phase} · ch {channelName.slice(-8)} · uid {myUid}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const WA_BG = '#0B141A';
const WA_GREEN = '#25D366';
const WA_RED = '#EA4335';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: WA_BG,
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 40,
  },
  top: {
    paddingHorizontal: 20,
  },
  headerType: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1F2C34',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarLetter: {
    fontSize: 48,
    fontWeight: '600',
    color: '#E9EDEF',
  },
  name: {
    fontSize: 26,
    fontWeight: '600',
    color: '#E9EDEF',
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: '#8696A0',
    textAlign: 'center',
  },
  bottom: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  btnDecline: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: WA_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccept: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: WA_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabHangup: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: WA_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#202C33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSmallOn: {
    backgroundColor: '#2A3942',
  },
  iconHangup: { transform: [{ rotate: '135deg' }] },
  devLine: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    color: '#5F6368',
    fontSize: 10,
  },
});
