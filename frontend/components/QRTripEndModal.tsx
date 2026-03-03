import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, Camera } from 'expo-camera';
import * as Location from 'expo-location';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
  : 'https://trip-qr-scan.preview.emergentagent.com/api';

interface QRTripEndModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  tagId: string;
  isDriver: boolean;
  otherUserName: string;
  onComplete: () => void;
}

type ModalStep = 'select' | 'show_qr' | 'scan_qr' | 'rating' | 'success';

export default function QRTripEndModal({
  visible,
  onClose,
  userId,
  tagId,
  isDriver,
  otherUserName,
  onComplete,
}: QRTripEndModalProps) {
  const [step, setStep] = useState<ModalStep>('select');
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [rating, setRating] = useState(5);
  const [completedTagId, setCompletedTagId] = useState<string | null>(null);

  // QR kod oluştur
  const generateQR = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/qr/generate?user_id=${userId}&tag_id=${tagId}`);
      const data = await response.json();
      
      if (data.success) {
        setQrData(data.qr_string);
        setStep('show_qr');
      } else {
        Alert.alert('Hata', data.detail || 'QR kod oluşturulamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'QR kod oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  // Kamera izni iste
  const requestCameraPermission = async () => {
    setLoading(true);
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status === 'granted') {
        setStep('scan_qr');
      } else {
        Alert.alert('İzin Gerekli', 'QR kod taramak için kamera izni gerekli');
      }
    } catch (error) {
      Alert.alert('Hata', 'Kamera izni alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // QR kod tarandığında
  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    try {
      // QR verilerini parse et (leylektag://verify?user_id=...&tag_id=...&timestamp=...&hash=...)
      // Custom scheme URL parsing - new URL() doesn't work with custom schemes
      let scannedUserId: string | null = null;
      let scannedTagId: string | null = null;
      let timestamp: string | null = null;
      let hash: string | null = null;

      // leylektag:// scheme kontrolü
      if (data.startsWith('leylektag://verify?')) {
        const queryString = data.split('?')[1];
        const params = new URLSearchParams(queryString);
        scannedUserId = params.get('user_id');
        scannedTagId = params.get('tag_id');
        timestamp = params.get('timestamp');
        hash = params.get('hash');
      } else {
        // Fallback: try standard URL parsing for http/https
        try {
          const url = new URL(data);
          scannedUserId = url.searchParams.get('user_id');
          scannedTagId = url.searchParams.get('tag_id');
          timestamp = url.searchParams.get('timestamp');
          hash = url.searchParams.get('hash');
        } catch (e) {
          console.log('URL parse failed:', e);
        }
      }

      if (!scannedUserId || !scannedTagId || !timestamp || !hash) {
        Alert.alert('Hata', 'Geçersiz QR kod formatı');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Konum al
      let latitude = null;
      let longitude = null;
      try {
        const location = await Location.getCurrentPositionAsync({});
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      } catch (e) {
        console.log('Konum alınamadı');
      }

      // Backend'e doğrulama isteği
      const response = await fetch(
        `${API_URL}/qr/verify?scanner_user_id=${userId}&tag_id=${scannedTagId}&scanned_user_id=${scannedUserId}&timestamp=${timestamp}&hash=${hash}&latitude=${latitude || ''}&longitude=${longitude || ''}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (result.success) {
        setCompletedTagId(scannedTagId);
        setStep('rating');
      } else {
        Alert.alert('Hata', result.detail || 'QR doğrulanamadı');
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('Hata', 'QR kod işlenemedi');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  // Puanlama gönder
  const submitRating = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/qr/rate?tag_id=${completedTagId || tagId}&rater_user_id=${userId}&rating=${rating}`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (data.success) {
        setStep('success');
        setTimeout(() => {
          onComplete();
          onClose();
          resetModal();
        }, 2000);
      } else {
        Alert.alert('Hata', data.detail || 'Puanlama gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Puanlama gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  // Modal'ı sıfırla
  const resetModal = () => {
    setStep('select');
    setQrData('');
    setScanned(false);
    setRating(5);
    setCompletedTagId(null);
  };

  // Modal kapatıldığında sıfırla
  useEffect(() => {
    if (!visible) {
      resetModal();
    }
  }, [visible]);

  const themeColor = isDriver ? '#F97316' : '#3B82F6';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Başlık */}
          <LinearGradient
            colors={isDriver ? ['#F97316', '#EA580C'] : ['#3B82F6', '#2563EB']}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>🏁 Yol Paylaşımını Bitir</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>

          {/* İçerik */}
          <View style={styles.content}>
            {/* ADIM 1: Seçim */}
            {step === 'select' && (
              <View style={styles.selectContainer}>
                <Text style={styles.selectTitle}>
                  {otherUserName} ile yolculuğu bitirmek için:
                </Text>
                
                <View style={styles.optionsRow}>
                  {/* QR Okut */}
                  <TouchableOpacity
                    style={[styles.optionCard, { borderColor: themeColor }]}
                    onPress={generateQR}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#FEF3C7', '#FDE68A']}
                      style={styles.optionIconBg}
                    >
                      <Ionicons name="qr-code" size={40} color="#F59E0B" />
                    </LinearGradient>
                    <Text style={styles.optionTitle}>QR OKUT</Text>
                    <Text style={styles.optionDesc}>Kendi QR kodunu göster</Text>
                  </TouchableOpacity>

                  {/* QR Oku */}
                  <TouchableOpacity
                    style={[styles.optionCard, { borderColor: themeColor }]}
                    onPress={requestCameraPermission}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#DBEAFE', '#BFDBFE']}
                      style={styles.optionIconBg}
                    >
                      <Ionicons name="camera" size={40} color="#3B82F6" />
                    </LinearGradient>
                    <Text style={styles.optionTitle}>QR OKU</Text>
                    <Text style={styles.optionDesc}>Karşı tarafın QR'ını tara</Text>
                  </TouchableOpacity>
                </View>

                {loading && (
                  <ActivityIndicator size="large" color={themeColor} style={{ marginTop: 20 }} />
                )}
              </View>
            )}

            {/* ADIM 2: QR Göster */}
            {step === 'show_qr' && (
              <View style={styles.qrShowContainer}>
                <Text style={styles.qrShowTitle}>📱 QR Kodunuz</Text>
                <Text style={styles.qrShowDesc}>
                  {otherUserName} bu kodu tarasın
                </Text>
                
                <View style={styles.qrCodeWrapper}>
                  {qrData ? (
                    <QRCode
                      value={qrData}
                      size={200}
                      color="#1F2937"
                      backgroundColor="#FFFFFF"
                    />
                  ) : (
                    <ActivityIndicator size="large" color={themeColor} />
                  )}
                </View>

                <Text style={styles.qrExpiry}>⏱️ 5 dakika geçerli</Text>

                <TouchableOpacity
                  style={[styles.backButton, { backgroundColor: themeColor }]}
                  onPress={() => setStep('select')}
                >
                  <Ionicons name="arrow-back" size={20} color="#FFF" />
                  <Text style={styles.backButtonText}>Geri</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ADIM 3: QR Tara */}
            {step === 'scan_qr' && (
              <View style={styles.scanContainer}>
                <Text style={styles.scanTitle}>📷 QR Kod Tara</Text>
                <Text style={styles.scanDesc}>
                  {otherUserName}'ın QR kodunu çerçeveye alın
                </Text>

                {Platform.OS !== 'web' ? (
                  <View style={styles.scannerWrapper}>
                    <CameraView
                      onBarcodeScanned={scanned ? undefined : (result) => handleBarCodeScanned({ type: 'qr', data: result.data })}
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      style={styles.scanner}
                    />
                    <View style={styles.scanFrame}>
                      <View style={[styles.scanCorner, styles.topLeft]} />
                      <View style={[styles.scanCorner, styles.topRight]} />
                      <View style={[styles.scanCorner, styles.bottomLeft]} />
                      <View style={[styles.scanCorner, styles.bottomRight]} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.webFallback}>
                    <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.webFallbackText}>
                      Kamera tarama mobil cihazda çalışır
                    </Text>
                  </View>
                )}

                {loading && (
                  <View style={styles.scanLoading}>
                    <ActivityIndicator size="large" color="#FFF" />
                    <Text style={styles.scanLoadingText}>Doğrulanıyor...</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.backButton, { backgroundColor: themeColor }]}
                  onPress={() => {
                    setScanned(false);
                    setStep('select');
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color="#FFF" />
                  <Text style={styles.backButtonText}>Geri</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ADIM 4: Puanlama */}
            {step === 'rating' && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingTitle}>⭐ {otherUserName}'ı Puanla</Text>
                
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={48}
                        color="#F59E0B"
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.ratingValue}>{rating} Yıldız</Text>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: themeColor }]}
                  onPress={submitRating}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                      <Text style={styles.submitButtonText}>Tamamla +3 🎉</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ADIM 5: Başarılı */}
            {step === 'success' && (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
                </View>
                <Text style={styles.successTitle}>🎉 Yolculuk Tamamlandı!</Text>
                <Text style={styles.successDesc}>+3 Puan Kazandınız</Text>
                <Text style={styles.successRating}>
                  {otherUserName}'a {rating} ⭐ verdiniz
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  content: {
    padding: 20,
  },

  // Select Step
  selectContainer: {
    alignItems: 'center',
  },
  selectTitle: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  optionCard: {
    flex: 1,
    marginHorizontal: 8,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  optionIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  // QR Show Step
  qrShowContainer: {
    alignItems: 'center',
  },
  qrShowTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  qrShowDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  qrExpiry: {
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },

  // Scan Step
  scanContainer: {
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  scanDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  scannerWrapper: {
    width: 280,
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  scanner: {
    width: '100%',
    height: '100%',
  },
  scanFrame: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#22C55E',
    borderWidth: 4,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLoadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  webFallback: {
    width: 280,
    height: 280,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFallbackText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Rating Step
  ratingContainer: {
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 24,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },

  // Success Step
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  successRating: {
    fontSize: 16,
    color: '#6B7280',
  },
});
