import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tag-dispatch.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

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
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Kişiye özel QR - ANINDA hazır
  const qrValue = `leylektag://end?u=${userId}&t=${tagId}`;
  const firstName = otherUserName?.split(' ')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
      
      // Yolcu ise kamera izni iste
      if (!isDriver && !hasPermission?.granted) {
        requestPermission();
      }
    }
  }, [visible]);

  const handleBarCodeScanned = useCallback(async ({ data }: { type: string; data: string }) => {
    if (scanned || processing) return;
    
    // QR formatını kontrol et
    if (!data.startsWith('leylektag://end?')) {
      return; // Sessizce geç, yanlış QR
    }
    
    setScanned(true);
    setProcessing(true);
    Vibration.vibrate(100); // Titreşim feedback

    try {
      // QR'dan bilgileri çıkar
      const params = new URLSearchParams(data.split('?')[1]);
      const driverUserId = params.get('u');
      const qrTagId = params.get('t');
      
      if (!driverUserId || !qrTagId) {
        Alert.alert('Hata', 'Geçersiz QR kod');
        setScanned(false);
        setProcessing(false);
        return;
      }
      
      // Tag ID eşleşmeli
      if (qrTagId !== tagId) {
        Alert.alert('Hata', 'Bu QR kod bu yolculuğa ait değil');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Backend'e doğrulama isteği
      const response = await fetch(`${API_URL}/trip/complete-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: tagId,
          scanner_user_id: userId,
          scanned_user_id: driverUserId,
          latitude: myLatitude || 0,
          longitude: myLongitude || 0,
        }),
      });
      
      const result = await response.json();

      if (result.success) {
        // Başarılı - Puanlama modalını aç
        Vibration.vibrate([0, 100, 50, 100]); // Başarı titreşimi
        onComplete(true, driverUserId, result.driver_name || firstName);
        onClose();
      } else {
        Alert.alert('Hata', result.detail || 'Yolculuk bitirilemedi');
        setScanned(false);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  }, [scanned, processing, tagId, userId, myLatitude, myLongitude, onComplete, onClose, firstName]);

  const handleClose = () => {
    setScanned(false);
    setProcessing(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.header}
          >
            <Text style={styles.title}>
              {isDriver ? 'QR Kodunuz' : 'QR Tarayın'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {isDriver ? (
              /* ŞOFÖR: QR Göster - ANINDA */
              <View style={styles.qrContainer}>
                <Text style={styles.instruction}>
                  {firstName} bu kodu tarasın
                </Text>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={qrValue}
                    size={width * 0.55}
                    backgroundColor="white"
                    color="#1a1a2e"
                    quietZone={10}
                  />
                </View>
                <Text style={styles.hint}>
                  Yolcu QR kodu taradığında yolculuk otomatik bitecek
                </Text>
              </View>
            ) : (
              /* YOLCU: Kamera */
              <View style={styles.cameraContainer}>
                <Text style={styles.instruction}>
                  {firstName}'ın QR kodunu tarayın
                </Text>
                
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
                    {/* Tarama çerçevesi */}
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
                  Sürücünün telefonundaki QR kodu tarayın
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
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
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: '85%',
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
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    minHeight: 350,
  },
  qrContainer: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 17,
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
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
    borderColor: '#3FA9F5',
  },
  topLeft: { 
    top: 0, 
    left: 0, 
    borderTopWidth: 4, 
    borderLeftWidth: 4, 
    borderTopLeftRadius: 8 
  },
  topRight: { 
    top: 0, 
    right: 0, 
    borderTopWidth: 4, 
    borderRightWidth: 4, 
    borderTopRightRadius: 8 
  },
  bottomLeft: { 
    bottom: 0, 
    left: 0, 
    borderBottomWidth: 4, 
    borderLeftWidth: 4, 
    borderBottomLeftRadius: 8 
  },
  bottomRight: { 
    bottom: 0, 
    right: 0, 
    borderBottomWidth: 4, 
    borderRightWidth: 4, 
    borderBottomRightRadius: 8 
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
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '500',
  },
});
