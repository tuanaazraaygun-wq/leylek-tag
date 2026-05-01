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

const TOKEN_PARAM_KEYS = ['token', 'qr', 'code', 'boarding_token'] as const;

/**
 * QR içinde URL veya düz kod olabilir. Token çıkarılırken büyük/küçük harf korunur (sunucu digest öncesi normalize eder).
 */
function extractMuhabbetTripQrToken(raw: string): { token: string | null; parsedUrl: boolean } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { token: null, parsedUrl: false };
  }

  const pickFromSearchParams = (searchParams: URLSearchParams): string | null => {
    for (const key of TOKEN_PARAM_KEYS) {
      const v = searchParams.get(key);
      const t = v != null ? String(v).trim() : '';
      if (t) return t;
    }
    return null;
  };

  try {
    const url = new URL(trimmed);
    const scope = url.searchParams.get('scope');
    const picked = pickFromSearchParams(url.searchParams);
    if (picked) {
      return { token: picked, parsedUrl: true };
    }
    if (scope === 'muhabbet_trip') {
      return { token: null, parsedUrl: true };
    }
    return { token: null, parsedUrl: true };
  } catch {
    return { token: trimmed, parsedUrl: false };
  }
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
  const [manualVisible, setManualVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setProcessing(false);
      setManualToken('');
      setManualVisible(false);
      setSuccessVisible(false);
      return;
    }
    setScanned(false);
    setProcessing(false);
    setSuccessVisible(false);
    if (!hasPermission?.granted) {
      void requestPermission();
    }
  }, [hasPermission?.granted, requestPermission, visible]);

  const submitToken = useCallback(async (raw: string) => {
    const { token, parsedUrl } = extractMuhabbetTripQrToken(raw);
    const title = mode === 'boarding' ? 'Biniş QR' : 'Yolculuğu Bitir';
    if (!token) {
      Alert.alert(
        title,
        parsedUrl
          ? 'QR bağlantısında geçerli bir kod bulunamadı. Kamerayı yeniden hizalayın veya kodu manuel girin.'
          : 'QR kodu okunamadı veya boş. Tekrar deneyin veya kodu manuel girin.'
      );
      return;
    }
    setProcessing(true);
    try {
      Vibration.vibrate([0, 70, 55, 90]);
      setSuccessVisible(true);
      await onConfirmToken(token);
      setTimeout(onClose, 180);
    } finally {
      setTimeout(() => {
        setProcessing(false);
        setScanned(false);
        setSuccessVisible(false);
      }, 220);
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

  const title = 'QR kodu okut';
  const hint =
    mode === 'boarding'
      ? 'Sürücünün gösterdiği Muhabbet biniş QR kodunu okutun.'
      : 'Sürücünün gösterdiği Muhabbet bitiriş QR kodunu okutun.';

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="scan" size={21} color="#FFFFFF" />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeIcon}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={styles.hint}>{hint}</Text>

        {!hasPermission?.granted ? (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={42} color="#94A3B8" />
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
            <View style={styles.cameraShade} pointerEvents="none" />
            <View style={styles.frame} pointerEvents="none">
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            {successVisible ? (
              <View style={styles.successOverlay}>
                <View style={styles.successBubble}>
                  <Ionicons name="checkmark-circle" size={44} color="#22C55E" />
                  <Text style={styles.successText}>QR okundu</Text>
                </View>
              </View>
            ) : null}
            {processing && !successVisible ? (
              <View style={styles.processingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="large" />
                <Text style={styles.processingText}>Doğrulanıyor...</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.bottomPanel}>
          <Pressable style={styles.manualToggle} onPress={() => setManualVisible((v) => !v)}>
            <Ionicons name="keypad-outline" size={15} color="#CBD5E1" />
            <Text style={styles.manualToggleText}>{manualVisible ? 'Manuel kodu gizle' : 'Manuel kod gir'}</Text>
          </Pressable>
          {manualVisible ? (
          <View style={styles.manualBox}>
            <TextInput
              style={styles.input}
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="none"
              autoCorrect={false}
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
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  header: {
    position: 'absolute',
    top: 44,
    left: 18,
    right: 18,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  closeIcon: { padding: 8, borderRadius: 18, backgroundColor: 'rgba(15,23,42,0.62)' },
  hint: {
    position: 'absolute',
    top: 90,
    left: 24,
    right: 24,
    zIndex: 12,
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '800',
  },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  permissionText: { color: '#CBD5E1', fontWeight: '800' },
  permissionButton: { backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  permissionButtonText: { color: '#FFFFFF', fontWeight: '900' },
  cameraBox: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  cameraShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.18)',
  },
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 258,
    height: 258,
    marginLeft: -129,
    marginTop: -129,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: '#F97316',
  },
  cornerTopLeft: { top: -2, left: -2, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 },
  cornerTopRight: { top: -2, right: -2, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 },
  cornerBottomLeft: { bottom: -2, left: -2, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 },
  cornerBottomRight: { bottom: -2, right: -2, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.32)',
  },
  successBubble: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 18,
  },
  successText: { marginTop: 6, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  processingText: { color: '#FFFFFF', marginTop: 10, fontWeight: '900' },
  bottomPanel: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 28,
    zIndex: 12,
    alignItems: 'center',
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.22)',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  manualToggleText: { color: '#CBD5E1', fontSize: 12, fontWeight: '900' },
  manualBox: { marginTop: 10, width: '100%' },
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
