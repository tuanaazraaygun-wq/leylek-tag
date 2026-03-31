import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Vibration,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';

const { width } = Dimensions.get('window');

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

  const qrValue = `leylektag://end?u=${userId}&t=${tagId}`;
  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      setPassengerStep('scan');
      setPendingDriverId(null);
      setLegacyPaymentPick(null);
      if (!isDriver && !hasPermission?.granted) {
        requestPermission();
      }
    }
  }, [visible, isDriver]);

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
          Alert.alert(
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
          Alert.alert('Hata', result.detail || `Yolculuk bitirilemedi (${response.status})`);
        }
      } catch (error) {
        console.error('QR complete error:', error);
        Alert.alert('Hata', 'Ağ hatası — internet ve API adresini kontrol edin');
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
      if (!data.startsWith('leylektag://end?')) {
        return;
      }

      setScanned(true);
      Vibration.vibrate(100);

      const params = new URLSearchParams(data.split('?')[1]);
      const driverUserId = params.get('u');
      const qrTagId = params.get('t');

      if (!driverUserId || !qrTagId) {
        Alert.alert('Hata', 'Geçersiz QR kod');
        setScanned(false);
        return;
      }

      if (qrTagId !== tagId) {
        Alert.alert('Hata', 'Bu QR kod bu yolculuğa ait değil');
        setScanned(false);
        return;
      }

      // Yolcu: QR doğru — ödeme onayı adımına geç
      setPendingDriverId(driverUserId);
      setPassengerStep('payment');
      setScanned(false);
    },
    [isDriver, scanned, processing, tagId],
  );

  const handlePassengerPaymentConfirm = (method: PaymentMethod) => {
    if (!pendingDriverId) {
      Alert.alert('Hata', 'Önce QR kodunu tarayın');
      return;
    }
    void submitCompleteQr(method, pendingDriverId);
  };

  const handleLegacyConfirm = () => {
    if (!legacyPaymentPick || !pendingDriverId) {
      Alert.alert('Seçim gerekli', 'Nakit veya kart ile ödemeyi tamamladığınızı seçin.');
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
          <LinearGradient colors={['#041e33', '#0c4a6e', '#0369a1']} style={styles.header}>
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
                  {firstName}'ın QR kodunu tarayın
                </Text>

                {processing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="white" />
                    <Text style={styles.processingText}>İşleniyor…</Text>
                  </View>
                )}

                {hasPermission?.granted ? (
                  <View style={styles.cameraWrapper}>
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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
                <LinearGradient
                  colors={['rgba(224,242,254,0.95)', 'rgba(255,255,255,0.98)']}
                  style={styles.paymentCard}
                >
                  <View style={styles.paymentIconWrap}>
                    <Ionicons name="wallet-outline" size={32} color="#0369a1" />
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
                      <LinearGradient colors={['#059669', '#047857']} style={styles.primaryPayGradient}>
                        <Ionicons name="cash-outline" size={24} color="#FFF" />
                        <Text style={styles.primaryPayText}>Nakit ödemeyi tamamladım</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {bookingPaymentMethod === 'card' && (
                    <TouchableOpacity
                      style={styles.primaryPayBtn}
                      onPress={() => handlePassengerPaymentConfirm('card')}
                      disabled={processing}
                      activeOpacity={0.88}
                    >
                      <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.primaryPayGradient}>
                        <Ionicons name="card-outline" size={24} color="#FFF" />
                        <Text style={styles.primaryPayText}>Kart ile ödemeyi tamamladım</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {!bookingPaymentMethod && (
                    <>
                      <Text style={styles.legacyPickLabel}>Nasıl ödediniz?</Text>
                      <View style={styles.legacyRow}>
                        <TouchableOpacity
                          style={[
                            styles.legacyChip,
                            legacyPaymentPick === 'cash' && styles.legacyChipActiveCash,
                          ]}
                          onPress={() => setLegacyPaymentPick('cash')}
                        >
                          <Ionicons
                            name="cash-outline"
                            size={22}
                            color={legacyPaymentPick === 'cash' ? '#FFF' : '#047857'}
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
                            legacyPaymentPick === 'card' && styles.legacyChipActiveCard,
                          ]}
                          onPress={() => setLegacyPaymentPick('card')}
                        >
                          <Ionicons
                            name="card-outline"
                            size={22}
                            color={legacyPaymentPick === 'card' ? '#FFF' : '#1D4ED8'}
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
                              ? ['#0EA5E9', '#0284c7']
                              : ['#94A3B8', '#64748B']
                          }
                          style={styles.primaryPayGradient}
                        >
                          <Text style={styles.primaryPayText}>Onayla ve yolculuğu bitir</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {processing ? (
                    <ActivityIndicator style={{ marginTop: 16 }} color="#0369a1" />
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
                </LinearGradient>
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
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '92%',
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
    color: 'white',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: 'white',
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
    color: '#E2E8F0',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    color: '#94A3B8',
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
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderRadius: 16,
  },
  processingText: {
    marginTop: 12,
    color: 'white',
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
    borderColor: '#38BDF8',
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
    backgroundColor: '#3FA9F5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: 'white',
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
    color: '#94A3B8',
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
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  paymentIconWrap: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  paymentHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  paymentBody: {
    fontSize: 14,
    color: '#475569',
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
  },
  primaryPayText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  legacyPickLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
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
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  legacyChipActiveCash: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  legacyChipActiveCard: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  legacyChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  legacyChipTextActive: {
    color: '#FFF',
  },
  backScan: {
    marginTop: 18,
    alignItems: 'center',
  },
  backScanText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '600',
  },
});
