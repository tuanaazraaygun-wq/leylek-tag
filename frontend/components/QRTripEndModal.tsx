import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
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
import { LinearGradient } from 'expo-linear-gradient';
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
  onComplete,
}: QRTripEndModalProps) {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  /** Yolcu: QR doğru okunduktan sonra ödeme onayı adımı */
  const [passengerStep, setPassengerStep] = useState<'scan' | 'payment'>('scan');
  const [pendingDriverId, setPendingDriverId] = useState<string | null>(null);
  const [legacyPaymentPick, setLegacyPaymentPick] = useState<PaymentMethod | null>(null);
  const lastScannedValueRef = useRef<{ data: string; ts: number }>({ data: '', ts: 0 });

  const qrValue = `leylektag://end?u=${userId}&t=${tagId}`;
  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      setPassengerStep('scan');
      setPendingDriverId(null);
      setLegacyPaymentPick(null);
      lastScannedValueRef.current = { data: '', ts: 0 };
      if (!isDriver && !hasPermission?.granted) {
        requestPermission();
      }
    }
  }, [visible, isDriver, hasPermission?.granted, requestPermission]);

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
      if (scanned || processing) return;
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
    [isDriver, scanned, processing, tagId],
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
    setPassengerStep('scan');
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={['#08111F', '#0B1220', '#101A2B']} style={styles.header}>
            <Text style={styles.title}>
              {isDriver
                ? 'QR Kodunuz'
                : passengerStep === 'payment'
                  ? 'Yolculuk sonu — ödeme'
                  : 'QR Tarayın'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {isDriver ? (
              <View style={styles.qrContainer}>
                <Text style={styles.instruction}>
                  {firstName} bu kodu tarasın
                </Text>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={qrValue}
                    size={width * 0.55}
                    backgroundColor="white"
                    color="#041e33"
                    quietZone={10}
                  />
                </View>
                <Text style={styles.hint}>
                  Yolcu QR kodu taradığında yolculuk tamamlanır
                </Text>
              </View>
            ) : passengerStep === 'scan' ? (
              <View style={styles.cameraContainer}>
                <Text style={styles.instruction}>
                  {`${firstName}'ın QR kodunu tarayın`}
                </Text>

                {processing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="#22D3EE" />
                    <Text style={styles.processingText}>İşleniyor…</Text>
                  </View>
                )}

                {hasPermission?.granted ? (
                  <View style={styles.cameraWrapper}>
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onCameraReady={() => {
                        if (__DEV__) {
                          console.log('[QRTripEndModal] onCameraReady');
                        }
                      }}
                      onBarcodeScanned={
                        passengerStep === 'scan' && !scanned && !processing
                          ? handleBarCodeScanned
                          : undefined
                      }
                    />
                    <View style={styles.scanOverlay}>
                      <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Kamera İzni Ver</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.hint}>
                  Ardından ödeme yönteminizi onaylayacaksınız
                </Text>
              </View>
            ) : (
              <View style={styles.paymentPanel}>
                <View style={styles.paymentCard}>
                  <View style={styles.paymentIconWrap}>
                    <Ionicons name="wallet-outline" size={32} color="#22D3EE" />
                  </View>
                  <Text style={styles.paymentHeading}>{paymentTitle}</Text>
                  <Text style={styles.paymentBody}>{paymentSubtitle}</Text>

                  {bookingPaymentMethod === 'cash' && (
                    <TouchableOpacity
                      style={styles.primaryPayBtn}
                      onPress={() => handlePassengerPaymentConfirm('cash')}
                      disabled={processing}
                      activeOpacity={0.88}
                    >
                      <View style={[styles.primaryPayGradient, styles.primaryPayGlass]}>
                        <Ionicons name="cash-outline" size={24} color="#22D3EE" />
                        <Text style={styles.primaryPayText}>Nakit ödemeyi tamamladım</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {bookingPaymentMethod === 'card' && (
                    <TouchableOpacity
                      style={styles.primaryPayBtn}
                      onPress={() => handlePassengerPaymentConfirm('card')}
                      disabled={processing}
                      activeOpacity={0.88}
                    >
                      <View style={[styles.primaryPayGradient, styles.primaryPayGlass]}>
                        <Ionicons name="card-outline" size={24} color="#22D3EE" />
                        <Text style={styles.primaryPayText}>Kart ile ödemeyi tamamladım</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {!bookingPaymentMethod && (
                    <>
                      <Text style={styles.legacyPickLabel}>Nasıl ödediniz?</Text>
                      <View style={styles.legacyRow}>
                        <TouchableOpacity
                          style={[
                            styles.legacyChip,
                            legacyPaymentPick === 'cash' && styles.legacyChipActive,
                          ]}
                          onPress={() => setLegacyPaymentPick('cash')}
                        >
                          <Ionicons
                            name="cash-outline"
                            size={22}
                            color={
                              legacyPaymentPick === 'cash'
                                ? 'rgba(243,248,255,0.94)'
                                : '#22D3EE'
                            }
                          />
                          <Text
                            style={[
                              styles.legacyChipText,
                              legacyPaymentPick === 'cash' && styles.legacyChipTextActive,
                            ]}
                          >
                            Nakit
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.legacyChip,
                            legacyPaymentPick === 'card' && styles.legacyChipActive,
                          ]}
                          onPress={() => setLegacyPaymentPick('card')}
                        >
                          <Ionicons
                            name="card-outline"
                            size={22}
                            color={
                              legacyPaymentPick === 'card'
                                ? 'rgba(243,248,255,0.94)'
                                : '#22D3EE'
                            }
                          />
                          <Text
                            style={[
                              styles.legacyChipText,
                              legacyPaymentPick === 'card' && styles.legacyChipTextActive,
                            ]}
                          >
                            Kart
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.primaryPayBtn}
                        onPress={handleLegacyConfirm}
                        disabled={processing || !legacyPaymentPick}
                        activeOpacity={0.88}
                      >
                        <LinearGradient
                          colors={
                            legacyPaymentPick
                              ? ['rgba(8,36,52,0.95)', '#0E7490', '#22D3EE']
                              : ['rgba(30,58,95,0.45)', 'rgba(16,26,43,0.88)']
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.primaryPayGradient,
                            legacyPaymentPick && styles.primaryPayGradientAccentBorder,
                          ]}
                        >
                          <Text style={styles.primaryPayText}>Onayla ve yolculuğu bitir</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {processing ? (
                    <ActivityIndicator style={{ marginTop: 16 }} color="#22D3EE" />
                  ) : null}

                  <TouchableOpacity
                    style={styles.backScan}
                    onPress={() => {
                      setPassengerStep('scan');
                      setPendingDriverId(null);
                    }}
                  >
                    <Text style={styles.backScanText}>← QR taramaya dön</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#08111F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: 'rgba(243, 248, 255, 0.94)',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(30,58,95,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: 'rgba(186,201,222,0.88)',
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  qrContainer: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 17,
    color: 'rgba(243, 248, 255, 0.94)',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(186, 201, 222, 0.82)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cameraContainer: {
    alignItems: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 60,
    backgroundColor: 'rgba(8, 17, 31, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderRadius: 16,
  },
  processingText: {
    marginTop: 12,
    color: 'rgba(186,201,222,0.88)',
    fontSize: 16,
    fontWeight: '500',
  },
  cameraWrapper: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
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
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  permissionBtn: {
    backgroundColor: 'rgba(16, 26, 43, 0.95)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  permissionBtnText: {
    color: '#22D3EE',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: 'rgba(186, 201, 222, 0.82)',
    fontSize: 16,
    fontWeight: '500',
  },
  paymentPanel: {
    width: '100%',
  },
  paymentCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: 'rgba(16, 26, 43, 0.92)',
  },
  paymentIconWrap: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  paymentHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(243, 248, 255, 0.96)',
    textAlign: 'center',
    marginBottom: 8,
  },
  paymentBody: {
    fontSize: 14,
    color: 'rgba(186, 201, 222, 0.82)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  primaryPayBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  primaryPayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primaryPayGlass: {
    backgroundColor: 'rgba(16, 26, 43, 0.92)',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.24)',
  },
  primaryPayGradientAccentBorder: {
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  primaryPayText: {
    color: 'rgba(243, 248, 255, 0.94)',
    fontSize: 16,
    fontWeight: '700',
  },
  legacyPickLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(243, 248, 255, 0.9)',
    marginBottom: 10,
    textAlign: 'center',
  },
  legacyRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  legacyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 17, 31, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.65)',
  },
  legacyChipActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: 'rgba(34, 211, 238, 0.48)',
    borderTopColor: 'rgba(34, 211, 238, 0.35)',
  },
  legacyChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(186, 201, 222, 0.82)',
  },
  legacyChipTextActive: {
    color: 'rgba(243, 248, 255, 0.94)',
  },
  backScan: {
    marginTop: 18,
    alignItems: 'center',
  },
  backScanText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
  },
});
