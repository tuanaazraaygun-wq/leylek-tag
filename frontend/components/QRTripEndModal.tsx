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
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://ride-completion.preview.emergentagent.com';

// Mesafe hesaplama (metre)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface QRTripEndModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  tagId: string;
  isDriver: boolean;
  otherUserName: string;
  // Konum bilgileri (HIZLI kontrol için)
  myLatitude?: number;
  myLongitude?: number;
  otherLatitude?: number;
  otherLongitude?: number;
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
  onComplete,
}: QRTripEndModalProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [qrString, setQrString] = useState<string>('');
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [proximityOk, setProximityOk] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const qrLoadedRef = useRef(false);

  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      // Reset
      setScanned(false);
      setProcessing(false);
      setProximityOk(null);
      qrLoadedRef.current = false;
      
      // ⚡ HIZLI: Frontend'de konum kontrolü (Backend'e gitmiyor!)
      checkProximityLocal();
      
      // ⚡ PARALEL: QR'ı hemen yükle
      if (isDriver) {
        fetchMyQRCode();
      } else if (!hasPermission?.granted) {
        requestPermission();
      }
    }
  }, [visible]);

  // ⚡ SÜPER HIZLI - Frontend'de konum kontrolü
  const checkProximityLocal = () => {
    if (myLatitude && myLongitude && otherLatitude && otherLongitude) {
      const dist = calculateDistance(myLatitude, myLongitude, otherLatitude, otherLongitude);
      setDistance(Math.round(dist));
      setProximityOk(dist <= 1000); // 1 KM
    } else {
      // Konum yoksa izin ver
      setProximityOk(true);
      setDistance(0);
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

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || processing || proximityOk === false) return;
    setScanned(true);
    setProcessing(true);

    try {
      // QR kod parse
      let scannedQRCode: string | null = null;
      if (data.startsWith('leylekpay://u?')) {
        const params = new URLSearchParams(data.split('?')[1]);
        scannedQRCode = params.get('c');
      } else if (data.startsWith('LYK-')) {
        scannedQRCode = data;
      }

      if (!scannedQRCode) {
        Alert.alert('Hata', 'Geçersiz QR kod');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Hızlı konum
      let lat = myLatitude || 0, lng = myLongitude || 0;
      if (!lat || !lng) {
        try {
          const loc = await Location.getLastKnownPositionAsync();
          if (loc) { lat = loc.coords.latitude; lng = loc.coords.longitude; }
        } catch {}
      }

      // ⚡ API çağrısı
      const response = await fetch(
        `${API_URL}/api/qr/scan-trip-end?scanner_user_id=${userId}&scanned_qr_code=${scannedQRCode}&tag_id=${tagId}&latitude=${lat}&longitude=${lng}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (result.success) {
        // ✅ Başarılı - Puanlama modalı AÇ
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
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setScanned(false);
    setQrCode('');
    setQrString('');
    setProximityOk(null);
    qrLoadedRef.current = false;
    onClose();
  };

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

          {/* Konum durumu - küçük bar */}
          {proximityOk !== null && (
            <View style={[styles.proximityBar, proximityOk ? styles.proximityOk : styles.proximityFail]}>
              <Text style={styles.proximityText}>
                {proximityOk 
                  ? `✓ Yakınlık doğrulandı ${distance > 0 ? `(${distance}m)` : ''}`
                  : `⚠ Mesafe: ${distance > 1000 ? (distance/1000).toFixed(1) + 'km' : distance + 'm'}`
                }
              </Text>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {proximityOk === false ? (
              /* YAKIN DEĞİLLER */
              <View style={styles.warningContainer}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningTitle}>Bir Araya Gelmelisiniz!</Text>
                <Text style={styles.warningText}>
                  Yol paylaşımını bitirmek için {firstName} ile aynı konumda olmalısınız.
                </Text>
                <TouchableOpacity style={styles.retryBtn} onPress={checkProximityLocal}>
                  <Text style={styles.retryBtnText}>Tekrar Kontrol Et</Text>
                </TouchableOpacity>
              </View>
            ) : isDriver ? (
              /* ŞOFÖR: QR Göster */
              <View style={styles.qrContainer}>
                <Text style={styles.instruction}>{firstName} bu kodu tarasın</Text>
                {qrCode ? (
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={qrString || qrCode}
                      size={width * 0.5}
                      backgroundColor="white"
                      color="#1a1a2e"
                    />
                    <Text style={styles.qrCodeText}>{qrCode}</Text>
                  </View>
                ) : (
                  <View style={styles.loadingQR}>
                    <ActivityIndicator size="large" color="#3FA9F5" />
                    <Text style={styles.loadingText}>QR yükleniyor...</Text>
                  </View>
                )}
              </View>
            ) : (
              /* YOLCU: Kamera */
              <View style={styles.cameraContainer}>
                <Text style={styles.instruction}>{firstName}'ın QR kodunu tarayın</Text>
                {processing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="white" />
                    <Text style={styles.processingText}>Doğrulanıyor...</Text>
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
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
  proximityBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  proximityOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  proximityFail: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  proximityText: {
    color: 'white',
    fontSize: 13,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    minHeight: 300,
  },
  warningContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  warningIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  qrContainer: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    color: 'white',
    marginBottom: 16,
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
    width: width * 0.5,
    height: width * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 12,
    paddingHorizontal: 24,
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
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderRadius: 12,
  },
  processingText: {
    marginTop: 12,
    color: 'white',
    fontSize: 16,
  },
  cameraWrapper: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
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
    width: 24,
    height: 24,
    borderColor: '#3FA9F5',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  permissionBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
});
