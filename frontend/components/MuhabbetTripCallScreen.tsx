import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { Ionicons } from '@expo/vector-icons';
import { getPersistedAccessToken } from '../lib/sessionToken';
import { muhabbetAgoraVoiceService } from '../services/muhabbetAgoraVoiceService';

type MuhabbetTripCallScreenProps = {
  visible: boolean;
  mode: 'outgoing' | 'incoming' | 'active';
  apiBaseUrl: string;
  sessionId: string;
  peerName: string;
  peerRoleLabel: string;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
};

function stopCallAudio() {
  Vibration.cancel();
  try {
    InCallManager.stopRingtone();
  } catch {
    /* noop */
  }
  try {
    InCallManager.stopRingback();
  } catch {
    /* noop */
  }
  try {
    InCallManager.stop();
  } catch {
    /* noop */
  }
}

async function leaveMuhabbetAgora() {
  try {
    await muhabbetAgoraVoiceService.leaveChannelAndDestroy();
  } finally {
    muhabbetAgoraVoiceService.resetCallbacks();
  }
}

export default function MuhabbetTripCallScreen({
  visible,
  mode,
  apiBaseUrl,
  sessionId,
  peerName,
  peerRoleLabel,
  onAccept,
  onDecline,
  onCancel,
}: MuhabbetTripCallScreenProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const joinKeyRef = useRef('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);

  useEffect(() => {
    if (!visible) {
      stopCallAudio();
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
      ]),
    );
    anim.start();
    try {
      InCallManager.start({ media: 'audio' });
      if (mode === 'outgoing') {
        try {
          InCallManager.setForceSpeakerphoneOn(false);
        } catch {
          /* noop */
        }
        InCallManager.startRingback('_DEFAULT_');
      } else if (mode === 'incoming') {
        InCallManager.startRingtone('_DEFAULT_', [0, 650, 300, 650], 'playback', 60);
        Vibration.vibrate([0, 650, 300, 650], true);
      } else {
        InCallManager.setForceSpeakerphoneOn(speakerOn);
      }
    } catch {
      /* noop */
    }
    return () => {
      anim.stop();
      stopCallAudio();
    };
  }, [mode, pulse, speakerOn, visible]);

  const leaveCall = useCallback(async () => {
    joinKeyRef.current = '';
    setJoining(false);
    setJoined(false);
    await leaveMuhabbetAgora();
  }, []);

  const joinCall = useCallback(async () => {
    const key = `${sessionId}|active`;
    if (!visible || mode !== 'active' || !sessionId || joining || joined || joinKeyRef.current === key) return;
    joinKeyRef.current = key;
    setJoining(true);
    try {
      const token = await getPersistedAccessToken();
      if (!token) {
        joinKeyRef.current = '';
        setJoining(false);
        Alert.alert('Arama', 'Sesli görüşme için tekrar giriş yapın.');
        return;
      }
      const base = apiBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(sessionId)}/agora-token`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        channel_name?: string;
        agora_token?: string;
        agora_uid?: number;
        detail?: string;
      };
      const channelName = String(data.channel_name || `muhabbet_trip_${sessionId}`).trim();
      const agoraToken = String(data.agora_token || '').trim();
      const agoraUid = Number(data.agora_uid || 0);
      if (!res.ok || !data.success || !channelName || !agoraToken || !Number.isFinite(agoraUid)) {
        joinKeyRef.current = '';
        setJoining(false);
        Alert.alert('Arama', data.detail || 'Muhabbet arama bileti alınamadı.');
        return;
      }
      await muhabbetAgoraVoiceService.initialize();
      muhabbetAgoraVoiceService.resetCallbacks();
      muhabbetAgoraVoiceService.setCallbacks({
        onJoinChannelSuccess: () => {
          setJoined(true);
          setJoining(false);
        },
        onError: (_err, msg) => {
          joinKeyRef.current = '';
          setJoined(false);
          setJoining(false);
          Alert.alert('Arama', msg || 'Muhabbet Agora bağlantı hatası.');
        },
      });
      muhabbetAgoraVoiceService.resetJoinGate();
      await muhabbetAgoraVoiceService.joinChannel(channelName, agoraToken, agoraUid);
      muhabbetAgoraVoiceService.setSpeakerOn(speakerOn);
      muhabbetAgoraVoiceService.setMuted(muted);
    } catch {
      joinKeyRef.current = '';
      setJoined(false);
      setJoining(false);
      Alert.alert('Arama', 'Muhabbet aramasına bağlanılamadı.');
    }
  }, [apiBaseUrl, joined, joining, mode, muted, sessionId, speakerOn, visible]);

  useEffect(() => {
    if (visible && mode === 'active') {
      void joinCall();
      return;
    }
    if (!visible) {
      void leaveCall();
    }
  }, [joinCall, leaveCall, mode, visible]);

  useEffect(() => {
    muhabbetAgoraVoiceService.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    try {
      InCallManager.setForceSpeakerphoneOn(speakerOn);
    } catch {
      /* noop */
    }
    muhabbetAgoraVoiceService.setSpeakerOn(speakerOn);
  }, [speakerOn]);

  const accept = useCallback(() => {
    stopCallAudio();
    onAccept();
  }, [onAccept]);

  const decline = useCallback(() => {
    stopCallAudio();
    void leaveCall();
    onDecline();
  }, [leaveCall, onDecline]);

  const cancel = useCallback(() => {
    stopCallAudio();
    void leaveCall();
    onCancel();
  }, [leaveCall, onCancel]);

  if (!visible) return null;

  const isIncoming = mode === 'incoming';
  const isActive = mode === 'active';

  return (
    <Modal visible animationType="slide" statusBarTranslucent presentationStyle="fullScreen">
      <View style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.scopeLabel}>Leylek Muhabbet</Text>
          <Text style={styles.secureLabel}>Muhabbet-only arama</Text>
        </View>

        <View style={styles.center}>
          <Animated.View style={[styles.avatar, { transform: [{ scale: pulse }] }]}>
            <Ionicons name={isIncoming || isActive ? 'call' : 'radio'} size={48} color="#FFFFFF" />
          </Animated.View>
          <Text style={styles.title}>{isActive ? 'Görüşme aktif' : isIncoming ? 'Gelen arama' : 'Aranıyor...'}</Text>
          <Text style={styles.peerName} numberOfLines={1}>
            {peerName || peerRoleLabel}
          </Text>
          <Text style={styles.peerRole}>{isActive ? (joined ? 'Bağlandı' : joining ? 'Bağlanıyor...' : peerRoleLabel) : peerRoleLabel}</Text>
        </View>

        <View style={styles.bottom}>
          {isActive ? (
            <>
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [styles.smallRoundButton, muted && styles.toggleActiveButton, pressed && styles.pressed]}
                  onPress={() => setMuted((v) => !v)}
                >
                  <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" />
                  <Text style={styles.buttonLabel}>{muted ? 'Sessiz' : 'Mikrofon'}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.smallRoundButton, speakerOn && styles.toggleActiveButton, pressed && styles.pressed]}
                  onPress={() => setSpeakerOn((v) => !v)}
                >
                  <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={24} color="#FFFFFF" />
                  <Text style={styles.buttonLabel}>Hoparlör</Text>
                </Pressable>
              </View>
              <Pressable style={({ pressed }) => [styles.roundButton, styles.declineButton, styles.endButton, pressed && styles.pressed]} onPress={cancel}>
                <Ionicons name="call" size={32} color="#FFFFFF" style={styles.hangupIcon} />
                <Text style={styles.buttonLabel}>Bitir</Text>
              </Pressable>
            </>
          ) : isIncoming ? (
            <View style={styles.actionRow}>
              <Pressable style={({ pressed }) => [styles.roundButton, styles.declineButton, pressed && styles.pressed]} onPress={decline}>
                <Ionicons name="call" size={30} color="#FFFFFF" style={styles.hangupIcon} />
                <Text style={styles.buttonLabel}>Reddet</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.roundButton, styles.acceptButton, pressed && styles.pressed]} onPress={accept}>
                <Ionicons name="call" size={30} color="#FFFFFF" />
                <Text style={styles.buttonLabel}>Kabul et</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={({ pressed }) => [styles.roundButton, styles.declineButton, pressed && styles.pressed]} onPress={cancel}>
              <Ionicons name="call" size={32} color="#FFFFFF" style={styles.hangupIcon} />
              <Text style={styles.buttonLabel}>Iptal et</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111827',
    paddingTop: Platform.OS === 'android' ? 48 : 58,
    paddingBottom: 42,
  },
  top: {
    paddingHorizontal: 22,
  },
  scopeLabel: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  secureLabel: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  avatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14B8A6',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 18,
  },
  title: {
    marginTop: 28,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  peerName: {
    marginTop: 12,
    color: '#E5E7EB',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: '86%',
  },
  peerRole: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '800',
  },
  bottom: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 42,
  },
  roundButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallRoundButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  toggleActiveButton: {
    backgroundColor: '#0F766E',
  },
  endButton: {
    marginTop: 38,
  },
  acceptButton: {
    backgroundColor: '#22C55E',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
  buttonLabel: {
    position: 'absolute',
    bottom: -28,
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '900',
  },
});
