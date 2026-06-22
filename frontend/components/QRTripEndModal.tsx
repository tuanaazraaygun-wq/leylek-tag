import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Vibration,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import { API_BASE_URL } from '../lib/backendConfig';
import { appAlert } from '../contexts/AppAlertContext';
import { playQrScanErrorSound, playQrScanSuccessSound } from '../utils/sound';
import { tapButtonHaptic } from '../utils/touchHaptics';
import { useQrPaymentTrustTheme } from '../lib/theme/useQrPaymentTrustTheme';
import { PaymentLegalDisclaimer } from './legal/PaymentLegalDisclaimer';

const { width } = Dimensions.get('window');

/** Çift decode burst — retry’i kilitlemez */
const TRIP_END_SCAN_BURST_DEDUPE_MS = 120;
const TRIP_END_SUCCESS_BEAT_MS = 400;

function tripEndSuccessBeatDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, TRIP_END_SUCCESS_BEAT_MS);
  });
}

type PaymentMethod = 'cash' | 'card';

type CompleteQrOutcome = 'success' | 'conflict' | 'error';

interface QRTripEndModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  tagId: string;
  isDriver: boolean;
  otherUserName: string;
  myLatitude?: number;
  myLongitude?: number;
  otherLatitude?: number;
  otherLongitude?: number;
  /** Teklifte yolcunun seçtiği ödeme (yalnızca yolcu QR akışında) */
  bookingPaymentMethod?: PaymentMethod | null;
  /** tags.match_channel — trusted direct ödeme UI kısıtları */
  matchChannel?: string | null;
  /** Yolcu: eşleşmede IBAN snapshot varsa bitiş ekranında seçenek göster */
  showIbanOption?: boolean;
  onChooseDriverIban?: () => void;
  /** Trusted Direct: nakit katkı bildirimi (claim cash) — QR complete kullanılmaz */
  onTrustedPaymentClaim?: (method: 'cash') => void | Promise<void>;
  onComplete: (showRating: boolean, rateUserId: string, rateUserName: string) => void;
  /** Sürücü: yolcu QR tamamlayınca kısa remote onay overlay */
  remoteSuccess?: boolean;
}

export default function QRTripEndModal({
  visible,
  onClose,
  userId,
  tagId,
  isDriver,
  otherUserName,
  myLatitude,
  myLongitude,
  otherLatitude,
  otherLongitude,
  bookingPaymentMethod = null,
  matchChannel = null,
  showIbanOption = false,
  onChooseDriverIban,
  onTrustedPaymentClaim,
  onComplete,
  remoteSuccess = false,
}: QRTripEndModalProps) {
  const { qrSurfaces: qrLt, ui: qrUi } = useQrPaymentTrustTheme('qr');
  const { paymentSurfaces: payLt, ui: payUi } = useQrPaymentTrustTheme('payment');
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);
  const isTrustedDirect = String(matchChannel || '').trim().toLowerCase() === 'trusted';
  const effectiveBookingPaymentMethod: PaymentMethod | null =
    isTrustedDirect && bookingPaymentMethod === 'card' ? null : bookingPaymentMethod;
  const showCardPaymentOption = !isTrustedDirect;
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  /** iOS: kamera cold-start — BoardingScanModal ile aynı session/remount pattern */
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  /** Yolcu: bitirme yolu seçimi / QR / ödeme onayı */
  const [passengerStep, setPassengerStep] = useState<'choose' | 'scan' | 'payment'>('scan');
  const [scanSuccessBeat, setScanSuccessBeat] = useState(false);
  const [pendingDriverId, setPendingDriverId] = useState<string | null>(null);
  const [legacyPaymentPick, setLegacyPaymentPick] = useState<PaymentMethod | null>(null);
  const lastScannedValueRef = useRef<{ data: string; ts: number }>({ data: '', ts: 0 });
  const mountedRef = useRef(true);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const qrValue = `leylektag://end?u=${userId}&t=${tagId}`;
  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';
  const canAutoCompleteCashAfterScan =
    !isTrustedDirect &&
    (effectiveBookingPaymentMethod === 'cash' || effectiveBookingPaymentMethod == null);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      setScanSuccessBeat(false);
      setPassengerStep(!isDriver && (isTrustedDirect || showIbanOption) ? 'choose' : 'scan');
      setPendingDriverId(null);
      setLegacyPaymentPick(null);
      lastScannedValueRef.current = { data: '', ts: 0 };
    }
  }, [visible, isDriver, showIbanOption, isTrustedDirect]);

  /** Yolcu scan adımına girince kamera oturumunu yenile (visible+scan — IBAN choose sonrası dahil) */
  useEffect(() => {
    if (!visible || isDriver || passengerStep !== 'scan') return;
    setCameraSessionKey((k) => k + 1);
    setCameraReady(false);
    setScanned(false);
    lastScannedValueRef.current = { data: '', ts: 0 };
    if (!hasPermission?.granted) {
      void requestPermission();
    }
  }, [visible, isDriver, passengerStep, hasPermission?.granted, requestPermission]);

  const scannerActive =
    !isTrustedDirect &&
    !isDriver &&
    passengerStep === 'scan' &&
    cameraReady &&
    !scanned &&
    !processing &&
    !scanSuccessBeat;

  const submitCompleteQr = useCallback(
    async (paymentConfirmed: PaymentMethod, driverUserId: string): Promise<CompleteQrOutcome> => {
      setProcessing(true);
      try {
        const response = await fetch(`${API_BASE_URL}/trip/complete-qr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            tag_id: tagId,
            scanner_user_id: userId,
            scanned_user_id: driverUserId,
            latitude: myLatitude || 0,
            longitude: myLongitude || 0,
            payment_confirmed_method: paymentConfirmed,
          }),
        });

        const raw = await response.text();
        let result: {
          success?: boolean;
          detail?: string | { message?: string };
          driver_name?: string;
        } = {};
        try {
          result = raw ? JSON.parse(raw) : {};
        } catch {
          console.error('QR complete-qr non-JSON:', raw.slice(0, 200));
          appAlert(
            'Yanıt okunamadı',
            response.ok
              ? 'Kısa bir süre sonra tekrar deneyin.'
              : 'Sunucu yanıt vermedi. Kısa bir süre sonra tekrar deneyin.',
            [{ text: 'Tamam', style: 'default' }],
            { variant: 'info' },
          );
          return 'error';
        }

        if (result.success) {
          Vibration.vibrate([0, 100, 50, 100]);
          onComplete(true, driverUserId, result.driver_name || firstName);
          onClose();
          return 'success';
        }

        if (response.status === 409) {
          return 'conflict';
        }

        const detailRaw = result.detail;
        const detailMsg =
          typeof detailRaw === 'string'
            ? detailRaw
            : typeof detailRaw === 'object' && detailRaw?.message
              ? String(detailRaw.message)
              : 'Yolculuk bitirilemedi. Kısa bir süre sonra tekrar deneyin.';
        appAlert('Tamamlanamadı', detailMsg, [{ text: 'Tamam', style: 'default' }], {
          variant: 'warning',
        });
        return 'error';
      } catch (error) {
        console.error('QR complete error:', error);
        appAlert(
          'Bağlantı kurulamadı',
          'İnternet bağlantını kontrol edip tekrar deneyin.',
          [{ text: 'Tamam', style: 'default' }],
          { variant: 'info' },
        );
        return 'error';
      } finally {
        setProcessing(false);
      }
    },
    [tagId, userId, myLatitude, myLongitude, onComplete, onClose, firstName],
  );

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (isDriver || isTrustedDirect) return;
      if (!cameraReady || scanned || processing || scanSuccessBeat) return;
      const raw = (data || '').trim();
      if (!raw.startsWith('leylektag://end?')) {
        return;
      }

      const now = Date.now();
      const prev = lastScannedValueRef.current;
      if (prev.data === raw && now - prev.ts < TRIP_END_SCAN_BURST_DEDUPE_MS) {
        return;
      }
      lastScannedValueRef.current = { data: raw, ts: now };

      setScanned(true);
      void tapButtonHaptic();

      const params = new URLSearchParams(raw.split('?')[1]);
      const driverUserId = params.get('u');
      const qrTagId = params.get('t');

      if (!driverUserId || !qrTagId) {
        void playQrScanErrorSound();
        appAlert(
          'Geçersiz kod',
          'QR kodu okunamadı. Tekrar deneyin.',
          [{ text: 'Tamam', style: 'default' }],
          { variant: 'warning' },
        );
        lastScannedValueRef.current = { data: '', ts: 0 };
        setScanned(false);
        return;
      }

      if (qrTagId !== tagId) {
        void playQrScanErrorSound();
        appAlert(
          'Uyumsuz kod',
          'Bu QR kod bu yolculuğa ait değil.',
          [{ text: 'Tamam', style: 'default' }],
          { variant: 'warning' },
        );
        lastScannedValueRef.current = { data: '', ts: 0 };
        setScanned(false);
        return;
      }

      lastScannedValueRef.current = { data: '', ts: 0 };
      void playQrScanSuccessSound();
      setCameraReady(false);
      setScanSuccessBeat(true);
      await tripEndSuccessBeatDelay();
      if (!mountedRef.current || !visibleRef.current) {
        return;
      }

      if (canAutoCompleteCashAfterScan) {
        setScanSuccessBeat(false);
        const outcome = await submitCompleteQr('cash', driverUserId);
        if (outcome === 'success') {
          return;
        }
        setPendingDriverId(driverUserId);
        setPassengerStep('payment');
        setScanned(false);
        if (outcome === 'conflict') {
          appAlert(
            'Katkı payı mutabakatı gerekli',
            'Katkı payı mutabakatı tamamlanmadan yolculuk bitirilemez. Katkı payı bilgisini kontrol edin.',
            [{ text: 'Tamam', style: 'default' }],
            { variant: 'info' },
          );
        }
        return;
      }

      setPendingDriverId(driverUserId);
      setPassengerStep('payment');
      setScanned(false);
      setScanSuccessBeat(false);
    },
    [
      isDriver,
      isTrustedDirect,
      cameraReady,
      scanned,
      processing,
      scanSuccessBeat,
      tagId,
      canAutoCompleteCashAfterScan,
      submitCompleteQr,
    ],
  );

  const handleTrustedCashClaim = () => {
    if (processing) return;
    setProcessing(true);
    void Promise.resolve(onTrustedPaymentClaim?.('cash')).finally(() => {
      setProcessing(false);
    });
  };

  const handlePassengerPaymentConfirm = (method: PaymentMethod) => {
    if (!pendingDriverId) {
      appAlert(
        'Önce tara',
        'Önce sürücü QR kodunu tarayın.',
        [{ text: 'Tamam', style: 'default' }],
        { variant: 'info' },
      );
      return;
    }
    void submitCompleteQr(method, pendingDriverId);
  };

  const handleLegacyConfirm = () => {
    if (!legacyPaymentPick || !pendingDriverId) {
      appAlert(
        'Seçim gerekli',
        'Katkı payı veya kart seçeneğini işaretleyin.',
        [{ text: 'Tamam', style: 'default' }],
        { variant: 'info' },
      );
      return;
    }
    void submitCompleteQr(legacyPaymentPick, pendingDriverId);
  };

  const handleClose = () => {
    setScanned(false);
    setProcessing(false);
    setScanSuccessBeat(false);
    setCameraReady(false);
    setPassengerStep(!isDriver && (isTrustedDirect || showIbanOption) ? 'choose' : 'scan');
    setPendingDriverId(null);
    setLegacyPaymentPick(null);
    lastScannedValueRef.current = { data: '', ts: 0 };
    onClose();
  };

  const paymentTitle =
    effectiveBookingPaymentMethod === 'cash'
      ? 'Katkı payı'
      : effectiveBookingPaymentMethod === 'card'
        ? 'Kart (yakında)'
        : 'Katkı payını nasıl ilettiğinizi seçin';

  const paymentSubtitle =
    effectiveBookingPaymentMethod === 'cash'
      ? 'Teklifte katkı payı nakit olarak belirlenmişti. Katkı payını ilettiğinizi onaylayın. LeylekTAG tahsilat yapmaz.'
      : effectiveBookingPaymentMethod === 'card'
        ? 'Kart yakında. Şimdilik katkı bildirimini onaylayarak yolculuğu tamamlayın.'
        : isTrustedDirect
          ? 'Katkı payını nakit olarak ilettiğinizi onaylayın.'
          : 'Bu yolculuk için teklifte katkı tercihi kayıtlı değil. Katkı payını nasıl ilettiğinizi seçin.';

  const phaseStep = isTrustedDirect
    ? isDriver
      ? 'Katkı payı mutabakatı bekleniyor'
      : 'Yol paylaşımını bitir'
    : isDriver
      ? 'Yolculuk tamamlandı'
      : passengerStep === 'choose' || passengerStep === 'payment'
        ? 'Katkı payını bildir'
        : 'Yolculuk tamamlandı';

  const phaseCaption = isTrustedDirect
    ? isDriver
      ? 'Yolcu katkı payı bildirimi gönderdiğinde mutabakatınızla yolculuk kapanır.'
      : 'Katkı payınızı nasıl ilettiğinizi bildirin; sürücü mutabakatından sonra yolculuk tamamlanır.'
    : isDriver
      ? `${firstName} bu kodu tarasın`
      : passengerStep === 'choose'
        ? 'Yolculuğu güvenli şekilde tamamlamak için yöntemi seç.'
        : passengerStep === 'payment'
          ? 'Katkı payını kontrol ederek tamamla.'
          : canAutoCompleteCashAfterScan
            ? 'Sürücü QR kodunu okut — yolculuk tamamlanır.'
            : 'Yolculuğu güvenli şekilde tamamlamak için QR kodunu okut.';

  const showPaymentFooter = !isDriver && passengerStep === 'payment';

  const renderPaymentFooter = () => {
    if (!showPaymentFooter) return null;
    const primaryIconColor = payLt ? payUi.selectedIcon : payUi.accent;

    return (
      <View style={styles.paymentFooter}>
        <PaymentLegalDisclaimer compact accentColor={payUi.accent} />

        {effectiveBookingPaymentMethod === 'cash' && (
          <TouchableOpacity
            style={[styles.primaryPayBtn, payLt?.primaryPayBtn]}
            onPress={() => handlePassengerPaymentConfirm('cash')}
            disabled={processing}
            activeOpacity={0.88}
          >
            <Ionicons name="cash-outline" size={24} color={primaryIconColor} />
            <PremiumText variant="body" style={[styles.primaryPayText, payLt?.primaryPayText]}>
              Katkı payını ilettim — yolculuğu tamamla
            </PremiumText>
          </TouchableOpacity>
        )}

        {showCardPaymentOption && effectiveBookingPaymentMethod === 'card' && (
          <TouchableOpacity
            style={[styles.primaryPayBtn, payLt?.primaryPayBtn]}
            onPress={() => handlePassengerPaymentConfirm('card')}
            disabled={processing}
            activeOpacity={0.88}
          >
            <Ionicons name="card-outline" size={24} color={primaryIconColor} />
            <PremiumText variant="body" style={[styles.primaryPayText, payLt?.primaryPayText]}>
              Kart ile katkıyı ilettiğimi onayla
            </PremiumText>
          </TouchableOpacity>
        )}

        {!effectiveBookingPaymentMethod && (
          <TouchableOpacity
            style={[
              styles.primaryPayBtn,
              payLt?.primaryPayBtn,
              (!legacyPaymentPick || processing) && styles.primaryPayBtnDisabled,
            ]}
            onPress={handleLegacyConfirm}
            disabled={processing || !legacyPaymentPick}
            activeOpacity={0.88}
          >
            <PremiumText variant="body" style={[styles.primaryPayText, payLt?.primaryPayText]}>
              Onayla ve yolculuğu bitir
            </PremiumText>
          </TouchableOpacity>
        )}

        {processing ? (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color={payUi.activity} />
            <PremiumText variant="caption" muted style={styles.processingInlineText}>
              Yolculuk tamamlanıyor
            </PremiumText>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.backScan, payLt?.backScan]}
          onPress={() => {
            setPassengerStep('scan');
            setPendingDriverId(null);
          }}
          activeOpacity={0.85}
        >
          <PremiumText variant="caption" style={[styles.backScanText, payLt?.backScanText]}>
            ← QR taramaya dön
          </PremiumText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={[styles.scrim, qrLt?.scrim, payLt?.scrim]} pointerEvents="none" />

        <GlassSurface variant="panel" style={[styles.container, qrLt?.container, payLt?.container, { paddingBottom: footerPad }]} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <PremiumText variant="caption" style={[styles.phaseStep, qrLt?.phaseStep, payLt?.phaseStep]}>
                {phaseStep}
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                {phaseCaption}
              </PremiumText>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, qrLt?.closeBtn, payLt?.closeBtn]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Ionicons name="close" size={22} color={qrUi.closeIcon} />
            </TouchableOpacity>
          </View>

          <GlassSurface variant="plain" style={[styles.guardianChip, qrLt?.guardianChip, payLt?.guardianChip]} borderRadius={LDS_RADIUS.full}>
            <View style={[styles.guardianLiveDot, qrLt?.guardianLiveDot, payLt?.guardianLiveDot]} />
            <Ionicons name="checkmark-done-outline" size={14} color={qrUi.accent} />
            <PremiumText variant="caption" style={styles.guardianChipText}>
              {isTrustedDirect ? 'Katkı bildirimi' : 'Yolculuk tamamlandı'}
            </PremiumText>
          </GlassSurface>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {isDriver ? (
              isTrustedDirect ? (
                <View style={styles.qrContainer}>
                  <GlassSurface variant="stage" style={[styles.qrStage, qrLt?.qrStage]} borderRadius={LDS_RADIUS.lg}>
                    <View style={styles.qrCheckpointRow}>
                      <View style={[styles.qrIconRing, qrLt?.qrIconRing]}>
                        <Ionicons name="hourglass-outline" size={22} color={qrUi.accent} />
                      </View>
                      <View style={styles.qrCheckpointTextCol}>
                        <PremiumText variant="body" style={styles.qrCheckpointTitle}>
                          Yolcu katkı bildirimi bekleniyor
                        </PremiumText>
                        <PremiumText variant="caption" muted style={styles.qrCheckpointSubtitle}>
                          {firstName} katkı payını nakit veya sürücü IBANına bildirecek
                        </PremiumText>
                      </View>
                    </View>
                    <PremiumText variant="caption" muted style={styles.hint}>
                      Onayınızla yolculuk tamamlanır ve değerlendirme açılır.
                    </PremiumText>
                  </GlassSurface>
                </View>
              ) : (
              <View style={styles.qrContainer}>
                <GlassSurface variant="stage" style={[styles.qrStage, qrLt?.qrStage]} borderRadius={LDS_RADIUS.lg}>
                  <View style={styles.qrCheckpointRow}>
                    <View style={[styles.qrIconRing, qrLt?.qrIconRing]}>
                      <Ionicons name="flag-outline" size={22} color={qrUi.accent} />
                    </View>
                    <View style={styles.qrCheckpointTextCol}>
                      <PremiumText variant="body" style={styles.qrCheckpointTitle}>
                        Yolculuk sonu kodu hazır
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.qrCheckpointSubtitle}>
                        Ekranı yolcuya doğrult
                      </PremiumText>
                    </View>
                  </View>
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={qrValue}
                      size={width * 0.55}
                      backgroundColor="white"
                      color="#041e33"
                      quietZone={10}
                    />
                  </View>
                  {remoteSuccess ? (
                    <View style={styles.remoteSuccessOverlay} pointerEvents="none">
                      <Ionicons name="checkmark-circle" size={56} color={qrUi.successIcon} />
                      <PremiumText variant="body" style={[styles.remoteSuccessTitle, qrLt?.remoteSuccessTitle]}>
                        QR doğrulandı
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.remoteSuccessSubtitle}>
                        Yolcu kodu okuttu
                      </PremiumText>
                    </View>
                  ) : null}
                  <PremiumText variant="caption" muted style={styles.hint}>
                    Yolcu kodu taradığında yolculuk güvenli şekilde tamamlanır.
                  </PremiumText>
                </GlassSurface>
              </View>
              )
            ) : isTrustedDirect ? (
              <View style={styles.choosePanel}>
                <PremiumText variant="body" style={styles.chooseQuestion}>
                  Yol paylaşımını nasıl bitirmek istersiniz?
                </PremiumText>
                <TouchableOpacity
                  style={styles.chooseOptionWrap}
                  onPress={handleTrustedCashClaim}
                  activeOpacity={0.88}
                  disabled={processing}
                  accessibilityRole="button"
                  accessibilityLabel="Katkı payını nakit olarak ilettim"
                >
                  <GlassSurface variant="plain" style={[styles.chooseOption, payLt?.chooseOption]} borderRadius={LDS_RADIUS.md}>
                    <View style={[styles.chooseOptionIconWrap, payLt?.chooseOptionIconWrap]}>
                      <Ionicons name="cash-outline" size={24} color={payUi.accent} />
                    </View>
                    <View style={styles.chooseOptionTextCol}>
                      <PremiumText variant="body" style={styles.chooseOptionTitle}>
                        Katkı payını nakit olarak ilettim
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.chooseOptionSubtitle}>
                        Sürücü onayından sonra yolculuk tamamlanır
                      </PremiumText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={payUi.chevron} />
                  </GlassSurface>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chooseOptionWrap}
                  onPress={() => onChooseDriverIban?.()}
                  activeOpacity={0.88}
                  disabled={processing}
                  accessibilityRole="button"
                  accessibilityLabel="Katkı payını sürücünün IBANına Havale EFT ile ilettim"
                >
                  <GlassSurface variant="plain" style={[styles.chooseOption, payLt?.chooseOption]} borderRadius={LDS_RADIUS.md}>
                    <View style={[styles.chooseOptionIconWrap, payLt?.chooseOptionIconWrap]}>
                      <Ionicons name="card-outline" size={24} color={payUi.accent} />
                    </View>
                    <View style={styles.chooseOptionTextCol}>
                      <PremiumText variant="body" style={styles.chooseOptionTitle}>
                        Katkı payını sürücünün IBANına Havale/EFT ile ilettim
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.chooseOptionSubtitle}>
                        Sürücü hesap bilgilerini görüntüle
                      </PremiumText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={payUi.chevron} />
                  </GlassSurface>
                </TouchableOpacity>
                {processing ? (
                  <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color={payUi.activity} />
                    <PremiumText variant="caption" muted style={styles.processingInlineText}>
                      Bildirim gönderiliyor
                    </PremiumText>
                  </View>
                ) : null}
                <PaymentLegalDisclaimer compact accentColor={payUi.accent} />
              </View>
            ) : passengerStep === 'choose' ? (
              <View style={styles.choosePanel}>
                <PremiumText variant="body" style={styles.chooseQuestion}>
                  Yolculuğu nasıl bitirmek istersiniz?
                </PremiumText>
                <TouchableOpacity
                  style={styles.chooseOptionWrap}
                  onPress={() => onChooseDriverIban?.()}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Havale / EFT bilgilerini gör"
                >
                  <GlassSurface variant="plain" style={[styles.chooseOption, payLt?.chooseOption]} borderRadius={LDS_RADIUS.md}>
                    <View style={[styles.chooseOptionIconWrap, payLt?.chooseOptionIconWrap]}>
                      <Ionicons name="card-outline" size={24} color={payUi.accent} />
                    </View>
                    <View style={styles.chooseOptionTextCol}>
                      <PremiumText variant="body" style={styles.chooseOptionTitle}>
                        Havale / EFT
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.chooseOptionSubtitle}>
                        Sürücü hesap bilgilerini görüntüle
                      </PremiumText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={payUi.chevron} />
                  </GlassSurface>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chooseOptionWrap}
                  onPress={() => setPassengerStep('scan')}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Sürücü QR kodunu tara"
                >
                  <GlassSurface variant="plain" style={[styles.chooseOption, payLt?.chooseOption]} borderRadius={LDS_RADIUS.md}>
                    <View style={[styles.chooseOptionIconWrap, payLt?.chooseOptionIconWrap]}>
                      <Ionicons name="qr-code-outline" size={24} color={payUi.accent} />
                    </View>
                    <View style={styles.chooseOptionTextCol}>
                      <PremiumText variant="body" style={styles.chooseOptionTitle}>
                        Sürücü QR kodunu tara
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.chooseOptionSubtitle}>
                        Katkı payını ilettim — QR ile tamamla
                      </PremiumText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={payUi.chevron} />
                  </GlassSurface>
                </TouchableOpacity>
                <PaymentLegalDisclaimer compact accentColor={payUi.accent} />
              </View>
            ) : passengerStep === 'scan' ? (
              <View style={styles.cameraContainer}>
                {hasPermission?.granted ? (
                  <GlassSurface variant="stage" style={[styles.cameraStage, qrLt?.cameraStage]} borderRadius={LDS_RADIUS.lg}>
                    <View style={styles.cameraWrapper}>
                      <CameraView
                        key={`trip-end-cam-${cameraSessionKey}`}
                        style={styles.camera}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onCameraReady={() => {
                          setCameraReady(true);
                          if (__DEV__) {
                            console.log('[QRTripEndModal] onCameraReady');
                          }
                        }}
                        onBarcodeScanned={scannerActive ? handleBarCodeScanned : undefined}
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
                        <View style={styles.cameraStatusOverlay}>
                          <ActivityIndicator size="large" color={qrUi.activity} />
                          <PremiumText variant="caption" muted style={styles.processingText}>
                            Kamera hazırlanıyor
                          </PremiumText>
                        </View>
                      ) : null}
                      {processing ? (
                        <View style={styles.cameraStatusOverlay}>
                          <ActivityIndicator size="large" color={qrUi.activity} />
                          <PremiumText variant="caption" muted style={styles.processingText}>
                            İşlem hazırlanıyor
                          </PremiumText>
                        </View>
                      ) : null}
                      {scanSuccessBeat ? (
                        <View style={styles.cameraStatusOverlay}>
                          <Ionicons name="checkmark-circle" size={56} color={qrUi.successIcon} />
                          <PremiumText variant="body" style={[styles.scanSuccessTitle, qrLt?.scanSuccessTitle]}>
                            QR doğrulandı
                          </PremiumText>
                          <PremiumText variant="caption" muted style={styles.processingText}>
                            {canAutoCompleteCashAfterScan
                              ? 'QR doğrulandı, yolculuk tamamlanıyor…'
                              : 'Katkı payını onaylamaya geçiliyor…'}
                          </PremiumText>
                        </View>
                      ) : null}
                    </View>
                  </GlassSurface>
                ) : (
                  <View style={styles.permCenter}>
                    <PremiumText variant="body" muted style={styles.permLabel}>
                      Kameraya erişim gerekli
                    </PremiumText>
                    <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.88}>
                      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={[styles.permissionBtnGlass, payLt?.permissionBtnGlass]}>
                        <PremiumText variant="body" style={styles.permissionBtnText}>
                          İzin ver
                        </PremiumText>
                      </GlassSurface>
                    </TouchableOpacity>
                  </View>
                )}

                <PremiumText variant="caption" muted style={styles.hint}>
                  {canAutoCompleteCashAfterScan
                    ? 'QR okutulunca yolculuk tamamlanır'
                    : 'Gerekirse katkı payını onaylayacaksın'}
                </PremiumText>
              </View>
            ) : (
              <View style={styles.paymentPanel}>
                <GlassSurface variant="plain" style={[styles.paymentCard, payLt?.paymentCard]} borderRadius={LDS_RADIUS.lg}>
                  <View style={[styles.paymentIconWrap, payLt?.paymentIconWrap]}>
                    <Ionicons name="wallet-outline" size={32} color={payUi.accent} />
                  </View>
                  <PremiumText variant="body" style={styles.paymentHeading}>
                    {paymentTitle}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.paymentBody}>
                    {paymentSubtitle}
                  </PremiumText>

                  {!effectiveBookingPaymentMethod && (
                    <>
                      {!isTrustedDirect ? (
                        <PremiumText variant="caption" muted style={styles.legacyPickLabel}>
                          Katkıyı nasıl ilettiniz?
                        </PremiumText>
                      ) : null}
                      <View style={styles.legacyRow}>
                        <TouchableOpacity
                          style={styles.legacyChipWrap}
                          onPress={() => setLegacyPaymentPick('cash')}
                          activeOpacity={0.88}
                        >
                          <GlassSurface
                            variant="plain"
                            borderRadius={LDS_RADIUS.md}
                            style={[
                              styles.legacyChip,
                              payLt?.legacyChip,
                              legacyPaymentPick === 'cash' && styles.legacyChipActive,
                              legacyPaymentPick === 'cash' && payLt?.legacyChipActive,
                            ]}
                          >
                            <Ionicons
                              name="cash-outline"
                              size={22}
                              color={
                                legacyPaymentPick === 'cash'
                                  ? payUi.selectedIcon
                                  : payUi.accent
                              }
                            />
                            <PremiumText
                              variant="body"
                              style={[
                                styles.legacyChipText,
                                legacyPaymentPick === 'cash' && styles.legacyChipTextActive,
                                legacyPaymentPick === 'cash' && payLt?.legacyChipTextActive,
                              ]}
                            >
                              Katkı payı (nakit)
                            </PremiumText>
                          </GlassSurface>
                        </TouchableOpacity>
                        {showCardPaymentOption ? (
                          <TouchableOpacity
                            style={styles.legacyChipWrap}
                            onPress={() => setLegacyPaymentPick('card')}
                            activeOpacity={0.88}
                          >
                            <GlassSurface
                              variant="plain"
                              borderRadius={LDS_RADIUS.md}
                              style={[
                                styles.legacyChip,
                                payLt?.legacyChip,
                                legacyPaymentPick === 'card' && styles.legacyChipActive,
                                legacyPaymentPick === 'card' && payLt?.legacyChipActive,
                              ]}
                            >
                              <Ionicons
                                name="card-outline"
                                size={22}
                                color={
                                  legacyPaymentPick === 'card'
                                    ? payUi.selectedIcon
                                    : payUi.accent
                                }
                              />
                              <PremiumText
                                variant="body"
                                style={[
                                  styles.legacyChipText,
                                  legacyPaymentPick === 'card' && styles.legacyChipTextActive,
                                  legacyPaymentPick === 'card' && payLt?.legacyChipTextActive,
                                ]}
                              >
                                Kart (yakında)
                              </PremiumText>
                            </GlassSurface>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </>
                  )}
                </GlassSurface>
              </View>
            )}
          </ScrollView>

          {renderPaymentFooter()}

          <TouchableOpacity style={[styles.cancelBtn, payLt?.cancelBtn]} onPress={handleClose} activeOpacity={0.85}>
            <PremiumText variant="body" muted style={styles.cancelBtnText}>
              Vazgeç
            </PremiumText>
          </TouchableOpacity>
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
    maxHeight: '92%',
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
    width: LDS_SPACING.xxs + 2,
    height: LDS_SPACING.xxs + 2,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(34,211,238,0.92)',
  },
  guardianChipText: {
    fontWeight: '600',
    letterSpacing: 0.04,
    color: 'rgba(186, 230, 253, 0.92)',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 480,
  },
  scrollContent: {
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.md,
    paddingBottom: LDS_SPACING.xs,
  },
  choosePanel: {
    gap: LDS_SPACING.sm,
  },
  chooseQuestion: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: LDS_SPACING.xxs,
  },
  chooseOptionWrap: {
    width: '100%',
  },
  chooseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  chooseOptionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseOptionTextCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  chooseOptionTitle: {
    fontWeight: '700',
  },
  chooseOptionSubtitle: {
    lineHeight: 18,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrStage: {
    width: '100%',
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
  qrWrapper: {
    backgroundColor: 'white',
    padding: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: 'rgba(34,211,238,0.22)',
    ...LDS_ELEVATION.flat,
  },
  hint: {
    marginTop: LDS_SPACING.sm,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: LDS_SPACING.xs,
  },
  cameraContainer: {
    alignItems: 'center',
  },
  cameraStage: {
    width: '100%',
    overflow: 'hidden',
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.panel,
  },
  cameraStatusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    zIndex: 100,
  },
  processingText: {
    fontWeight: '600',
  },
  cameraWrapper: {
    width: width * 0.75,
    height: width * 0.75,
    alignSelf: 'center',
    borderRadius: LDS_RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#020617',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  permCenter: {
    paddingVertical: LDS_SPACING.xl,
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    width: '100%',
  },
  permLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionBtn: {
    alignSelf: 'stretch',
  },
  permissionBtnGlass: {
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  permissionBtnText: {
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  cancelBtn: {
    marginHorizontal: LDS_SPACING.lg,
    marginTop: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  paymentPanel: {
    width: '100%',
  },
  paymentCard: {
    padding: LDS_SPACING.lg,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.flat,
  },
  paymentIconWrap: {
    alignSelf: 'center',
    marginBottom: LDS_SPACING.xs,
  },
  paymentHeading: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: LDS_SPACING.xxs,
  },
  paymentBody: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: LDS_SPACING.sm,
  },
  paymentFooter: {
    paddingHorizontal: LDS_SPACING.lg,
    paddingTop: LDS_SPACING.sm,
    gap: LDS_SPACING.xs,
  },
  primaryPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
    marginTop: LDS_SPACING.xxs,
  },
  primaryPayBtnDisabled: {
    opacity: 0.55,
  },
  primaryPayText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  legacyPickLabel: {
    fontWeight: '600',
    marginBottom: LDS_SPACING.xs,
    textAlign: 'center',
    letterSpacing: 0.04,
  },
  legacyRow: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.sm,
  },
  legacyChipWrap: {
    flex: 1,
  },
  legacyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderColor: LDS_BORDER_COLOR.card,
    ...LDS_ELEVATION.chip,
  },
  legacyChipActive: {
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  legacyChipText: {
    fontWeight: '700',
    color: 'rgba(186, 201, 222, 0.82)',
  },
  legacyChipTextActive: {
    color: 'rgba(243, 248, 255, 0.94)',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    marginTop: LDS_SPACING.sm,
  },
  processingInlineText: {
    fontWeight: '600',
  },
  backScan: {
    marginTop: LDS_SPACING.md,
    alignItems: 'center',
    paddingVertical: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  backScanText: {
    fontWeight: '700',
    color: 'rgba(186, 230, 253, 0.92)',
  },
  scanSuccessTitle: {
    fontWeight: '700',
    marginTop: LDS_SPACING.xxs,
    textAlign: 'center',
  },
  remoteSuccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xxs,
    zIndex: 10,
  },
  remoteSuccessTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  remoteSuccessSubtitle: {
    textAlign: 'center',
  },
});
