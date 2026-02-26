/**
 * DriverKYCScreen.tsx - Sürücü KYC Kayıt Ekranı
 * Araç fotoğrafı ve ehliyet fotoğrafı ile sürücü kaydı
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

interface DriverKYCScreenProps {
  userId: string;
  userName: string;
  onBack: () => void;
  onSuccess: () => void;
  apiUrl: string;
}

export default function DriverKYCScreen({ userId, userName, onBack, onSuccess, apiUrl }: DriverKYCScreenProps) {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'vehicle' | 'license' | 'review'>('info');

  // Fotoğraf seç
  const pickImage = async (type: 'vehicle' | 'license') => {
    try {
      // İzin iste
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kamera izni gereklidir');
        return;
      }

      // Kamerayı aç
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (type === 'vehicle') {
          setVehiclePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
          setStep('license');
        } else {
          setLicensePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
          setStep('review');
        }
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilemedi');
    }
  };

  // Galeriden seç
  const pickFromGallery = async (type: 'vehicle' | 'license') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeri izni gereklidir');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (type === 'vehicle') {
          setVehiclePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
          setStep('license');
        } else {
          setLicensePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
          setStep('review');
        }
      }
    } catch (error) {
      console.error('Gallery pick error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi');
    }
  };

  // KYC gönder
  const submitKYC = async () => {
    if (!plateNumber.trim()) {
      Alert.alert('Hata', 'Plaka numarası giriniz');
      return;
    }
    if (!vehiclePhoto) {
      Alert.alert('Hata', 'Araç fotoğrafı gerekli');
      return;
    }
    if (!licensePhoto) {
      Alert.alert('Hata', 'Ehliyet fotoğrafı gerekli');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/driver/kyc/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          plate_number: plateNumber.toUpperCase(),
          vehicle_photo_base64: vehiclePhoto,
          license_photo_base64: licensePhoto,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          '✅ Başvuru Alındı',
          'Sürücü başvurunuz incelemeye alındı. Onaylandığında bildirim alacaksınız.',
          [{ text: 'Tamam', onPress: onSuccess }]
        );
      } else {
        Alert.alert('Bilgi', data.message || 'Başvuru gönderilemedi');
      }
    } catch (error) {
      console.error('KYC submit error:', error);
      Alert.alert('Hata', 'Başvuru gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Info Step
  const renderInfoStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name="car-sport" size={60} color="#3FA9F5" />
      </View>
      <Text style={styles.title}>Sürücü Kaydı</Text>
      <Text style={styles.subtitle}>
        Sürücü olarak kayıt olmak için aşağıdaki bilgileri ve belgeleri göndermeniz gerekmektedir.
      </Text>

      <View style={styles.requirementsList}>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={styles.requirementText}>Araç ön fotoğrafı (plaka görünür)</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={styles.requirementText}>Ehliyet fotoğrafı</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={styles.requirementText}>Plaka numarası</Text>
        </View>
      </View>

      <TextInput
        style={styles.plateInput}
        placeholder="Plaka Numarası (Örn: 34 ABC 123)"
        placeholderTextColor="#999"
        value={plateNumber}
        onChangeText={setPlateNumber}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={[styles.continueButton, !plateNumber.trim() && styles.buttonDisabled]}
        onPress={() => setStep('vehicle')}
        disabled={!plateNumber.trim()}
      >
        <Text style={styles.continueButtonText}>Devam Et</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  // Vehicle Photo Step
  const renderVehicleStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name="camera" size={60} color="#3FA9F5" />
      </View>
      <Text style={styles.title}>Araç Fotoğrafı</Text>
      <Text style={styles.subtitle}>
        Aracınızın önden çekilmiş fotoğrafını yükleyin. Plaka numarası net görünmelidir.
      </Text>

      {vehiclePhoto ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: vehiclePhoto }} style={styles.previewImage} />
          <TouchableOpacity style={styles.retakeButton} onPress={() => setVehiclePhoto(null)}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retakeText}>Tekrar Çek</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={() => pickImage('vehicle')}>
            <Ionicons name="camera" size={32} color="#3FA9F5" />
            <Text style={styles.photoButtonText}>Fotoğraf Çek</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={() => pickFromGallery('vehicle')}>
            <Ionicons name="images" size={32} color="#3FA9F5" />
            <Text style={styles.photoButtonText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      )}

      {vehiclePhoto && (
        <TouchableOpacity style={styles.continueButton} onPress={() => setStep('license')}>
          <Text style={styles.continueButtonText}>Devam Et</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  // License Photo Step
  const renderLicenseStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name="card" size={60} color="#3FA9F5" />
      </View>
      <Text style={styles.title}>Ehliyet Fotoğrafı</Text>
      <Text style={styles.subtitle}>
        Ehliyetinizin ön yüzünün net fotoğrafını yükleyin.
      </Text>

      {licensePhoto ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: licensePhoto }} style={styles.previewImage} />
          <TouchableOpacity style={styles.retakeButton} onPress={() => setLicensePhoto(null)}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retakeText}>Tekrar Çek</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={() => pickImage('license')}>
            <Ionicons name="camera" size={32} color="#3FA9F5" />
            <Text style={styles.photoButtonText}>Fotoğraf Çek</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={() => pickFromGallery('license')}>
            <Ionicons name="images" size={32} color="#3FA9F5" />
            <Text style={styles.photoButtonText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      )}

      {licensePhoto && (
        <TouchableOpacity style={styles.continueButton} onPress={() => setStep('review')}>
          <Text style={styles.continueButtonText}>Devam Et</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  // Review Step
  const renderReviewStep = () => (
    <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.stepContainer}>
        <Text style={styles.title}>Başvuru Özeti</Text>
        <Text style={styles.subtitle}>Bilgilerinizi kontrol edin ve başvurunuzu gönderin.</Text>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewLabel}>Plaka Numarası</Text>
          <Text style={styles.reviewValue}>{plateNumber.toUpperCase()}</Text>
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewLabel}>Araç Fotoğrafı</Text>
          {vehiclePhoto && <Image source={{ uri: vehiclePhoto }} style={styles.reviewImage} />}
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewLabel}>Ehliyet Fotoğrafı</Text>
          {licensePhoto && <Image source={{ uri: licensePhoto }} style={styles.reviewImage} />}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={submitKYC}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Başvuruyu Gönder</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#3FA9F5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sürücü Kaydı</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressDot, step === 'info' && styles.progressDotActive]} />
        <View style={styles.progressLine} />
        <View style={[styles.progressDot, step === 'vehicle' && styles.progressDotActive]} />
        <View style={styles.progressLine} />
        <View style={[styles.progressDot, step === 'license' && styles.progressDotActive]} />
        <View style={styles.progressLine} />
        <View style={[styles.progressDot, step === 'review' && styles.progressDotActive]} />
      </View>

      {/* Content */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {step === 'info' && renderInfoStep()}
        {step === 'vehicle' && renderVehicleStep()}
        {step === 'license' && renderLicenseStep()}
        {step === 'review' && renderReviewStep()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1B1E',
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFF',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#3FA9F5',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1B1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  requirementsList: {
    width: '100%',
    marginBottom: 24,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  requirementText: {
    fontSize: 15,
    color: '#1B1B1E',
    flex: 1,
  },
  plateInput: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3FA9F5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3FA9F5',
    marginTop: 8,
  },
  photoPreview: {
    width: '100%',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  retakeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  reviewScroll: {
    flex: 1,
  },
  reviewCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  reviewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1B1E',
  },
  reviewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
