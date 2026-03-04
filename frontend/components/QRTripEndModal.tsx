import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://trip-qr-scan.preview.emergentagent.com';

interface QRTripEndModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  tagId: string;
  isDriver: boolean;
  otherUserName: string;
  onComplete: (showRating: boolean, rateUserId: string, rateUserName: string) => void;
}

export default function QRTripEndModal({
  visible,
  onClose,
  userId,
  tagId,
  isDriver,
  otherUserName,
  onComplete,
}: QRTripEndModalProps) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrString, setQrString] = useState<string>('');
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [canProceed, setCanProceed] = useState<boolean | null>(null); // null = kontrol ediliyor
  const [proximityMessage, setProximityMessage] = useState('');
  const qrLoadedRef = useRef(false);

  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      // Sıfırla
      setCanProceed(null);
      setProximityMessage('');
      setScanned(false);
      qrLoadedRef.current = false;
      
      // ⚡ PARALEL: Hem QR'ı yükle hem konum kontrolü yap
      if (isDriver) {
        // ŞOFÖR: QR'ı hemen yükle + konum kontrolü paralel
        fetchMyQRCode();
        checkProximity();
      } else {
        // YOLCU: Kamera izni + konum kontrolü paralel
        if (!hasPermission?.granted) {
          requestPermission();
        }
        checkProximity();
      }
    }
  }, [visible]);

  const checkProximity = async () => {
    try {
      // Hızlı konum al
      const location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced // Daha hızlı
      });
      
      const { latitude, longitude } = location.coords;
      
      // Backend'e yakınlık kontrolü
      const response = await fetch(
        `${API_URL}/api/qr/check-proximity?user_id=${userId}&tag_id=${tagId}&latitude=${latitude}&longitude=${longitude}`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.can_end) {
        setCanProceed(true);
        setProximityMessage('');
      } else {
        setCanProceed(false);
        setProximityMessage(data.message || 'Bir araya gelmelisiniz!');
      }
    } catch (error) {
      console.error('Proximity error:', error);
      // Hata durumunda devam et
      setCanProceed(true);
    }
  };

  const fetchMyQRCode = async () => {
    if (qrLoadedRef.current) return;
    qrLoadedRef.current = true;
    
    try {
      const response = await fetch(`${API_URL}/api/qr/my-code?user_id=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setQrCode(data.qr_code);
        setQrString(data.qr_string);
      }
    } catch (error) {
      console.error('QR fetch error:', error);
      qrLoadedRef.current = false;
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || canProceed === false) return;
    setScanned(true);
    setLoading(true);

    try {
      // QR kod formatı: leylekpay://u?c=LYK-XXXX&i=user_id
      let scannedQRCode: string | null = null;

      if (data.startsWith('leylekpay://u?')) {
        const queryString = data.split('?')[1];
        const params = new URLSearchParams(queryString);
        scannedQRCode = params.get('c');
      } else if (data.startsWith('LYK-')) {
        scannedQRCode = data;
      }

      if (!scannedQRCode) {
        Alert.alert('Hata', 'Geçersiz QR kod');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Hızlı konum
      let latitude = 0, longitude = 0;
      try {
        const loc = await Location.getLastKnownPositionAsync();
        if (loc) {
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch {}

      // API'ye gönder
      const response = await fetch(
        `${API_URL}/api/qr/scan-trip-end?scanner_user_id=${userId}&scanned_qr_code=${scannedQRCode}&tag_id=${tagId}&latitude=${latitude}&longitude=${longitude}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (result.success) {
        onComplete(true, '', result.scanned_user_name || firstName);
        onClose();
      } else {
        Alert.alert('Hata', result.detail || 'QR doğrulanamadı');
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('Hata', 'Bağlantı hatası');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setScanned(false);
    setQrCode('');
    setQrString('');
    setCanProceed(null);
    qrLoadedRef.current = false;
    onClose();
  };

  // Konum kontrolü devam ediyor ve şoför QR'ı hazır
  const showDriverQR = isDriver && qrCode;
  const showPassengerCamera = !isDriver && hasPermission?.granted;
  const isCheckingProximity = canProceed === null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isDriver ? '📱 QR Kodunuz' : '📷 QR Tara'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Konum kontrolü - üstte küçük göster */}
            {isCheckingProximity && (
              <View style={styles.checkingBar}>
                <ActivityIndicator size="small" color="#3FA9F5" />
                <Text style={styles.checkingText}>Konum kontrol ediliyor...</Text>
              </View>
            )}

            {/* YAKIN DEĞİLLER - UYARI */}
            {canProceed === false ? (
              <View style={styles.warningContainer}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningTitle}>Bir Araya Gelmelisiniz!</Text>
                <Text style={styles.warningText}>{proximityMessage}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={checkProximity}>
                  <Text style={styles.retryBtnText}>Tekrar Kontrol Et</Text>
                </TouchableOpacity>
              </View>
            ) : isDriver ? (
              /* ŞOFÖR: QR Kodunu Göster - HEMEN */
              <View style={styles.qrContainer}>
                <Text style={styles.instruction}>
                  {firstName} bu kodu tarasın
                </Text>
                
                {qrCode ? (
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={qrString || qrCode}
                      size={width * 0.55}
                      backgroundColor="white"
                      color="#1a1a2e"
                    />
                    <Text style={styles.qrCodeText}>{qrCode}</Text>
                  </View>
                ) : (
                  <View style={styles.loadingQR}>
                    <ActivityIndicator size="large" color="#3FA9F5" />
                  </View>
                )}
              </View>
            ) : (
              /* YOLCU: Kamera ile QR Tara */
              <View style={styles.cameraContainer}>
                <Text style={styles.instruction}>
                  {firstName}'ın QR kodunu tarayın
                </Text>
                
                {hasPermission?.granted ? (
                  <View style={styles.cameraWrapper}>
                    {loading && (
                      <View style={styles.scanningOverlay}>
                        <ActivityIndicator size="large" color="white" />
                        <Text style={styles.scanningText}>Doğrulanıyor...</Text>
                      </View>
                    )}
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={scanned || canProceed === false ? undefined : handleBarCodeScanned}
                    />
                    <View style={styles.scanFrame}>
                      <View style={[styles.corner, styles.topLeft]} />
                      <View style={[styles.corner, styles.topRight]} />
                      <View style={[styles.corner, styles.bottomLeft]} />
                      <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Kamera İzni Ver</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Footer */}
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelBtnText}>İptal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: 'white',
  },
  content: {
    padding: 16,
    minHeight: 350,
  },
  checkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(63, 169, 245, 0.1)',
    borderRadius: 8,
  },
  checkingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#3FA9F5',
  },
  warningContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  warningIcon: {
    fontSize: 50,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 10,
  },
  warningText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  qrContainer: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  qrCodeText: {
    marginTop: 10,
    fontSize: 13,
    color: '#1a1a2e',
    fontWeight: '600',
    letterSpacing: 1,
  },
  loadingQR: {
    width: width * 0.55,
    height: width * 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  retryBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  retryBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  cameraContainer: {
    alignItems: 'center',
  },
  cameraWrapper: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scanningText: {
    marginTop: 12,
    color: 'white',
    fontSize: 16,
  },
  scanFrame: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
  },
  corner: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderColor: '#3FA9F5',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  permissionBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginTop: 16,
  },
  permissionBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
});
