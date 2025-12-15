import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceCallProps {
  visible: boolean;
  remoteUserName: string;
  isIncoming: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onEnd?: () => void;
}

export default function VoiceCall({
  visible,
  remoteUserName,
  isIncoming,
  onAccept,
  onReject,
  onEnd,
}: VoiceCallProps) {
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (callState === 'connected') {
      const interval = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          // 20 dakika = 1200 saniye
          if (newDuration >= 1200) {
            onEnd?.();
          }
          return newDuration;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callState, onEnd]);

  const handleAccept = () => {
    setCallState('connected');
    onAccept?.();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!visible) return null;

  if (isIncoming && callState === 'ringing') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
            style={styles.incomingContainer}
          >
            <View style={styles.callerInfo}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{remoteUserName[0]}</Text>
              </View>
              <Text style={styles.callerName}>{remoteUserName}</Text>
              <Text style={styles.callingText}>Sizi Arıyor...</Text>
            </View>

            <View style={styles.incomingActions}>
              <TouchableOpacity
                style={[styles.callButton, styles.rejectButton]}
                onPress={onReject}
              >
                <Ionicons name="close" size={36} color="#FFF" />
                <Text style={styles.buttonLabel}>Reddet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callButton, styles.acceptButton]}
                onPress={handleAccept}
              >
                <Ionicons name="call" size={36} color="#FFF" />
                <Text style={styles.buttonLabel}>Kabul Et</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#065f46', '#10b981', '#34d399']}
          style={styles.activeContainer}
        >
          <View style={styles.activeHeader}>
            <View style={styles.avatarMedium}>
              <Text style={styles.avatarText}>{remoteUserName[0]}</Text>
            </View>
            <Text style={styles.activeCallerName}>{remoteUserName}</Text>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            <Text style={styles.statusText}>
              {duration >= 1140 ? '⚠️ 1 dakika kaldı' : '✅ Aramada'}
            </Text>
          </View>

          <View style={styles.activeControls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.mutedButton]}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color="#FFF"
              />
              <Text style={styles.controlLabel}>
                {isMuted ? 'Aç' : 'Sustur'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.endButton]}
              onPress={onEnd}
            >
              <Ionicons name="call" size={32} color="#FFF" />
              <Text style={styles.controlLabel}>Bitir</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  incomingContainer: {
    flex: 1,
    justifyContent: 'space-around',
    paddingVertical: 60,
  },
  activeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callerInfo: {
    alignItems: 'center',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarMedium: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  callingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  callButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  buttonLabel: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  activeHeader: {
    alignItems: 'center',
  },
  activeCallerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  durationText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 60,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#ef4444',
  },
  endButton: {
    backgroundColor: '#dc2626',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
