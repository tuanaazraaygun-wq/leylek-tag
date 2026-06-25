import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { API_BASE_URL } from '../lib/backendConfig';
import { waitForPersistedAccessToken } from '../lib/sessionToken';
import { perfLog } from '../utils/perfDiagLog';
import { useQrPaymentTrustTheme } from '../lib/theme/useQrPaymentTrustTheme';

const QR_FETCH_TIMEOUT_MS = 9000;
const QR_SLOW_RETRY_MS = 3000;

type Props = {
  visible: boolean;
  onClose: () => void;
  tagId: string;
  /** LSX: yolcu biniş doğruladığında kısa onay overlay */
  remoteSuccess?: boolean;
};

export default function DriverBoardingQRModal({
  visible,
  onClose,
  tagId,
  remoteSuccess = false,
}: Props) {
  const { qrSurfaces: qrLt, ui } = useQrPaymentTrustTheme('qr');
  const [qrString, setQrString] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlowRetry, setShowSlowRetry] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const slowRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSlowRetryTimer = useCallback(() => {
    if (slowRetryTimerRef.current != null) {
      clearTimeout(slowRetryTimerRef.current);
      slowRetryTimerRef.current = null;
    }
  }, []);

  const abortInFlightFetch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const fetchCode = useCallback(async (isRetry = false) => {
    if (!tagId) return;
    abortInFlightFetch();
    clearSlowRetryTimer();

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), QR_FETCH_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    setShowSlowRetry(false);
    if (!isRetry) {
      setQrString(null);
    }
    perfLog('QR_DRIVER_FETCH_START', { tag_id: tagId, retry: isRetry });
    console.log('BOARDING_QR_REQUESTED', { tag_id: tagId, retry: isRetry });

    slowRetryTimerRef.current = setTimeout(() => {
      setShowSlowRetry(true);
    }, QR_SLOW_RETRY_MS);

    try {
      const tok = await waitForPersistedAccessToken();
      if (controller.signal.aborted) return;
      if (!tok?.trim()) {
        setError('Oturum bulunamadı; yeniden giriş yapın.');
        return;
      }
      const q = new URLSearchParams({ tag_id: String(tagId) });
      const res = await fetch(`${API_BASE_URL}/qr/boarding-code?${q.toString()}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${tok.trim()}` },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const raw = await res.text();
      let json: { success?: boolean; qr_string?: string; detail?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        if (res.status === 504) {
          setError('Sunucu yanıtı okunamadı (504). Tekrar deneyin.');
        } else {
          setError('Sunucu yanıtı okunamadı');
        }
        return;
      }
      if (res.status === 401) {
        setError(json.detail || 'Oturum doğrulanamadı');
        return;
      }
      if (res.status === 504) {
        setError('Sunucu yanıtı okunamadı (504). Tekrar deneyin.');
        return;
      }
      if (json.success && json.qr_string) {
        setQrString(json.qr_string);
        setShowSlowRetry(false);
        clearSlowRetryTimer();
        perfLog('QR_DRIVER_FETCH_SUCCESS', { tag_id: tagId, retry: isRetry });
      } else {
        setError(json.detail || 'Karekod alınamadı');
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setError('Biniş kodu alınamadı (zaman aşımı). Tekrar deneyin.');
      } else {
        setError('Ağ hatası');
      }
    } finally {
      clearTimeout(timeoutId);
      clearSlowRetryTimer();
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
      setShowSlowRetry(false);
    }
  }, [abortInFlightFetch, clearSlowRetryTimer, tagId]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setShowSlowRetry(false);
      void waitForPersistedAccessToken();
      void fetchCode(false);
    } else {
      abortInFlightFetch();
      clearSlowRetryTimer();
      setQrString(null);
      setError(null);
      setShowSlowRetry(false);
      setLoading(false);
    }
    return () => {
      abortInFlightFetch();
      clearSlowRetryTimer();
    };
  }, [visible, fetchCode, abortInFlightFetch, clearSlowRetryTimer]);

  const showSkeleton = !qrString && !error;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={[styles.scrim, qrLt?.scrim]} pointerEvents="none" />

        <GlassSurface variant="panel" style={[styles.sheet, qrLt?.container]} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <PremiumText variant="caption" style={[styles.phaseStep, qrLt?.phaseStep]}>
                Biniş doğrulaması
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                Yolcunun telefonuyla bu kodu okutmasını iste.
              </PremiumText>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, qrLt?.closeBtn]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Ionicons name="close" size={22} color={ui.closeIcon} />
            </TouchableOpacity>
          </View>

          <GlassSurface variant="plain" style={[styles.guardianChip, qrLt?.guardianChip]} borderRadius={LDS_RADIUS.full}>
            <View style={[styles.guardianLiveDot, qrLt?.guardianLiveDot]} />
            <Ionicons name="shield-checkmark-outline" size={14} color={ui.accent} />
            <PremiumText variant="caption" style={styles.guardianChipText}>
              Yolcu QR kodunu okutuyor
            </PremiumText>
          </GlassSurface>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.center}>
                <PremiumText variant="body" style={styles.errText}>
                  {error}
                </PremiumText>
                <TouchableOpacity
                  style={[styles.retryBtn, qrLt?.retryBtn]}
                  onPress={() => void fetchCode(true)}
                  activeOpacity={0.88}
                >
                  <PremiumText variant="body" style={styles.retryBtnText}>
                    Tekrar dene
                  </PremiumText>
                </TouchableOpacity>
              </View>
            ) : qrString ? (
              <GlassSurface variant="stage" style={[styles.qrStage, qrLt?.qrStage]} borderRadius={LDS_RADIUS.lg}>
                <View style={styles.qrCheckpointRow}>
                  <View style={[styles.qrIconRing, qrLt?.qrIconRing]}>
                    <Ionicons name="qr-code-outline" size={22} color={ui.accent} />
                  </View>
                  <View style={styles.qrCheckpointTextCol}>
                    <PremiumText variant="body" style={styles.qrCheckpointTitle}>
                      Biniş kodu hazır
                    </PremiumText>
                    <PremiumText variant="caption" muted style={styles.qrCheckpointSubtitle}>
                      Ekranı yolcuya doğrult
                    </PremiumText>
                  </View>
                </View>

                <View style={styles.qrBox}>
                  <QRCode value={qrString} size={220} backgroundColor="#fff" color="#0f172a" />
                </View>

                <PremiumText variant="caption" muted style={styles.qrHint}>
                  Kod doğrulandığında yolculuk güvenli şekilde başlar.
                </PremiumText>
                {remoteSuccess ? (
                  <View style={styles.remoteSuccessOverlay} pointerEvents="none">
                    <Ionicons name="checkmark-circle" size={52} color={ui.successIcon} />
                    <PremiumText variant="body" style={[styles.remoteSuccessTitle, qrLt?.remoteSuccessTitle]}>
                      Biniş doğrulandı
                    </PremiumText>
                    <PremiumText variant="caption" muted style={styles.remoteSuccessSubtitle}>
                      Yolcu kodu okuttu
                    </PremiumText>
                  </View>
                ) : null}
              </GlassSurface>
            ) : showSkeleton ? (
              <GlassSurface variant="stage" style={[styles.qrStage, qrLt?.qrStage]} borderRadius={LDS_RADIUS.lg}>
                <View style={styles.qrCheckpointRow}>
                  <View style={[styles.qrIconRing, qrLt?.qrIconRing]}>
                    <Ionicons name="qr-code-outline" size={22} color={ui.accent} />
                  </View>
                  <View style={styles.qrCheckpointTextCol}>
                    <PremiumText variant="body" style={styles.qrCheckpointTitle}>
                      Biniş kodu hazırlanıyor
                    </PremiumText>
                    <PremiumText variant="caption" muted style={styles.qrCheckpointSubtitle}>
                      {showSlowRetry
                        ? 'Bağlantı yavaş — tekrar deneyebilirsin'
                        : 'Biniş kodu alınıyor…'}
                    </PremiumText>
                  </View>
                </View>

                <View style={styles.qrSkeletonBox}>
                  <ActivityIndicator size="large" color={ui.activity} />
                </View>

                {showSlowRetry ? (
                  <TouchableOpacity
                    style={[styles.retryBtn, qrLt?.retryBtn]}
                    onPress={() => void fetchCode(true)}
                    activeOpacity={0.88}
                  >
                    <PremiumText variant="body" style={styles.retryBtnText}>
                      Tekrar dene
                    </PremiumText>
                  </TouchableOpacity>
                ) : (
                  <PremiumText variant="caption" muted style={styles.qrHint}>
                    Biniş kodu hazırlanıyor…
                  </PremiumText>
                )}
              </GlassSurface>
            ) : null}
          </ScrollView>
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
  sheet: {
    maxHeight: '90%',
    paddingBottom: LDS_SPACING.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    ...LDS_ELEVATION.cockpit,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.sm,
    gap: LDS_SPACING.sm,
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
  body: {
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.xl,
  },
  center: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.lg,
    gap: LDS_SPACING.sm,
  },
  errText: {
    textAlign: 'center',
    fontWeight: '600',
    color: 'rgba(252, 212, 213, 0.92)',
    paddingHorizontal: LDS_SPACING.sm,
  },
  retryBtn: {
    marginTop: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.lg,
    paddingVertical: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  retryBtnText: {
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  qrStage: {
    alignItems: 'center',
    paddingVertical: LDS_SPACING.lg,
    paddingHorizontal: LDS_SPACING.md,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    position: 'relative',
    overflow: 'hidden',
    ...LDS_ELEVATION.panel,
  },
  qrCheckpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  qrIconRing: {
    width: 48,
    height: 48,
    borderRadius: LDS_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    flexShrink: 0,
    ...LDS_ELEVATION.flat,
  },
  qrCheckpointTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  qrCheckpointTitle: {
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  qrCheckpointSubtitle: {
    lineHeight: 16,
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: 'rgba(34,211,238,0.22)',
    ...LDS_ELEVATION.flat,
  },
  qrSkeletonBox: {
    width: 252,
    height: 252,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.72)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderStyle: 'dashed',
  },
  qrHint: {
    marginTop: LDS_SPACING.sm,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xs,
  },
  remoteSuccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.82)',
    borderRadius: LDS_RADIUS.lg,
    gap: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.md,
  },
  remoteSuccessTitle: {
    fontWeight: '700',
    color: 'rgba(186, 230, 253, 0.96)',
    textAlign: 'center',
  },
  remoteSuccessSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
