import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

type MuhabbetTripQrCodeModalProps = {
  visible: boolean;
  mode: 'boarding' | 'finish';
  token: string;
  sessionId: string;
  expiresAt?: string | null;
  onClose: () => void;
};

function qrValue(mode: 'boarding' | 'finish', sessionId: string, token: string): string {
  const params = new URLSearchParams({
    scope: 'muhabbet_trip',
    mode,
    session_id: sessionId,
    token,
  });
  return `leylekmuhabbet://trip-qr?${params.toString()}`;
}

export default function MuhabbetTripQrCodeModal({
  visible,
  mode,
  token,
  sessionId,
  expiresAt,
  onClose,
}: MuhabbetTripQrCodeModalProps) {
  const title = mode === 'boarding' ? 'Biniş QR' : 'Yolculuğu Bitir';
  const hint =
    mode === 'boarding'
      ? 'Yolcu bu QR kodu okuttuğunda Muhabbet yolculuğu iki cihazda başlar.'
      : 'Yolcu bu QR kodu okuttuğunda Muhabbet yolculuğu iki cihazda tamamlanır.';
  const expiresLabel = expiresAt ? new Date(expiresAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null;
  const value = token ? qrValue(mode, sessionId, token) : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="qr-code" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.qrBox}>
            {value ? (
              <QRCode value={value} size={220} backgroundColor="#FFFFFF" color="#111827" quietZone={10} />
            ) : (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#7C3AED" />
                <Text style={styles.loadingText}>QR hazırlanıyor...</Text>
              </View>
            )}
          </View>
          <Text style={styles.codeLabel}>Manuel kod</Text>
          <Text style={styles.token}>{token || 'Hazırlanıyor'}</Text>
          {expiresLabel ? <Text style={styles.expires}>Son geçerlilik: {expiresLabel}</Text> : null}
          <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.66)',
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 18,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { color: '#0F172A', fontSize: 21, fontWeight: '900' },
  hint: { marginTop: 8, color: '#475569', fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '700' },
  qrBox: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    minWidth: 250,
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#64748B', fontWeight: '800' },
  codeLabel: { marginTop: 14, color: '#64748B', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  token: { marginTop: 4, color: '#5B21B6', fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  expires: { marginTop: 8, color: '#92400E', fontSize: 12, fontWeight: '800' },
  closeButton: {
    marginTop: 16,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    alignItems: 'center',
  },
  closeText: { color: '#475569', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
