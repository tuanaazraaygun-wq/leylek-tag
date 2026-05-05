import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  /** true: sunucu + state teyidi tamam → modal kapanır. false: kamera açık kalır */
  onVerified: (payload: {
    tag_id?: string;
    started_at?: string;
    boarding_confirmed_at?: string;
    status?: string;
  }) => boolean | Promise<boolean>;
};

export type BoardingScanModalProps = Props;
const BOARDING_SCAN_DEDUPE_WINDOW_MS = 1500;
const BOARDING_SCAN_RESCAN_COOLDOWN_MS = 900;

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
  const lastScanRef = useRef<{ data: string; ts: number }>({ data: '', ts: 0 });
  const cooldownUntilRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      cooldownUntilRef.current = 0;
      lastScanRef.current = { data: '', ts: 0 };
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
          const rawTag = (json as { tag_id?: string }).tag_id;
          const propTag = typeof tagId === 'string' ? tagId.trim() : '';
          const tag_id =
            (typeof rawTag === 'string' && rawTag.trim()) || propTag || undefined;
          console.log('BOARDING_SCAN_SUCCESS', { tag_id, used_prop_fallback: !rawTag && !!propTag });
          const closeModal = await Promise.resolve(
            onVerified({
              tag_id,
              started_at: (json as { started_at?: string }).started_at,
              boarding_confirmed_at: (json as { boarding_confirmed_at?: string }).boarding_confirmed_at,
              status: (json as { status?: string }).status,
            }),
          );
          if (closeModal === true) {
            onClose();
          }
        } else {
          const detail = (json.detail || '').toLowerCase();
          const expiredOrInvalid =
            detail.includes('süresi dolmuş') ||
            detail.includes('geçersiz') ||
            detail.includes('kullanılmış');
          if (expiredOrInvalid) {
            cooldownUntilRef.current = Date.now() + BOARDING_SCAN_RESCAN_COOLDOWN_MS;
            Alert.alert('Biniş doğrulanamadı', 'Sürücüden yeni biniş kodu isteyin.');
          } else {
            Alert.alert('Biniş doğrulanamadı', json.detail || 'Tekrar deneyin');
          }
        }
      } catch {
        Alert.alert('Hata', 'Ağ hatası — internet bağlantınızı kontrol edin');
      } finally {
        setProcessing(false);
        const now = Date.now();
        const delay = Math.max(0, cooldownUntilRef.current - now);
        if (delay > 0) {
          setTimeout(() => setScanned(false), delay);
        } else {
          setScanned(false);
        }
      }
    },
    [latitude, longitude, onVerified, onClose, tagId],
  );

  const onBarcodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned || processing) return;
      if (Date.now() < cooldownUntilRef.current) return;
      const d = (data || '').trim();
      if (!d.startsWith('leylektag://board')) {
        return;
      }
      const now = Date.now();
      const prev = lastScanRef.current;
      if (prev.data === d && now - prev.ts < BOARDING_SCAN_DEDUPE_WINDOW_MS) {
        return;
      }
      lastScanRef.current = { data: d, ts: now };
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
