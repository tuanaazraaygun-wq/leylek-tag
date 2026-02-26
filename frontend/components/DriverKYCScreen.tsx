/**
 * DriverKYCScreen.tsx - Sürücü KYC Kayıt Ekranı
 * Araç fotoğrafı, ehliyet fotoğrafı, marka ve model ile sürücü kaydı
 */

import React, { useState, useMemo } from 'react';
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
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

// Cross-platform alert fonksiyonu
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, onOk ? [{ text: 'Tamam', onPress: onOk }] : undefined);
  }
};

// Türkiye'de popüler araç markaları ve modelleri
const CAR_BRANDS: { [key: string]: string[] } = {
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT', 'RS3', 'RS6'],
  'BMW': ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '6 Serisi', '7 Serisi', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4', 'i3', 'i4', 'iX'],
  'Citroen': ['C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C5', 'C5 Aircross', 'Berlingo', 'Jumpy'],
  'Dacia': ['Sandero', 'Logan', 'Duster', 'Jogger', 'Spring'],
  'Fiat': ['Egea', 'Egea Cross', '500', '500X', 'Panda', 'Tipo', 'Doblo', 'Fiorino', 'Linea'],
  'Ford': ['Fiesta', 'Focus', 'Mondeo', 'Puma', 'Kuga', 'EcoSport', 'Mustang', 'Ranger', 'Transit', 'Transit Connect', 'Transit Courier'],
  'Honda': ['Civic', 'Accord', 'Jazz', 'HR-V', 'CR-V', 'City'],
  'Hyundai': ['i10', 'i20', 'i30', 'Elantra', 'Tucson', 'Kona', 'Santa Fe', 'Bayon', 'IONIQ 5', 'IONIQ 6'],
  'Kia': ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Sorento', 'Stonic', 'Niro', 'EV6', 'Stinger'],
  'Mercedes-Benz': ['A Serisi', 'B Serisi', 'C Serisi', 'E Serisi', 'S Serisi', 'CLA', 'CLS', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'AMG GT', 'EQA', 'EQB', 'EQC', 'EQS'],
  'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Leaf', 'Navara'],
  'Opel': ['Corsa', 'Astra', 'Insignia', 'Crossland', 'Grandland', 'Mokka', 'Combo'],
  'Peugeot': ['208', '308', '408', '508', '2008', '3008', '5008', 'Rifter', 'Partner', 'Expert'],
  'Renault': ['Clio', 'Megane', 'Talisman', 'Captur', 'Kadjar', 'Koleos', 'Kangoo', 'Zoe', 'Arkana', 'Austral'],
  'Seat': ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  'Skoda': ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq', 'Enyaq'],
  'Toyota': ['Yaris', 'Yaris Cross', 'Corolla', 'Camry', 'C-HR', 'RAV4', 'Land Cruiser', 'Hilux', 'Proace', 'Aygo X', 'bZ4X'],
  'Volkswagen': ['Polo', 'Golf', 'Passat', 'Arteon', 'T-Cross', 'T-Roc', 'Tiguan', 'Touareg', 'ID.3', 'ID.4', 'ID.5', 'Caddy', 'Transporter'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90', 'C40'],
  'Diğer': ['Belirtilmemiş'],
};

interface DriverKYCScreenProps {
  userId: string;
  userName: string;
  onBack: () => void;
  onSuccess: () => void;
  apiUrl: string;
}

export default function DriverKYCScreen({ userId, userName, onBack, onSuccess, apiUrl }: DriverKYCScreenProps) {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'brand' | 'vehicle' | 'license' | 'review'>('info');
  
  // Marka arama
  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  // Filtrelenmiş markalar
  const filteredBrands = useMemo(() => {
    const brands = Object.keys(CAR_BRANDS).sort();
    if (!brandSearch) return brands;
    return brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brandSearch]);

  // Seçili markanın modelleri
  const availableModels = useMemo(() => {
    return CAR_BRANDS[vehicleBrand] || [];
  }, [vehicleBrand]);

  // Renkler
  const colors = ['Beyaz', 'Siyah', 'Gri', 'Gümüş', 'Kırmızı', 'Mavi', 'Lacivert', 'Yeşil', 'Sarı', 'Turuncu', 'Kahverengi', 'Bej'];

  // Fotoğraf seç
  const pickImage = async (type: 'vehicle' | 'license') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kamera izni gereklidir');
        return;
      }

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
    if (!vehicleBrand) {
      Alert.alert('Hata', 'Araç markası seçiniz');
      return;
    }
    if (!vehicleModel) {
      Alert.alert('Hata', 'Araç modeli seçiniz');
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
          vehicle_brand: vehicleBrand,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear || null,
          vehicle_color: vehicleColor || null,
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
          <Text style={styles.requirementText}>Plaka numarası</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={styles.requirementText}>Araç marka ve modeli</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={styles.requirementText}>Araç ön fotoğrafı (plaka görünür)</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
          <Text style={styles.requirementText}>Ehliyet fotoğrafı</Text>
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
        onPress={() => setStep('brand')}
        disabled={!plateNumber.trim()}
      >
        <Text style={styles.continueButtonText}>Devam Et</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  // Brand/Model Step
  const renderBrandStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name="speedometer" size={60} color="#3FA9F5" />
      </View>
      <Text style={styles.title}>Araç Bilgileri</Text>
      <Text style={styles.subtitle}>Aracınızın marka, model ve rengini seçin.</Text>

      {/* Marka Seçimi */}
      <TouchableOpacity style={styles.selectButton} onPress={() => setShowBrandModal(true)}>
        <Ionicons name="car" size={24} color={vehicleBrand ? '#3FA9F5' : '#999'} />
        <Text style={[styles.selectButtonText, vehicleBrand && styles.selectButtonTextActive]}>
          {vehicleBrand || 'Marka Seçin'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#999" />
      </TouchableOpacity>

      {/* Model Seçimi */}
      <TouchableOpacity 
        style={[styles.selectButton, !vehicleBrand && styles.selectButtonDisabled]} 
        onPress={() => vehicleBrand && setShowModelModal(true)}
        disabled={!vehicleBrand}
      >
        <Ionicons name="construct" size={24} color={vehicleModel ? '#3FA9F5' : '#999'} />
        <Text style={[styles.selectButtonText, vehicleModel && styles.selectButtonTextActive]}>
          {vehicleModel || 'Model Seçin'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#999" />
      </TouchableOpacity>

      {/* Yıl */}
      <TextInput
        style={styles.textInput}
        placeholder="Araç Yılı (Örn: 2020)"
        placeholderTextColor="#999"
        value={vehicleYear}
        onChangeText={setVehicleYear}
        keyboardType="numeric"
        maxLength={4}
      />

      {/* Renk Seçimi */}
      <Text style={styles.colorLabel}>Araç Rengi</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
        {colors.map(color => (
          <TouchableOpacity
            key={color}
            style={[styles.colorChip, vehicleColor === color && styles.colorChipActive]}
            onPress={() => setVehicleColor(color)}
          >
            <Text style={[styles.colorChipText, vehicleColor === color && styles.colorChipTextActive]}>
              {color}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.continueButton, (!vehicleBrand || !vehicleModel) && styles.buttonDisabled]}
        onPress={() => setStep('vehicle')}
        disabled={!vehicleBrand || !vehicleModel}
      >
        <Text style={styles.continueButtonText}>Devam Et</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </TouchableOpacity>

      {/* Marka Modal */}
      <Modal visible={showBrandModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Marka Seçin</Text>
            <TouchableOpacity onPress={() => setShowBrandModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Marka ara..."
              placeholderTextColor="#999"
              value={brandSearch}
              onChangeText={setBrandSearch}
              autoFocus
            />
            {brandSearch ? (
              <TouchableOpacity onPress={() => setBrandSearch('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filteredBrands}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.brandItem, vehicleBrand === item && styles.brandItemActive]}
                onPress={() => {
                  setVehicleBrand(item);
                  setVehicleModel('');
                  setShowBrandModal(false);
                  setBrandSearch('');
                }}
              >
                <Text style={[styles.brandItemText, vehicleBrand === item && styles.brandItemTextActive]}>
                  {item}
                </Text>
                {vehicleBrand === item && <Ionicons name="checkmark" size={22} color="#3FA9F5" />}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.brandList}
          />
        </SafeAreaView>
      </Modal>

      {/* Model Modal */}
      <Modal visible={showModelModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{vehicleBrand} - Model Seçin</Text>
            <TouchableOpacity onPress={() => setShowModelModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={availableModels}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.brandItem, vehicleModel === item && styles.brandItemActive]}
                onPress={() => {
                  setVehicleModel(item);
                  setShowModelModal(false);
                }}
              >
                <Text style={[styles.brandItemText, vehicleModel === item && styles.brandItemTextActive]}>
                  {item}
                </Text>
                {vehicleModel === item && <Ionicons name="checkmark" size={22} color="#3FA9F5" />}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.brandList}
          />
        </SafeAreaView>
      </Modal>
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
          <Text style={styles.reviewLabel}>Araç</Text>
          <Text style={styles.reviewValue}>{vehicleBrand} {vehicleModel}</Text>
          {vehicleYear && <Text style={styles.reviewSubValue}>{vehicleYear} Model</Text>}
          {vehicleColor && <Text style={styles.reviewSubValue}>Renk: {vehicleColor}</Text>}
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
        <View style={[styles.progressDot, step === 'brand' && styles.progressDotActive]} />
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
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {step === 'info' && renderInfoStep()}
          {step === 'brand' && renderBrandStep()}
          {step === 'vehicle' && renderVehicleStep()}
          {step === 'license' && renderLicenseStep()}
          {step === 'review' && renderReviewStep()}
        </ScrollView>
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
    width: 30,
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
  textInput: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 16,
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
    marginTop: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Select buttons
  selectButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    gap: 12,
  },
  selectButtonDisabled: {
    opacity: 0.5,
  },
  selectButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  selectButtonTextActive: {
    color: '#1B1B1E',
    fontWeight: '600',
  },
  // Color picker
  colorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  colorScroll: {
    marginBottom: 24,
  },
  colorChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginRight: 10,
  },
  colorChipActive: {
    backgroundColor: '#3FA9F5',
    borderColor: '#3FA9F5',
  },
  colorChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  colorChipTextActive: {
    color: '#FFF',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1B1E',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  brandList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  brandItemActive: {
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#3FA9F5',
  },
  brandItemText: {
    fontSize: 16,
    color: '#1B1B1E',
  },
  brandItemTextActive: {
    fontWeight: '600',
    color: '#3FA9F5',
  },
  // Photo
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
  // Review
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
  reviewSubValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
