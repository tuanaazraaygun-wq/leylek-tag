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
} from 'react-native';
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

const { width } = Dimensions.get('window');

/** Çift decode burst — retry’i kilitlemez */
const TRIP_END_SCAN_BURST_DEDUPE_MS = 120;

type PaymentMethod = 'cash' | 'card';

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
  /** Yolcu: eşleşmede IBAN snapshot varsa bitiş ekranında seçenek göster */
  showIbanOption?: boolean;
  onChooseDriverIban?: () => void;
  onComplete: (showRating: boolean, rateUserId: string, rateUserName: string) => void;
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
  showIbanOption = false,
  onChooseDriverIban,
  onComplete,
}: QRTripEndModalProps) {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  /** iOS: kamera cold-start — BoardingScanModal ile aynı session/remount pattern */
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  /** Yolcu: bitirme yolu seçimi / QR / ödeme onayı */
  const [passengerStep, setPassengerStep] = useState<'choose' | 'scan' | 'payment'>('scan');
  const [pendingDriverId, setPendingDriverId] = useState<string | null>(null);
  const [legacyPaymentPick, setLegacyPaymentPick] = useState<PaymentMethod | null>(null);
  const lastScannedValueRef = useRef<{ data: string; ts: number }>({ data: '', ts: 0 });

  const qrValue = `leylektag://end?u=${userId}&t=${tagId}`;
  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      setPassengerStep(!isDriver && showIbanOption ? 'choose' : 'scan');
      setPendingDriverId(null);
      setLegacyPaymentPick(null);
      lastScannedValueRef.current = { data: '', ts: 0 };
    }
  }, [visible, isDriver, showIbanOption]);

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
    !isDriver &&
    passengerStep === 'scan' &&
    cameraReady &&
    !scanned &&
    !processing;

  const submitCompleteQr = useCallback(
    async (paymentConfirmed: PaymentMethod, driverUserId: string) => {
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
        let result: { success?: boolean; detail?: string; driver_name?: string } = {};
        try {
          result = raw ? JSON.parse(raw) : {};
        } catch {
          console.error('QR complete-qr non-JSON:', raw.slice(0, 200));
          appAlert(
            'Hata',
            response.ok ? 'Sunucu yanıtı okunamadı' : `Sunucu hatası (${response.status})`,
          );
          return;
        }

        if (result.success) {
          Vibration.vibrate([0, 100, 50, 100]);
          onComplete(true, driverUserId, result.driver_name || firstName);
          onClose();
        } else {
          appAlert('Hata', result.detail || `Yolculuk bitirilemedi (${response.status})`);
        }
      } catch (error) {
        console.error('QR complete error:', error);
        appAlert('Hata', 'Ağ hatası — internet ve API adresini kontrol edin');
      } finally {
        setProcessing(false);
      }
    },
    [tagId, userId, myLatitude, myLongitude, onComplete, onClose, firstName],
  );

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (isDriver) return;
      if (!cameraReady || scanned || processing) return;
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
      Vibration.vibrate(100);

      const params = new URLSearchParams(raw.split('?')[1]);
      const driverUserId = params.get('u');
      const qrTagId = params.get('t');

      if (!driverUserId || !qrTagId) {
        appAlert('Hata', 'Geçersiz QR kod');
        lastScannedValueRef.current = { data: '', ts: 0 };
        setScanned(false);
        return;
      }

      if (qrTagId !== tagId) {
        appAlert('Hata', 'Bu QR kod bu yolculuğa ait değil');
        lastScannedValueRef.current = { data: '', ts: 0 };
        setScanned(false);
        return;
      }

      // Yolcu: QR doğru — ödeme onayı adımına geç
      lastScannedValueRef.current = { data: '', ts: 0 };
      setPendingDriverId(driverUserId);
      setPassengerStep('payment');
      setScanned(false);
    },
    [isDriver, cameraReady, scanned, processing, tagId],
  );

  const handlePassengerPaymentConfirm = (method: PaymentMethod) => {
    if (!pendingDriverId) {
      appAlert('Hata', 'Önce QR kodunu tarayın');
      return;
    }
    void submitCompleteQr(method, pendingDriverId);
  };

  const handleLegacyConfirm = () => {
    if (!legacyPaymentPick || !pendingDriverId) {
      appAlert('Seçim gerekli', 'Nakit veya kart ile ödemeyi tamamladığınızı seçin.');
      return;
    }
    void submitCompleteQr(legacyPaymentPick, pendingDriverId);
  };

  const handleClose = () => {
    setScanned(false);
    setProcessing(false);
    setCameraReady(false);
    setPassengerStep(!isDriver && showIbanOption ? 'choose' : 'scan');
    setPendingDriverId(null);
    setLegacyPaymentPick(null);
    lastScannedValueRef.current = { data: '', ts: 0 };
    onClose();
  };

  const paymentTitle =
    bookingPaymentMethod === 'cash'
      ? 'Nakit ödeme'
      : bookingPaymentMethod === 'card'
        ? 'Kart'
        : 'Ödeme onayı';

  const paymentSubtitle =
    bookingPaymentMethod === 'cash'
      ? 'Teklifinizde nakit seçmiştiniz. Ücreti nakit olarak ödediğinizi onaylayın.'
      : bookingPaymentMethod === 'card'
        ? 'Teklifinizde kart seçmiştiniz. Ödemeyi kart ile tamamladığınızı onaylayın.'
        : 'Bu yolculuk için teklifte ödeme tercihi kayıtlı değil. Nasıl ödediğinizi seçin.';

  const phaseStep = isDriver
    ? 'Yolculuk sonu QR'
    : passengerStep === 'choose'
      ? 'Yolculuk sonu'
      : passengerStep === 'payment'
        ? 'Ödeme onayı'
        : 'QR doğrulaması';

  const phaseCaption = isDriver
    ? `${firstName} bu kodu tarasın`
    : passengerStep === 'choose'
      ? 'Yolculuğu güvenli şekilde tamamlamak için yöntemi seç.'
      : passengerStep === 'payment'
        ? 'Ödeme bilgisini kontrol ederek tamamla.'
        : 'Sürücünün yolculuk sonu QR kodunu okut.';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <CockpitBackground showGrid={false} />
        <View style={styles.scrim} pointerEvents="none" />

        <GlassSurface variant="panel" style={styles.container} borderRadius={LDS_RADIUS.xl}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <PremiumText variant="step" style={styles.phaseStep}>
                {phaseStep}
              </PremiumText>
              <PremiumText variant="caption" muted style={styles.phaseCaption}>
                {phaseCaption}
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

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {isDriver ? (
              <View style={styles.qrContainer}>
                <GlassSurface variant="stage" style={styles.qrStage} borderRadius={LDS_RADIUS.lg}>
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={qrValue}
                      size={width * 0.55}
                      backgroundColor="white"
                      color="#041e33"
                      quietZone={10}
                    />
                  </View>
                  <PremiumText variant="caption" muted style={styles.hint}>
                    Yolcu QR kodu taradığında yolculuk tamamlanır
                  </PremiumText>
                </GlassSurface>
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
                  accessibilityLabel="Sürücü IBAN'ını gör"
                >
                  <GlassSurface variant="plain" style={styles.chooseOption} borderRadius={LDS_RADIUS.md}>
                    <View style={styles.chooseOptionIconWrap}>
                      <Ionicons name="card-outline" size={24} color="rgba(34,211,238,0.92)" />
                    </View>
                    <View style={styles.chooseOptionTextCol}>
                      <PremiumText variant="body" style={styles.chooseOptionTitle}>
                        Sürücü IBAN'ını gör
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.chooseOptionSubtitle}>
                        Havale/EFT ile ödediyseniz
                      </PremiumText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(186,201,222,0.72)" />
                  </GlassSurface>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chooseOptionWrap}
                  onPress={() => setPassengerStep('scan')}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Sürücü QR kodunu tara"
                >
                  <GlassSurface variant="plain" style={styles.chooseOption} borderRadius={LDS_RADIUS.md}>
                    <View style={styles.chooseOptionIconWrap}>
                      <Ionicons name="qr-code-outline" size={24} color="rgba(34,211,238,0.92)" />
                    </View>
                    <View style={styles.chooseOptionTextCol}>
                      <PremiumText variant="body" style={styles.chooseOptionTitle}>
                        Sürücü QR kodunu tara
                      </PremiumText>
                      <PremiumText variant="caption" muted style={styles.chooseOptionSubtitle}>
                        Nakit ödeme onayı
                      </PremiumText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(186,201,222,0.72)" />
                  </GlassSurface>
                </TouchableOpacity>
              </View>
            ) : passengerStep === 'scan' ? (
              <View style={styles.cameraContainer}>
                <PremiumText variant="body" style={styles.instruction}>
                  {`${firstName}'ın QR kodunu tarayın`}
                </PremiumText>

                {hasPermission?.granted ? (
                  <GlassSurface variant="stage" style={styles.cameraStage} borderRadius={LDS_RADIUS.lg}>
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
                          <ActivityIndicator size="large" color="#22D3EE" />
                          <PremiumText variant="caption" muted style={styles.processingText}>
                            Kamera hazırlanıyor…
                          </PremiumText>
                        </View>
                      ) : null}
                      {processing ? (
                        <View style={styles.cameraStatusOverlay}>
                          <ActivityIndicator size="large" color="#22D3EE" />
                          <PremiumText variant="caption" muted style={styles.processingText}>
                            İşleniyor…
                          </PremiumText>
                        </View>
                      ) : null}
                    </View>
                  </GlassSurface>
                ) : (
                  <View style={styles.permCenter}>
                    <PremiumText variant="body" muted style={styles.permLabel}>
                      Kamera izni gerekli
                    </PremiumText>
                    <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.88}>
                      <PremiumText variant="body" style={styles.permissionBtnText}>
                        Kamera İzni Ver
                      </PremiumText>
                    </TouchableOpacity>
                  </View>
                )}

                <PremiumText variant="caption" muted style={styles.hint}>
                  Ardından ödeme yönteminizi onaylayacaksınız
                </PremiumText>
              </View>
            ) : (
              <View style={styles.paymentPanel}>
                <GlassSurface variant="plain" style={styles.paymentCard} borderRadius={LDS_RADIUS.lg}>
                  <View style={styles.paymentIconWrap}>
                    <Ionicons name="wallet-outline" size={32} color="rgba(34,211,238,0.92)" />
                  </View>
                  <PremiumText variant="body" style={styles.paymentHeading}>
                    {paymentTitle}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.paymentBody}>
                    {paymentSubtitle}
                  </PremiumText>

                  {bookingPaymentMethod === 'cash' && (
                    <TouchableOpacity
                      style={styles.primaryPayBtn}
                      onPress={() => handlePassengerPaymentConfirm('cash')}
                      disabled={processing}
                      activeOpacity={0.88}
                    >
                      <Ionicons name="cash-outline" size={24} color="rgba(34,211,238,0.92)" />
                      <PremiumText variant="body" style={styles.primaryPayText}>
                        Nakit ödemeyi tamamladım
                      </PremiumText>
                    </TouchableOpacity>
                  )}

                  {bookingPaymentMethod === 'card' && (
                    <TouchableOpacity
                      style={styles.primaryPayBtn}
                      onPress={() => handlePassengerPaymentConfirm('card')}
                      disabled={processing}
                      activeOpacity={0.88}
                    >
                      <Ionicons name="card-outline" size={24} color="rgba(34,211,238,0.92)" />
                      <PremiumText variant="body" style={styles.primaryPayText}>
                        Kart ile ödemeyi tamamladım
                      </PremiumText>
                    </TouchableOpacity>
                  )}

                  {!bookingPaymentMethod && (
                    <>
                      <PremiumText variant="caption" muted style={styles.legacyPickLabel}>
                        Nasıl ödediniz?
                      </PremiumText>
                      <View style={styles.legacyRow}>
                        <TouchableOpacity
                          style={[
                            styles.legacyChip,
                            legacyPaymentPick === 'cash' && styles.legacyChipActive,
                          ]}
                          onPress={() => setLegacyPaymentPick('cash')}
                          activeOpacity={0.88}
                        >
                          <Ionicons
                            name="cash-outline"
                            size={22}
                            color={
                              legacyPaymentPick === 'cash'
                                ? 'rgba(243,248,255,0.94)'
                                : 'rgba(34,211,238,0.92)'
                            }
                          />
                          <PremiumText
                            variant="body"
                            style={[
                              styles.legacyChipText,
                              legacyPaymentPick === 'cash' && styles.legacyChipTextActive,
                            ]}
                          >
                            Nakit
                          </PremiumText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.legacyChip,
                            legacyPaymentPick === 'card' && styles.legacyChipActive,
                          ]}
                          onPress={() => setLegacyPaymentPick('card')}
                          activeOpacity={0.88}
                        >
                          <Ionicons
                            name="card-outline"
                            size={22}
                            color={
                              legacyPaymentPick === 'card'
                                ? 'rgba(243,248,255,0.94)'
                                : 'rgba(34,211,238,0.92)'
                            }
                          />
                          <PremiumText
                            variant="body"
                            style={[
                              styles.legacyChipText,
                              legacyPaymentPick === 'card' && styles.legacyChipTextActive,
                            ]}
                          >
                            Kart
                          </PremiumText>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.primaryPayBtn,
                          (!legacyPaymentPick || processing) && styles.primaryPayBtnDisabled,
                        ]}
                        onPress={handleLegacyConfirm}
                        disabled={processing || !legacyPaymentPick}
                        activeOpacity={0.88}
                      >
                        <PremiumText variant="body" style={styles.primaryPayText}>
                          Onayla ve yolculuğu bitir
                        </PremiumText>
                      </TouchableOpacity>
                    </>
                  )}

                  {processing ? (
                    <View style={styles.processingRow}>
                      <ActivityIndicator size="small" color="#22D3EE" />
                      <PremiumText variant="caption" muted style={styles.processingInlineText}>
                        Tamamlanıyor…
                      </PremiumText>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.backScan}
                    onPress={() => {
                      setPassengerStep('scan');
                      setPendingDriverId(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <PremiumText variant="caption" style={styles.backScanText}>
                      ← QR taramaya dön
                    </PremiumText>
                  </TouchableOpacity>
                </GlassSurface>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.85}>
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
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
  scroll: {
    maxHeight: 520,
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
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.sm,
    ...LDS_ELEVATION.panel,
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: LDS_SPACING.md,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  instruction: {
    marginBottom: LDS_SPACING.sm,
    textAlign: 'center',
    fontWeight: '600',
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
    ...LDS_ELEVATION.panel,
  },
  cameraStatusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 17, 31, 0.82)',
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
    width: 28,
    height: 28,
    borderColor: 'rgba(34, 211, 238, 0.72)',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: LDS_RADIUS.sm,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: LDS_RADIUS.sm,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: LDS_RADIUS.sm,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
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
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.lg,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
    ...LDS_ELEVATION.cta,
  },
  permissionBtnText: {
    fontWeight: '800',
    letterSpacing: 0.2,
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
    marginBottom: LDS_SPACING.md,
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
    fontWeight: '700',
    marginBottom: LDS_SPACING.xs,
    textAlign: 'center',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  legacyRow: {
    flexDirection: 'row',
    gap: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.sm,
  },
  legacyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
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
});
