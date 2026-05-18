import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RtcSurfaceView } from 'react-native-agora';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { agoraUidFromUserId } from '../../lib/agoraUid';
import { agoraVoiceService } from '../../services/agoraVoiceService';
import { trustVideoJoin, trustVideoLeave } from '../../services/trustAgoraVideoService';
import { postTrustEnd } from '../../lib/trustApi';

export type TrustVideoSessionScreenProps = {
  visible: boolean;
  trustId: string;
  channelName: string;
  agoraToken: string;
  userId: string;
  peerUserId: string;
  /** Sunucunun session_hard_deadline_at (ISO) */
  sessionHardDeadlineAt: string;
  peerDisplayName: string;
  onClose: () => void;
};

function parseDeadlineMs(iso: string): number | null {
  const s = String(iso || '').trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return t;
}

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Premium trust video shell — görsel tokenlar (logic yok). */
const P = {
  bgDeep: '#08111F',
  bgMid: '#0B1220',
  bgElev: '#101A2B',
  border: '#1E3A5F',
  accent: '#22D3EE',
  text: 'rgba(243,248,255,0.94)',
  muted: 'rgba(186,201,222,0.82)',
  cyanEdge: 'rgba(34,211,238,0.42)',
  dangerGlass: 'rgba(185,28,28,0.38)',
  dangerGlassBorder: 'rgba(248,113,113,0.42)',
  hudBg: 'rgba(8,17,31,0.82)',
  blackVideo: '#020617',
};

const TrustVideoSessionScreen = memo(function TrustVideoSessionScreen({
  visible,
  trustId,
  channelName,
  agoraToken,
  userId,
  peerUserId,
  sessionHardDeadlineAt,
  peerDisplayName,
  onClose,
}: TrustVideoSessionScreenProps) {
  const insets = useSafeAreaInsets();
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteUid, setRemoteUid] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const endedRef = useRef(false);
  const deadlineMsRef = useRef<number | null>(null);
  const joinStartedRef = useRef(false);
  /** Yeni güven oturumu (trustId+kanal+token) — ana effect’te setJoining ile yanlış “bağlanıyor” resetini önlemek için */
  const trustSessionUiKeyRef = useRef<string>('');

  const userIdRef = useRef(userId);
  const peerUserIdRef = useRef(peerUserId);
  userIdRef.current = userId;
  peerUserIdRef.current = peerUserId;

  useEffect(() => {
    if (visible) {
      deadlineMsRef.current = parseDeadlineMs(sessionHardDeadlineAt);
    }
  }, [visible, sessionHardDeadlineAt]);

  const finalizeEnd = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    try {
      await postTrustEnd(trustId);
    } catch {
      /* noop */
    }
    try {
      await trustVideoLeave();
    } catch {
      /* noop */
    }
    agoraVoiceService.resetCallbacks();
    onClose();
  }, [trustId, onClose]);

  const finalizeEndRef = useRef(finalizeEnd);
  finalizeEndRef.current = finalizeEnd;

  /** Agora join: yalnızca [channelName, agoraToken, trustId]; teardown yalnızca bu effect cleanup’ta */
  useEffect(() => {
    const ch = String(channelName ?? '').trim();
    const tok = String(agoraToken ?? '').trim();
    if (!ch || !tok) return;
    if (joinStartedRef.current) return;
    joinStartedRef.current = true;
    setJoining(true);

    const run = async () => {
      if (Platform.OS === 'android') {
        const cam = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (cam !== PermissionsAndroid.RESULTS.GRANTED || mic !== PermissionsAndroid.RESULTS.GRANTED) {
          joinStartedRef.current = false;
          setError('Kamera ve mikrofon izni gerekli.');
          setJoining(false);
          return;
        }
      }
      const curUserId = String(userIdRef.current ?? '');
      const myUid = agoraUidFromUserId(curUserId);
      agoraVoiceService.resetJoinGate();
      agoraVoiceService.setCallbacks({
        onJoinChannelSuccess: (_c, elapsed) => {
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_JOIN_SUCCESS',
              current_user_id: curUserId,
              channel_name: ch,
              uid_used_for_join: myUid,
              elapsed_ms: elapsed,
            }),
          );
        },
        onUserJoined: (_c, uid) => {
          if (uid && uid !== myUid) {
            console.log(
              '[TRUST]',
              JSON.stringify({
                evt: 'TRUST_REMOTE_USER_JOINED',
                current_user_id: curUserId,
                remote_uid: uid,
              }),
            );
            setRemoteUid(uid);
            console.log(
              '[TRUST]',
              JSON.stringify({
                evt: 'TRUST_REMOTE_VIDEO_ATTACHED',
                current_user_id: curUserId,
                remote_uid: uid,
              }),
            );
          }
        },
        onUserOffline: () => {
          void finalizeEndRef.current();
        },
        onError: (err, msg) => {
          console.log(
            '[TRUST]',
            JSON.stringify({
              evt: 'TRUST_JOIN_ERROR',
              current_user_id: curUserId,
              err,
              msg,
            }),
          );
          setError('Bağlantı hatası');
        },
      });
      try {
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_JOIN_START',
            current_user_id: curUserId,
            channel_name: ch,
            uid_used_for_join: myUid,
            peer_user_id: String(peerUserIdRef.current ?? ''),
            token_prefix: tok.length ? `${tok.slice(0, 8)}…` : '',
          }),
        );
        await trustVideoJoin(ch, tok, myUid);
        setJoining(false);
      } catch (e) {
        console.warn('Trust video join', e);
        console.log(
          '[TRUST]',
          JSON.stringify({
            evt: 'TRUST_JOIN_ERROR',
            current_user_id: curUserId,
            channel_name: ch,
            uid_used_for_join: myUid,
            message: e instanceof Error ? e.message : String(e),
          }),
        );
        joinStartedRef.current = false;
        setError('Görüntülü bağlantı kurulamadı.');
        setJoining(false);
      }
    };

    void run();

    return () => {
      joinStartedRef.current = false;
      void trustVideoLeave();
      agoraVoiceService.resetCallbacks();
    };
  }, [channelName, agoraToken, trustId]);

  useEffect(() => {
    if (!visible) {
      trustSessionUiKeyRef.current = '';
      endedRef.current = false;
      setError(null);
      setRemoteUid(0);
      return;
    }
    if (Platform.OS === 'web') {
      setError('Güven görüşmesi bu platformda kullanılamıyor.');
      setJoining(false);
      return;
    }

    const chWait = String(channelName || '').trim();
    const tokWait = String(agoraToken || '').trim();
    if (!chWait || !tokWait) {
      return;
    }

    const sessionUiKey = `${trustId}|${chWait}|${tokWait}`;
    const isNewSessionUi = trustSessionUiKeyRef.current !== sessionUiKey;
    if (isNewSessionUi) {
      trustSessionUiKeyRef.current = sessionUiKey;
    }

    let tick: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      if (isNewSessionUi) {
        endedRef.current = false;
        setError(null);
        setRemoteUid(0);
      }

      const tok = String(agoraToken || '').trim();
      const ch = String(channelName || '').trim();
      if (!tok || !ch) {
        setError('Güven görüşmesi bileti alınamadı.');
        setJoining(false);
        return;
      }

      const deadlineMs = parseDeadlineMs(sessionHardDeadlineAt);
      if (deadlineMs === null) {
        setError('Oturum bitiş zamanı sunucudan okunamadı.');
        setJoining(false);
        return;
      }
      deadlineMsRef.current = deadlineMs;

      const tickFn = () => {
        const d = deadlineMsRef.current;
        if (d == null) return;
        const left = Math.max(0, Math.ceil((d - Date.now()) / 1000));
        setRemainingSec(left);
        if (left <= 0) {
          void finalizeEndRef.current();
        }
      };
      tickFn();
      tick = setInterval(tickFn, 1000);
    };

    void run();

    return () => {
      if (tick) clearInterval(tick);
    };
  }, [visible, channelName, agoraToken, sessionHardDeadlineAt, trustId]);

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <Modal visible transparent animationType="fade">
        <View style={[styles.webBlock, { paddingTop: insets.top }]}>
          <Text style={styles.webBlockText}>
            {error || 'Güven görüşmesi yalnızca uygulamada kullanılabilir.'}
          </Text>
          <Pressable onPress={onClose} style={styles.endBtn}>
            <Text style={styles.endBtnText}>Kapat</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  const remoteCanvasUid = remoteUid > 0 ? remoteUid : agoraUidFromUserId(peerUserId);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient colors={[P.bgDeep, P.bgMid, P.bgElev]} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerLabel}>Güven alınıyor</Text>
            <Text style={styles.peerName} numberOfLines={1}>
              {peerDisplayName}
            </Text>
          </View>
          <View style={styles.timerPill}>
            <Ionicons name="time-outline" size={18} color={P.accent} />
            <Text style={styles.timerText}>{formatMmSs(remainingSec)}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void finalizeEnd()} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Kapat</Text>
            </Pressable>
          </View>
        ) : joining ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={P.accent} />
            <Text style={styles.joiningText}>Güven kanalına bağlanılıyor…</Text>
          </View>
        ) : (
          <View style={styles.videoStack}>
            <View style={styles.remoteWrap}>
              <RtcSurfaceView style={styles.remoteView} canvas={{ uid: remoteCanvasUid }} />
              <LinearGradient
                colors={['transparent', 'rgba(8,17,31,0.88)']}
                style={styles.remoteFade}
              />
            </View>
            <View style={styles.localPiP}>
              <RtcSurfaceView style={styles.localView} canvas={{ uid: 0 }} />
            </View>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <Pressable
            onPress={() => void finalizeEnd()}
            style={({ pressed }) => [styles.hangup, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="call" size={26} color={P.text} style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.hangupText}>Görüşmeyi bitir</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.bgDeep,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: P.hudBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,58,95,0.5)',
  },
  headerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  headerLabel: {
    color: P.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  peerName: {
    color: P.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,17,31,0.72)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: P.cyanEdge,
    shadowColor: P.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  timerText: {
    color: P.text,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  videoStack: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  remoteWrap: {
    flex: 1,
    backgroundColor: P.blackVideo,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.border,
  },
  remoteView: {
    flex: 1,
  },
  remoteFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  localPiP: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 112,
    height: 158,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: P.border,
    backgroundColor: P.bgElev,
    shadowColor: P.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  localView: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  joiningText: {
    marginTop: 14,
    color: P.muted,
    fontSize: 15,
    letterSpacing: 0.15,
  },
  errorText: {
    color: 'rgba(243,248,255,0.88)',
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
  },
  hangup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: P.dangerGlass,
    borderWidth: 1,
    borderColor: P.dangerGlassBorder,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: 'rgba(220,38,38,0.35)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  hangupText: {
    color: P.text,
    fontSize: 16,
    fontWeight: '700',
  },
  endBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(8,17,31,0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.border,
  },
  endBtnText: {
    color: P.text,
    fontWeight: '600',
  },
  webBlock: {
    flex: 1,
    backgroundColor: 'rgba(8,17,31,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webBlockText: {
    color: P.muted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
});

export default TrustVideoSessionScreen;
