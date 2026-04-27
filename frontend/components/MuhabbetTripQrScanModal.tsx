import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

type MuhabbetTripQrScanModalProps = {
  visible: boolean;
  mode: 'boarding' | 'finish';
  onClose: () => void;
  onConfirmToken: (token: string) => void | Promise<void>;
};

function extractMuhabbetQrToken(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    const scope = url.searchParams.get('scope');
    const token = url.searchParams.get('token');
    if (scope === 'muhabbet_trip' && token) return token.trim().toUpperCase();
  } catch {
    /* Manual codes and plain QR values are allowed. */
  }
  return value.trim().toUpperCase();
}

export default function MuhabbetTripQrScanModal({
  visible,
  mode,
  onClose,
  onConfirmToken,
}: MuhabbetTripQrScanModalProps) {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setProcessing(false);
      setManualToken('');
      return;
    }
    setScanned(false);
    setProcessing(false);
    if (!hasPermission?.granted) {
      void requestPermission();
    }
  }, [hasPermission?.granted, requestPermission, visible]);

  const submitToken = useCallback(async (raw: string) => {
    const token = extractMuhabbetQrToken(raw);
    if (!token) {
      Alert.alert(mode === 'boarding' ? 'Biniş QR' : 'Yolculuğu Bitir', 'QR kodu veya manuel kod okunamadı.');
      return;
    }
    setProcessing(true);
    try {
      Vibration.vibrate(80);
      await onConfirmToken(token);
      onClose();
    } finally {
      setProcessing(false);
      setScanned(false);
    }
  }, [mode, onClose, onConfirmToken]);

  const onBarcodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (scanned || processing) return;
      setScanned(true);
      void submitToken(data);
    },
    [processing, scanned, submitToken],
  );

  const title = mode === 'boarding' ? 'Biniş QR Oku' : 'Bitiriş QR Oku';
  const hint =
    mode === 'boarding'
      ? 'Sürücünün gösterdiği Muhabbet biniş QR kodunu okutun.'
      : 'Sürücünün gösterdiği Muhabbet bitiriş QR kodunu okutun.';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="scan" size={20} color="#FFFFFF" />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeIcon}>
              <Ionicons name="close" size={22} color="#CBD5E1" />
            </Pressable>
          </View>
          <Text style={styles.hint}>{hint}</Text>

          {!hasPermission?.granted ? (
            <View style={styles.permissionBox}>
              <Ionicons name="camera-outline" size={34} color="#94A3B8" />
              <Text style={styles.permissionText}>Kamera izni gerekli.</Text>
              <Pressable style={styles.permissionButton} onPress={() => void requestPermission()}>
                <Text style={styles.permissionButtonText}>İzin ver</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned || processing ? undefined : onBarcodeScanned}
              />
              <View style={styles.frame} pointerEvents="none" />
              {processing ? (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="large" />
                  <Text style={styles.processingText}>Doğrulanıyor...</Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.manualBox}>
            <Text style={styles.manualLabel}>Manuel kod</Text>
            <TextInput
              style={styles.input}
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="characters"
              placeholder="Kodu gir"
              placeholderTextColor="#64748B"
            />
            <Pressable
              style={({ pressed }) => [styles.confirmButton, (pressed || processing) && styles.pressed]}
              disabled={processing}
              onPress={() => void submitToken(manualToken)}
            >
              {processing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
              <Text style={styles.confirmText}>{mode === 'boarding' ? 'Yolculuğu Başlat' : 'Yolculuğu Bitir'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(15,23,42,0.88)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  closeIcon: { padding: 8 },
  hint: { color: '#CBD5E1', fontSize: 13, lineHeight: 18, marginTop: 10, fontWeight: '700' },
  permissionBox: { marginTop: 16, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permissionText: { color: '#CBD5E1', fontWeight: '800' },
  permissionButton: { backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  permissionButtonText: { color: '#FFFFFF', fontWeight: '900' },
  cameraBox: {
    marginTop: 16,
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(249,115,22,0.9)',
    borderRadius: 18,
    margin: 42,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  processingText: { color: '#FFFFFF', marginTop: 10, fontWeight: '900' },
  manualBox: { marginTop: 14 },
  manualLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '900', marginBottom: 7, letterSpacing: 0.5 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  confirmButton: {
    marginTop: 10,
    borderRadius: 15,
    backgroundColor: '#F97316',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
