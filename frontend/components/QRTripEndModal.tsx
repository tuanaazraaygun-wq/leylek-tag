import React, { useState, useEffect } from 'react';
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

  // Sadece ilk ismi al
  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      if (isDriver) {
        // ŞOFÖR: QR kodunu getir
        fetchMyQRCode();
      } else {
        // YOLCU: Kamera izni iste
        if (!hasPermission?.granted) {
          requestPermission();
        }
      }
    }
  }, [visible, isDriver]);

  const fetchMyQRCode = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/qr/my-code?user_id=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setQrCode(data.qr_code);
        setQrString(data.qr_string);
      } else {
        Alert.alert('Hata', data.detail || 'QR kod alınamadı');
      }
    } catch (error) {
      console.error('QR fetch error:', error);
      Alert.alert('Hata', 'QR kod alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    try {
      // QR kod formatı: leylekpay://user?code=LEYLEK-XXXX&id=user_id
      let scannedQRCode: string | null = null;

      if (data.startsWith('leylekpay://user?')) {
        const queryString = data.split('?')[1];
        const params = new URLSearchParams(queryString);
        scannedQRCode = params.get('code');
      } else if (data.startsWith('LEYLEK-')) {
        // Direkt QR kod
        scannedQRCode = data;
      }

      if (!scannedQRCode) {
        Alert.alert('Hata', 'Geçersiz QR kod formatı');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Konum al
      let latitude = null;
      let longitude = null;
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      } catch (e) {
        console.log('Konum alınamadı:', e);
      }

      // API'ye gönder
      const response = await fetch(
        `${API_URL}/api/qr/scan-trip-end?scanner_user_id=${userId}&scanned_qr_code=${scannedQRCode}&tag_id=${tagId}&latitude=${latitude || 0}&longitude=${longitude || 0}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (result.success) {
        // Başarılı! Puanlama modalını aç
        onComplete(true, '', result.scanned_user_name || firstName);
        onClose();
      } else {
        Alert.alert('Hata', result.detail || 'QR doğrulanamadı');
        setScanned(false);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert('Hata', 'QR doğrulanırken hata oluştu');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setScanned(false);
    setQrCode('');
    setQrString('');
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

          {/* Content */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3FA9F5" />
                <Text style={styles.loadingText}>
                  {isDriver ? 'QR kodunuz yükleniyor...' : 'Doğrulanıyor...'}
                </Text>
              </View>
            ) : isDriver ? (
              /* ŞOFÖR: QR Kodunu Göster */
              <View style={styles.qrContainer}>
                <Text style={styles.instruction}>
                  {firstName} bu kodu tarasın
                </Text>
                
                {qrCode ? (
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={qrString || qrCode}
                      size={width * 0.6}
                      backgroundColor="white"
                      color="#1a1a2e"
                    />
                    <Text style={styles.qrCodeText}>{qrCode}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.retryBtn} onPress={fetchMyQRCode}>
                    <Text style={styles.retryBtnText}>QR Kodu Yükle</Text>
                  </TouchableOpacity>
                )}
                
                <Text style={styles.note}>
                  Bu sizin kişisel QR kodunuz. Ödeme almak için de kullanabilirsiniz.
                </Text>
              </View>
            ) : (
              /* YOLCU: Kamera ile QR Tara */
              <View style={styles.cameraContainer}>
                <Text style={styles.instruction}>
                  {firstName}'ın QR kodunu tarayın
                </Text>
                
                {hasPermission?.granted ? (
                  <View style={styles.cameraWrapper}>
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
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
                
                {scanned && (
                  <TouchableOpacity 
                    style={styles.rescanBtn} 
                    onPress={() => setScanned(false)}
                  >
                    <Text style={styles.rescanBtnText}>Tekrar Tara</Text>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: 'white',
  },
  content: {
    padding: 20,
    minHeight: 400,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  qrContainer: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 18,
    color: 'white',
    marginBottom: 24,
    textAlign: 'center',
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  qrCodeText: {
    marginTop: 12,
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '600',
    letterSpacing: 1,
  },
  note: {
    marginTop: 20,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    alignItems: 'center',
  },
  cameraWrapper: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 16,
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
    width: 30,
    height: 30,
    borderColor: '#3FA9F5',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  permissionBtn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
  },
  permissionBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rescanBtn: {
    backgroundColor: 'rgba(63, 169, 245, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  rescanBtnText: {
    color: '#3FA9F5',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
});
