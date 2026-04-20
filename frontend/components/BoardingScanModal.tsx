import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from '../lib/backendConfig';
import { waitForPersistedAccessToken } from '../lib/sessionToken';

type Props = {
  visible: boolean;
  onClose: () => void;
  tagId: string;
  latitude?: number;
  longitude?: number;
  onVerified: (payload: {
    tag_id?: string;
    started_at?: string;
    boarding_confirmed_at?: string;
    status?: string;
  }) => void;
};

export default function BoardingScanModal({
  visible,
  onClose,
  tagId,
  latitude,
  longitude,
  onVerified,
}: Props) {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      if (!hasPermission?.granted) {
        void requestPermission();
      }
    }
  }, [visible, hasPermission?.granted, requestPermission]);

  const verifyBoarding = useCallback(
    async (scannedData: string) => {
      setProcessing(true);
      try {
        const tok = await waitForPersistedAccessToken();
        if (!tok?.trim()) {
          Alert.alert('Oturum', 'Biniş doğrulamak için yeniden giriş yapın.');
          return;
        }
        const res = await fetch(`${API_BASE_URL}/qr/verify-boarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${tok.trim()}`,
          },
          body: JSON.stringify({
            scanned_data: scannedData,
            latitude: latitude ?? 0,
            longitude: longitude ?? 0,
          }),
        });
        const raw = await res.text();
        let json: { success?: boolean; detail?: string } = {};
        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          Alert.alert('Hata', 'Sunucu yanıtı okunamadı');
          return;
        }
        if (res.status === 401) {
          Alert.alert('Oturum', json.detail || 'Oturum süresi dolmuş olabilir; yeniden giriş yapın.');
          return;
        }
        if (json.success) {
          const tag_id = (json as { tag_id?: string }).tag_id;
          console.log('BOARDING_SCAN_SUCCESS', { tag_id });
          onVerified({
            tag_id,
            started_at: (json as { started_at?: string }).started_at,
            boarding_confirmed_at: (json as { boarding_confirmed_at?: string }).boarding_confirmed_at,
            status: (json as { status?: string }).status,
          });
          onClose();
        } else {
          Alert.alert('Biniş doğrulanamadı', json.detail || 'Tekrar deneyin');
        }
      } catch (e) {
        Alert.alert('Hata', 'Ağ hatası — internet bağlantınızı kontrol edin');
      } finally {
        setProcessing(false);
        setScanned(false);
      }
    },
    [latitude, longitude, onVerified, onClose],
  );

  const onBarcodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned || processing) return;
      const d = (data || '').trim();
      if (!d.startsWith('leylektag://board')) {
        return;
      }
      setScanned(true);
      await verifyBoarding(d);
    },
    [scanned, processing, verifyBoarding],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Biniş kodunu tarayın</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Yalnızca sürücünün gösterdiği biniş karekodu geçerlidir (yol sonu kodu değil).</Text>
          {!hasPermission?.granted ? (
            <View style={styles.centerBox}>
              <Text style={styles.muted}>Kamera izni gerekli</Text>
              <TouchableOpacity style={styles.permBtn} onPress={() => void requestPermission()}>
                <Text style={styles.permBtnText}>İzin ver</Text>
              </TouchableOpacity>
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
                <View style={styles.processing}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.processingText}>Doğrulanıyor…</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800', flex: 1 },
  closeBtn: { padding: 8 },
  closeText: { color: '#94a3b8', fontSize: 20, fontWeight: '600' },
  hint: { color: '#94a3b8', fontSize: 13, marginTop: 10, lineHeight: 18 },
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: '#94a3b8', marginBottom: 12 },
  permBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  cameraBox: {
    marginTop: 16,
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(14,165,233,0.85)',
    borderRadius: 14,
    margin: 36,
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: { color: '#e2e8f0', marginTop: 12, fontWeight: '600' },
});
