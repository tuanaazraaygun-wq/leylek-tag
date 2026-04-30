import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  /** REST ile token beklenirken spinner */
  loading?: boolean;
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
  loading = false,
}: MuhabbetTripQrCodeModalProps) {
  const pulse = useRef(new Animated.Value(0.72)).current;
  useEffect(() => {
    if (!visible) return undefined;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.72, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, visible]);

  const title = mode === 'boarding' ? 'Biniş QR' : 'Yolculuğu Bitir';
  const hint =
    mode === 'boarding'
      ? 'Yolcu bu QR kodu okuttuğunda Muhabbet yolculuğu iki cihazda başlar.'
      : 'Yolcu bu QR kodu okuttuğunda Muhabbet yolculuğu iki cihazda tamamlanır.';
  const expiresLabel = expiresAt ? new Date(expiresAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null;
  const tokenReady = !!token?.trim();
  const showQr = tokenReady && !loading;
  const value = showQr ? qrValue(mode, sessionId, token) : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="qr-code" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.scanTitle}>Yolcuya okut</Text>
          <Text style={styles.hint}>{hint}</Text>
          <Animated.View style={[styles.qrGlow, { opacity: pulse, transform: [{ scale: pulse }] }]} pointerEvents="none" />
          <View style={styles.qrBox}>
            {value ? (
              <QRCode value={value} size={270} backgroundColor="#FFFFFF" color="#111827" quietZone={14} />
            ) : (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#7C3AED" />
                <Text style={styles.loadingText}>QR hazırlanıyor...</Text>
              </View>
            )}
          </View>
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
    backgroundColor: '#F8FAFC',
    padding: 20,
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
  scanTitle: { marginTop: 6, color: '#F97316', fontSize: 28, fontWeight: '900', letterSpacing: 0.2 },
  hint: { marginTop: 8, color: '#475569', fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '700' },
  qrGlow: {
    position: 'absolute',
    top: 168,
    width: 292,
    height: 292,
    borderRadius: 34,
    backgroundColor: 'rgba(249, 115, 22, 0.22)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.86,
    shadowRadius: 24,
    elevation: 16,
  },
  qrBox: {
    marginTop: 22,
    borderRadius: 28,
    borderWidth: 6,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    padding: 14,
    minWidth: 306,
    minHeight: 306,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C2D12',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 18,
  },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#64748B', fontWeight: '800' },
  expires: { marginTop: 14, color: '#92400E', fontSize: 12, fontWeight: '800' },
  closeButton: {
    marginTop: 18,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#0F172A',
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
