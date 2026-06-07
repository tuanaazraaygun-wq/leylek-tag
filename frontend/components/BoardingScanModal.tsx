import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from '../lib/backendConfig';
import { appAlert } from '../contexts/AppAlertContext';
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

/** Aynı karede ML Kit’in çift decode etmesi — ms; retry’i engellememek için kısa tutulur */
const BOARDING_SCAN_BURST_DEDUPE_MS = 120;
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
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const lastScannedValueRef = useRef<{ data: string; ts: number }>({ data: '', ts: 0 });
  const cooldownUntilRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const verifiedClosingRef = useRef(false);
  const verifyInFlightRef = useRef(false);
  const scannedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scannedResetTimerRef.current != null) {
        clearTimeout(scannedResetTimerRef.current);
        scannedResetTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      closingRef.current = true;
      if (mountedRef.current) {
        setCameraReady(false);
      }
      if (!verifyInFlightRef.current) {
        verifiedClosingRef.current = false;
      }
      return;
    }
    setCameraSessionKey((k) => k + 1);
    setCameraReady(false);
    setScanned(false);
    setProcessing(false);
    closingRef.current = false;
    verifiedClosingRef.current = false;
    verifyInFlightRef.current = false;
    cooldownUntilRef.current = 0;
    lastScannedValueRef.current = { data: '', ts: 0 };
    if (!hasPermission?.granted) {
      void requestPermission();
    }
  }, [visible, hasPermission?.granted, requestPermission]);

  const canMutateScanState = useCallback(
    () =>
      mountedRef.current &&
      visibleRef.current &&
      !closingRef.current &&
      !verifiedClosingRef.current,
    [],
  );

  const handleClose = useCallback(() => {
    closingRef.current = true;
    verifiedClosingRef.current = false;
    verifyInFlightRef.current = false;
    setCameraReady(false);
    if (mountedRef.current) {
      setScanned(false);
      setProcessing(false);
    }
    lastScannedValueRef.current = { data: '', ts: 0 };
    cooldownUntilRef.current = 0;
    onClose();
  }, [onClose]);

  const verifyBoarding = useCallback(
    async (scannedData: string) => {
      if (verifyInFlightRef.current || closingRef.current || verifiedClosingRef.current) {
        return;
      }
      verifyInFlightRef.current = true;
      if (canMutateScanState()) {
        setProcessing(true);
      }
      try {
        const tok = await waitForPersistedAccessToken();
        if (!tok?.trim()) {
          if (!closingRef.current) {
            appAlert('Oturum', 'Biniş doğrulamak için yeniden giriş yapın.');
          }
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
          if (!closingRef.current) {
            appAlert('Hata', 'Sunucu yanıtı okunamadı');
          }
          return;
        }
        if (res.status === 401) {
          if (!closingRef.current) {
            appAlert('Oturum', json.detail || 'Oturum süresi dolmuş olabilir; yeniden giriş yapın.');
          }
          return;
        }
        if (json.success) {
          const rawTag = (json as { tag_id?: string }).tag_id;
          const propTag = typeof tagId === 'string' ? tagId.trim() : '';
          const tag_id =
            (typeof rawTag === 'string' && rawTag.trim()) || propTag || undefined;
          console.log('BOARDING_SCAN_SUCCESS', { tag_id, used_prop_fallback: !rawTag && !!propTag });
          verifiedClosingRef.current = true;
          closingRef.current = true;
          if (canMutateScanState()) {
            setCameraReady(false);
          }
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
          } else {
            verifiedClosingRef.current = false;
            closingRef.current = false;
          }
        } else {
          if (closingRef.current) {
            return;
          }
          const detail = (json.detail || '').toLowerCase();
          const expiredOrInvalid =
            detail.includes('süresi dolmuş') ||
            detail.includes('geçersiz') ||
            detail.includes('kullanılmış');
          if (expiredOrInvalid) {
            cooldownUntilRef.current = Date.now() + BOARDING_SCAN_RESCAN_COOLDOWN_MS;
            appAlert('Biniş doğrulanamadı', 'Sürücüden yeni biniş kodu isteyin.');
          } else {
            appAlert('Biniş doğrulanamadı', json.detail || 'Tekrar deneyin');
          }
        }
      } catch {
        if (!closingRef.current) {
          appAlert('Hata', 'Ağ hatası — internet bağlantınızı kontrol edin');
        }
      } finally {
        verifyInFlightRef.current = false;
        if (!canMutateScanState()) {
          return;
        }
        setProcessing(false);
        lastScannedValueRef.current = { data: '', ts: 0 };
        const now = Date.now();
        const delay = Math.max(0, cooldownUntilRef.current - now);
        if (delay > 0) {
          if (scannedResetTimerRef.current != null) {
            clearTimeout(scannedResetTimerRef.current);
          }
          scannedResetTimerRef.current = setTimeout(() => {
            scannedResetTimerRef.current = null;
            if (canMutateScanState()) {
              setScanned(false);
            }
          }, delay);
        } else {
          setScanned(false);
        }
      }
    },
    [latitude, longitude, onVerified, onClose, tagId, canMutateScanState],
  );

  const onBarcodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (
        !visibleRef.current ||
        !cameraReady ||
        scanned ||
        processing ||
        verifyInFlightRef.current ||
        closingRef.current ||
        verifiedClosingRef.current
      ) {
        return;
      }
      if (Date.now() < cooldownUntilRef.current) return;
      const d = (data || '').trim();
      if (!d.startsWith('leylektag://board')) {
        return;
      }
      const now = Date.now();
      const prev = lastScannedValueRef.current;
      if (prev.data === d && now - prev.ts < BOARDING_SCAN_BURST_DEDUPE_MS) {
        return;
      }
      lastScannedValueRef.current = { data: d, ts: now };
      setScanned(true);
      await verifyBoarding(d);
    },
    [cameraReady, scanned, processing, verifyBoarding],
  );

  const scannerActive = cameraReady && !scanned && !processing;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Biniş kodunu tarayın</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
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
                key={`boarding-cam-${cameraSessionKey}`}
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onCameraReady={() => {
                  if (
                    !mountedRef.current ||
                    !visibleRef.current ||
                    closingRef.current ||
                    verifiedClosingRef.current
                  ) {
                    return;
                  }
                  setCameraReady(true);
                  if (__DEV__) {
                    console.log('[BoardingScanModal] onCameraReady');
                  }
                }}
                onBarcodeScanned={scannerActive ? onBarcodeScanned : undefined}
              />
              <View style={styles.frame} pointerEvents="none" />
              {!cameraReady && !processing ? (
                <View style={styles.processing}>
                  <ActivityIndicator size="large" color="#22D3EE" />
                  <Text style={styles.processingText}>Kamera hazırlanıyor…</Text>
                </View>
              ) : null}
              {processing ? (
                <View style={styles.processing}>
                  <ActivityIndicator size="large" color="#22D3EE" />
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
    backgroundColor: 'rgba(8, 17, 31, 0.88)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'rgba(16, 26, 43, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderBottomWidth: 0,
    borderTopColor: 'rgba(34, 211, 238, 0.26)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    color: 'rgba(243, 248, 255, 0.94)',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  closeBtn: { padding: 8 },
  closeText: { color: 'rgba(186, 201, 222, 0.82)', fontSize: 20, fontWeight: '600' },
  hint: {
    color: 'rgba(186, 201, 222, 0.82)',
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: 'rgba(186, 201, 222, 0.82)', marginBottom: 12, fontWeight: '600' },
  permBtn: {
    backgroundColor: 'rgba(8, 17, 31, 0.78)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.42)',
  },
  permBtnText: {
    color: '#22D3EE',
    fontWeight: '700',
    fontSize: 15,
  },
  cameraBox: {
    marginTop: 16,
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.55)',
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.42)',
    borderRadius: 14,
    margin: 36,
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: 'rgba(186,201,222,0.88)',
    marginTop: 12,
    fontWeight: '600',
  },
});
