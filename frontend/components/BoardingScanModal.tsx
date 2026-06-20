import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { API_BASE_URL } from '../lib/backendConfig';
import { appAlert } from '../contexts/AppAlertContext';
import { waitForPersistedAccessToken } from '../lib/sessionToken';
import { playQrScanErrorSound, playQrScanSuccessSound } from '../utils/sound';
import { tapButtonHaptic } from '../utils/touchHaptics';

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
const BOARDING_SUCCESS_BEAT_MS = 400;

function boardingSuccessBeatDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, BOARDING_SUCCESS_BEAT_MS);
  });
}

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
  const [successBeat, setSuccessBeat] = useState(false);
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
    setSuccessBeat(false);
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
      setSuccessBeat(false);
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
            void playQrScanErrorSound();
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
            void playQrScanErrorSound();
            appAlert('Hata', 'Sunucu yanıtı okunamadı');
          }
          return;
        }
        if (res.status === 401) {
          if (!closingRef.current) {
            void playQrScanErrorSound();
            appAlert('Oturum', json.detail || 'Oturum süresi dolmuş olabilir; yeniden giriş yapın.');
          }
          return;
        }
        if (json.success) {
          void playQrScanSuccessSound();
          void tapButtonHaptic();
          const rawTag = (json as { tag_id?: string }).tag_id;
          const propTag = typeof tagId === 'string' ? tagId.trim() : '';
          const tag_id =
            (typeof rawTag === 'string' && rawTag.trim()) || propTag || undefined;
          console.log('BOARDING_SCAN_SUCCESS', { tag_id, used_prop_fallback: !rawTag && !!propTag });
          verifiedClosingRef.current = true;
          closingRef.current = true;
          if (canMutateScanState()) {
            setCameraReady(false);
            setProcessing(false);
            setSuccessBeat(true);
          }
          await boardingSuccessBeatDelay();
          if (!mountedRef.current || !visibleRef.current) {
            return;
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
            if (canMutateScanState()) {
              setSuccessBeat(false);
            }
          }
        } else {
          if (closingRef.current) {
            return;
          }
          void playQrScanErrorSound();
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
          void playQrScanErrorSound();
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

  const scannerActive = cameraReady && !scanned && !processing && !successBeat;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <GlassSurface variant="panel" style={styles.container} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <PremiumText variant="caption" style={styles.phaseStep}>
                Biniş doğrulaması
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                Sürücünün gösterdiği QR kodu okut.
              </PremiumText>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Ionicons name="close" size={22} color="rgba(186,201,222,0.82)" />
            </TouchableOpacity>
          </View>

          <GlassSurface variant="plain" style={styles.guardianChip} borderRadius={LDS_RADIUS.full}>
            <View style={styles.guardianLiveDot} />
            <Ionicons name="scan-outline" size={14} color="rgba(34,211,238,0.88)" />
            <PremiumText variant="caption" style={styles.guardianChipText}>
              Güvenli biniş kontrolü
            </PremiumText>
          </GlassSurface>

          <PremiumText variant="caption" muted style={styles.hint}>
            Yalnızca sürücünün gösterdiği biniş kodu geçerlidir; yol sonu kodu değil.
          </PremiumText>

          {!hasPermission?.granted ? (
            <View style={styles.centerBox}>
              <PremiumText variant="body" muted style={styles.permLabel}>
                Kamera izni gerekli
              </PremiumText>
              <TouchableOpacity
                style={styles.permBtn}
                onPress={() => void requestPermission()}
                activeOpacity={0.88}
              >
                <PremiumText variant="body" style={styles.permBtnText}>
                  İzin ver
                </PremiumText>
              </TouchableOpacity>
            </View>
          ) : (
            <GlassSurface variant="stage" style={styles.cameraStage} borderRadius={LDS_RADIUS.lg}>
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
                <View style={styles.scanOverlay} pointerEvents="none">
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </View>
                </View>
                {!cameraReady && !processing ? (
                  <View style={styles.processing}>
                    <ActivityIndicator size="large" color="#22D3EE" />
                    <PremiumText variant="caption" muted style={styles.processingText}>
                      Kamera hazırlanıyor…
                    </PremiumText>
                  </View>
                ) : null}
                {processing ? (
                  <View style={styles.processing}>
                    <ActivityIndicator size="large" color="#22D3EE" />
                    <PremiumText variant="caption" muted style={styles.processingText}>
                      Doğrulanıyor…
                    </PremiumText>
                  </View>
                ) : null}
                {successBeat ? (
                  <View style={styles.processing}>
                    <Ionicons name="checkmark-circle" size={56} color="rgba(34,211,238,0.95)" />
                    <PremiumText variant="body" style={styles.successTitle}>
                      Biniş doğrulandı
                    </PremiumText>
                    <PremiumText variant="caption" muted style={styles.processingText}>
                      Yolculuk başlıyor…
                    </PremiumText>
                  </View>
                ) : null}
              </View>
            </GlassSurface>
          )}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  container: {
    maxHeight: '88%',
    paddingBottom: LDS_SPACING.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    ...LDS_ELEVATION.cockpit,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LDS_BORDER_COLOR.card,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  phaseStep: {
    letterSpacing: 0.06,
    fontWeight: '600',
    color: 'rgba(186, 230, 253, 0.94)',
  },
  phaseCaption: {
    lineHeight: 18,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  guardianChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: LDS_SPACING.xs,
    marginTop: LDS_SPACING.sm,
    marginHorizontal: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.md,
    paddingVertical: LDS_SPACING.xs,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  guardianLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(34,211,238,0.92)',
  },
  guardianChipText: {
    fontWeight: '600',
    letterSpacing: 0.04,
    color: 'rgba(186, 230, 253, 0.92)',
  },
  hint: {
    marginTop: LDS_SPACING.sm,
    marginHorizontal: LDS_SPACING.lg,
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  centerBox: {
    marginHorizontal: LDS_SPACING.lg,
    paddingVertical: LDS_SPACING.xl,
    alignItems: 'center',
    gap: LDS_SPACING.sm,
  },
  permLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  permBtn: {
    paddingHorizontal: LDS_SPACING.lg,
    paddingVertical: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  permBtnText: {
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  cameraStage: {
    marginTop: LDS_SPACING.md,
    marginHorizontal: LDS_SPACING.lg,
    overflow: 'hidden',
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.panel,
  },
  cameraBox: {
    height: 320,
    overflow: 'hidden',
    backgroundColor: '#020617',
    position: 'relative',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '70%',
    height: '70%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: 'rgba(34, 211, 238, 0.52)',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: LDS_RADIUS.sm,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: LDS_RADIUS.sm,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: LDS_RADIUS.sm,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: LDS_RADIUS.sm,
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
  },
  processingText: {
    marginTop: LDS_SPACING.xs,
    fontWeight: '600',
  },
  successTitle: {
    marginTop: LDS_SPACING.sm,
    fontWeight: '700',
    color: 'rgba(186, 230, 253, 0.96)',
    textAlign: 'center',
  },
});
