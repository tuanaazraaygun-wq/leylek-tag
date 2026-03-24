/**
 * DriverKYCScreen.tsx - Sürücü KYC Kayıt Ekranı
 * Web, Android ve iOS için tam uyumlu
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

// Türkiye'de popüler araç markaları ve modelleri
const CAR_BRANDS: { [key: string]: string[] } = {
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT'],
  'BMW': ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '7 Serisi', 'X1', 'X3', 'X5', 'X7'],
  'Citroen': ['C1', 'C3', 'C4', 'C5', 'Berlingo'],
  'Dacia': ['Sandero', 'Logan', 'Duster', 'Jogger', 'Spring'],
  'Fiat': ['Egea', 'Egea Cross', '500', '500X', 'Panda', 'Tipo', 'Doblo', 'Linea'],
  'Ford': ['Fiesta', 'Focus', 'Mondeo', 'Puma', 'Kuga', 'EcoSport', 'Mustang', 'Ranger', 'Transit'],
  'Honda': ['Civic', 'Accord', 'Jazz', 'HR-V', 'CR-V', 'City'],
  'Hyundai': ['i10', 'i20', 'i30', 'Elantra', 'Tucson', 'Kona', 'Santa Fe', 'Bayon'],
  'Kia': ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Sorento', 'Stonic', 'Niro'],
  'Mercedes-Benz': ['A Serisi', 'B Serisi', 'C Serisi', 'E Serisi', 'S Serisi', 'CLA', 'GLA', 'GLC', 'GLE'],
  'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Leaf'],
  'Opel': ['Corsa', 'Astra', 'Insignia', 'Crossland', 'Grandland', 'Mokka'],
  'Peugeot': ['208', '308', '408', '508', '2008', '3008', '5008'],
  'Renault': ['Clio', 'Megane', 'Talisman', 'Captur', 'Kadjar', 'Koleos', 'Kangoo', 'Arkana'],
  'Seat': ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  'Skoda': ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq'],
  'Toyota': ['Yaris', 'Yaris Cross', 'Corolla', 'Camry', 'C-HR', 'RAV4', 'Land Cruiser', 'Hilux'],
  'Volkswagen': ['Polo', 'Golf', 'Passat', 'Arteon', 'T-Cross', 'T-Roc', 'Tiguan', 'Touareg'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90'],
  'Diğer': ['Belirtilmemiş'],
};

// Araç Renkleri
const CAR_COLORS = [
  { name: 'Beyaz', code: '#FFFFFF', border: '#CCCCCC' },
  { name: 'Siyah', code: '#1A1A1A', border: '#1A1A1A' },
  { name: 'Gri', code: '#808080', border: '#808080' },
  { name: 'Gümüş', code: '#C0C0C0', border: '#A0A0A0' },
  { name: 'Kırmızı', code: '#DC2626', border: '#DC2626' },
  { name: 'Bordo', code: '#7F1D1D', border: '#7F1D1D' },
  { name: 'Mavi', code: '#2563EB', border: '#2563EB' },
  { name: 'Lacivert', code: '#1E3A5F', border: '#1E3A5F' },
  { name: 'Yeşil', code: '#16A34A', border: '#16A34A' },
  { name: 'Sarı', code: '#EAB308', border: '#CA8A04' },
  { name: 'Turuncu', code: '#EA580C', border: '#EA580C' },
  { name: 'Kahverengi', code: '#78350F', border: '#78350F' },
  { name: 'Bej', code: '#D4C4A8', border: '#B8A888' },
  { name: 'Mor', code: '#7C3AED', border: '#7C3AED' },
  { name: 'Pembe', code: '#EC4899', border: '#EC4899' },
];

interface DriverKYCScreenProps {
  userId: string;
  userName: string;
  onBack: () => void;
  onSuccess: () => void;
  apiUrl: string;
  /** Rol ekranından: araç veya motor KYC akışı (ayrılmış) */
  vehicleKind?: 'car' | 'motorcycle';
}

type PhotoPickKind = 'vehicle' | 'license' | 'motorcycle' | 'selfie';

export default function DriverKYCScreen({
  userId,
  userName,
  onBack,
  onSuccess,
  apiUrl,
  vehicleKind = 'car',
}: DriverKYCScreenProps) {
  const isMotorKyc = vehicleKind === 'motorcycle';
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [motorcyclePhoto, setMotorcyclePhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  
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

  // Web'de dosya seçimi
  const handleWebFileSelect = (type: PhotoPickKind) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        // Dosya boyutunu kontrol et
        if (file.size > 5 * 1024 * 1024) {
          alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          console.log(`${type} photo loaded, size: ${Math.round(base64.length / 1024)} KB`);
          if (type === 'vehicle') setVehiclePhoto(base64);
          else if (type === 'license') setLicensePhoto(base64);
          else if (type === 'motorcycle') setMotorcyclePhoto(base64);
          else if (type === 'selfie') setSelfiePhoto(base64);
        };
        reader.onerror = () => {
          alert('Dosya okunamadı');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Mobile'da fotoğraf çek veya seç
  const pickImageMobile = async (type: PhotoPickKind, source: 'camera' | 'gallery') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Kamera izni gereklidir');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Galeri izni gereklidir');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0].base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (type === 'vehicle') setVehiclePhoto(base64Data);
        else if (type === 'license') setLicensePhoto(base64Data);
        else if (type === 'motorcycle') setMotorcyclePhoto(base64Data);
        else if (type === 'selfie') setSelfiePhoto(base64Data);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilemedi');
    }
  };

  // Validasyon kontrolü
  const isFormValid = () => {
    if (isMotorKyc) {
      return (
        vehicleBrand.trim() &&
        vehicleModel.trim() &&
        licensePhoto &&
        motorcyclePhoto &&
        selfiePhoto
      );
    }
    return plateNumber.trim() && vehicleBrand && vehicleModel && vehiclePhoto && licensePhoto;
  };

  // KYC gönder
  const submitKYC = async () => {
    console.log('========== KYC SUBMIT BAŞLADI ==========');

    if (isMotorKyc) {
      if (!vehicleBrand.trim()) {
        Platform.OS === 'web' ? alert('Motor markası girin') : Alert.alert('Hata', 'Motor markası girin');
        return;
      }
      if (!vehicleModel.trim()) {
        Platform.OS === 'web' ? alert('Motor modeli girin') : Alert.alert('Hata', 'Motor modeli girin');
        return;
      }
      if (!licensePhoto) {
        Platform.OS === 'web' ? alert('Ehliyet fotoğrafı gerekli') : Alert.alert('Hata', 'Ehliyet fotoğrafı gerekli');
        return;
      }
      if (!motorcyclePhoto) {
        Platform.OS === 'web' ? alert('Motor fotoğrafı gerekli') : Alert.alert('Hata', 'Motor fotoğrafı gerekli');
        return;
      }
      if (!selfiePhoto) {
        Platform.OS === 'web' ? alert('Selfie (yüz) gerekli') : Alert.alert('Hata', 'Selfie (yüz) gerekli');
        return;
      }
    } else {
      if (!plateNumber.trim()) {
        if (Platform.OS === 'web') {
          alert('Lütfen plaka numarası girin');
        } else {
          Alert.alert('Hata', 'Lütfen plaka numarası girin');
        }
        return;
      }
      if (!vehicleBrand) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç markası seçin');
        } else {
          Alert.alert('Hata', 'Lütfen araç markası seçin');
        }
        return;
      }
      if (!vehicleModel) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç modeli seçin');
        } else {
          Alert.alert('Hata', 'Lütfen araç modeli seçin');
        }
        return;
      }
      if (!vehiclePhoto) {
        if (Platform.OS === 'web') {
          alert('Lütfen araç fotoğrafı yükleyin');
        } else {
          Alert.alert('Hata', 'Lütfen araç fotoğrafı yükleyin');
        }
        return;
      }
      if (!licensePhoto) {
        if (Platform.OS === 'web') {
          alert('Lütfen ehliyet fotoğrafı yükleyin');
        } else {
          Alert.alert('Hata', 'Lütfen ehliyet fotoğrafı yükleyin');
        }
        return;
      }
    }

    setLoading(true);
    setSubmitStatus('Başvuru gönderiliyor...');

    try {
      const submitUrl = `${apiUrl}/driver/kyc/submit`;
      console.log('Submit URL:', submitUrl);
      console.log('User ID:', userId);
      console.log('Vehicle Photo Size:', Math.round((vehiclePhoto?.length || 0) / 1024), 'KB');
      console.log('License Photo Size:', Math.round((licensePhoto?.length || 0) / 1024), 'KB');

      const bodyData: Record<string, unknown> = isMotorKyc
        ? {
            user_id: userId,
            vehicle_kind: 'motorcycle',
            plate_number: plateNumber.trim() ? plateNumber.toUpperCase().trim() : null,
            vehicle_brand: vehicleBrand.trim(),
            vehicle_model: vehicleModel.trim(),
            license_photo_base64: licensePhoto,
            motorcycle_photo_base64: motorcyclePhoto,
            selfie_photo_base64: selfiePhoto,
          }
        : {
            user_id: userId,
            vehicle_kind: 'car',
            plate_number: plateNumber.toUpperCase().trim(),
            vehicle_brand: vehicleBrand,
            vehicle_model: vehicleModel,
            vehicle_year: vehicleYear || null,
            vehicle_color: vehicleColor || null,
            vehicle_photo_base64: vehiclePhoto,
            license_photo_base64: licensePhoto,
          };

      setSubmitStatus('Sunucuya bağlanılıyor...');

      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      console.log('Response Status:', response.status);
      setSubmitStatus('Yanıt işleniyor...');

      const responseText = await response.text();
      console.log('Response Text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON parse error:', e);
        throw new Error('Sunucu yanıtı işlenemedi');
      }

      console.log('Response Data:', data);

      if (response.ok && data.success) {
        setSubmitStatus('Başvuru başarılı!');
        console.log('========== KYC SUBMIT BAŞARILI ==========');
        
        // Başarı mesajı göster
        if (Platform.OS === 'web') {
          alert('✅ Başvurunuz Alındı!\n\nSürücü başvurunuz incelemeye alındı.\nOnaylandığında bildirim alacaksınız.\n\nTahmini onay süresi: 30 dakika');
          onSuccess();
        } else {
          Alert.alert(
            '✅ Başvurunuz Alındı',
            'Sürücü başvurunuz incelemeye alındı.\nOnaylandığında bildirim alacaksınız.\n\nTahmini onay süresi: 30 dakika',
            [{ text: 'Tamam', onPress: onSuccess }]
          );
        }
      } else {
        throw new Error(data.message || data.detail || 'Başvuru gönderilemedi');
      }
    } catch (error: any) {
      console.error('========== KYC SUBMIT HATA ==========');
      console.error('Error:', error);
      setSubmitStatus('');
      
      const errorMsg = error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      if (Platform.OS === 'web') {
        alert('Hata: ' + errorMsg);
      } else {
        Alert.alert('Hata', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3FA9F5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isMotorKyc ? 'Motor Sürücü Kaydı' : 'Sürücü Kaydı'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Bilgi Kartı */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#3FA9F5" />
            <Text style={styles.infoText}>
              {isMotorKyc
                ? 'Motor sürücüsü olarak marka, model, ehliyet, motor ve yüz fotoğrafı gerekir. Başvurunuz admin tarafından incelenir.'
                : 'Sürücü olarak kayıt olmak için araç ve ehliyet bilgilerinizi girin. Başvurunuz admin tarafından incelenecektir.'}
            </Text>
          </View>

          {isMotorKyc ? (
            <>
              <Text style={styles.label}>Motor Markası *</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Honda"
                placeholderTextColor="#999"
                value={vehicleBrand}
                onChangeText={setVehicleBrand}
              />
              <Text style={styles.label}>Motor Modeli *</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: PCX 125"
                placeholderTextColor="#999"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />
              <Text style={styles.label}>Plaka (isteğe bağlı)</Text>
              <TextInput
                style={styles.input}
                placeholder="Varsa yazın"
                placeholderTextColor="#999"
                value={plateNumber}
                onChangeText={setPlateNumber}
                autoCapitalize="characters"
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Plaka Numarası *</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: 34 ABC 123"
                placeholderTextColor="#999"
                value={plateNumber}
                onChangeText={setPlateNumber}
                autoCapitalize="characters"
              />
              <Text style={styles.label}>Araç Markası *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setShowBrandModal(true)}>
                <Ionicons name="car" size={20} color={vehicleBrand ? '#3FA9F5' : '#999'} />
                <Text style={[styles.selectText, vehicleBrand && styles.selectTextActive]}>
                  {vehicleBrand || 'Marka seçin...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
              <Text style={styles.label}>Araç Modeli *</Text>
              <TouchableOpacity
                style={[styles.selectButton, !vehicleBrand && styles.selectDisabled]}
                onPress={() => vehicleBrand && setShowModelModal(true)}
                disabled={!vehicleBrand}
              >
                <Ionicons name="construct" size={20} color={vehicleModel ? '#3FA9F5' : '#999'} />
                <Text style={[styles.selectText, vehicleModel && styles.selectTextActive]}>
                  {vehicleModel || 'Model seçin...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
              <Text style={styles.label}>Araç Yılı</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: 2020"
                placeholderTextColor="#999"
                value={vehicleYear}
                onChangeText={setVehicleYear}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.label}>Araç Rengi</Text>
              <View style={styles.colorGrid}>
                {CAR_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color.name}
                    style={[styles.colorItem, vehicleColor === color.name && styles.colorItemActive]}
                    onPress={() => setVehicleColor(color.name)}
                  >
                    <View style={[styles.colorCircle, { backgroundColor: color.code, borderColor: color.border }]} />
                    <Text style={[styles.colorName, vehicleColor === color.name && styles.colorNameActive]}>
                      {color.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Araç Fotoğrafı * (Plaka görünmeli)</Text>
              {vehiclePhoto ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: vehiclePhoto }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setVehiclePhoto(null)}>
                    <Ionicons name="close-circle" size={28} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  {Platform.OS === 'web' ? (
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => handleWebFileSelect('vehicle')}>
                      <Ionicons name="cloud-upload" size={32} color="#3FA9F5" />
                      <Text style={styles.uploadText}>Fotoğraf Yükle</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('vehicle', 'camera')}>
                        <Ionicons name="camera" size={28} color="#3FA9F5" />
                        <Text style={styles.photoBtnText}>Çek</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('vehicle', 'gallery')}>
                        <Ionicons name="images" size={28} color="#3FA9F5" />
                        <Text style={styles.photoBtnText}>Galeri</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {/* Ehliyet Fotoğrafı */}
          <Text style={styles.label}>Ehliyet Fotoğrafı *</Text>
          {licensePhoto ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: licensePhoto }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setLicensePhoto(null)}>
                <Ionicons name="close-circle" size={28} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              {Platform.OS === 'web' ? (
                <TouchableOpacity style={styles.uploadBtn} onPress={() => handleWebFileSelect('license')}>
                  <Ionicons name="cloud-upload" size={32} color="#3FA9F5" />
                  <Text style={styles.uploadText}>Fotoğraf Yükle</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('license', 'camera')}>
                    <Ionicons name="camera" size={28} color="#3FA9F5" />
                    <Text style={styles.photoBtnText}>Çek</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('license', 'gallery')}>
                    <Ionicons name="images" size={28} color="#3FA9F5" />
                    <Text style={styles.photoBtnText}>Galeri</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {isMotorKyc ? (
            <>
              <Text style={styles.label}>Motor Fotoğrafı *</Text>
              {motorcyclePhoto ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: motorcyclePhoto }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setMotorcyclePhoto(null)}>
                    <Ionicons name="close-circle" size={28} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  {Platform.OS === 'web' ? (
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => handleWebFileSelect('motorcycle')}>
                      <Ionicons name="cloud-upload" size={32} color="#3FA9F5" />
                      <Text style={styles.uploadText}>Motor Fotoğrafı</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('motorcycle', 'camera')}>
                        <Ionicons name="camera" size={28} color="#3FA9F5" />
                        <Text style={styles.photoBtnText}>Çek</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('motorcycle', 'gallery')}>
                        <Ionicons name="images" size={28} color="#3FA9F5" />
                        <Text style={styles.photoBtnText}>Galeri</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
              <Text style={styles.label}>Selfie (yüzünüz görünsün) *</Text>
              {selfiePhoto ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: selfiePhoto }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setSelfiePhoto(null)}>
                    <Ionicons name="close-circle" size={28} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  {Platform.OS === 'web' ? (
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => handleWebFileSelect('selfie')}>
                      <Ionicons name="cloud-upload" size={32} color="#3FA9F5" />
                      <Text style={styles.uploadText}>Selfie Yükle</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('selfie', 'camera')}>
                        <Ionicons name="camera" size={28} color="#3FA9F5" />
                        <Text style={styles.photoBtnText}>Çek</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => pickImageMobile('selfie', 'gallery')}>
                        <Ionicons name="images" size={28} color="#3FA9F5" />
                        <Text style={styles.photoBtnText}>Galeri</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </>
          ) : null}

          {/* Submit Status */}
          {submitStatus ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color="#3FA9F5" />
              <Text style={styles.statusText}>{submitStatus}</Text>
            </View>
          ) : null}

          {/* Gönder Butonu */}
          <TouchableOpacity
            style={[styles.submitBtn, (!isFormValid() || loading) && styles.submitBtnDisabled]}
            onPress={submitKYC}
            disabled={!isFormValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFF" />
                <Text style={styles.submitBtnText}>Başvuruyu Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Marka Modal */}
      <Modal visible={showBrandModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Marka Seçin</Text>
            <TouchableOpacity onPress={() => setShowBrandModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Marka ara..."
              placeholderTextColor="#999"
              value={brandSearch}
              onChangeText={setBrandSearch}
            />
          </View>
          <FlatList
            data={filteredBrands}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, vehicleBrand === item && styles.listItemActive]}
                onPress={() => {
                  setVehicleBrand(item);
                  setVehicleModel('');
                  setShowBrandModal(false);
                  setBrandSearch('');
                }}
              >
                <Text style={[styles.listItemText, vehicleBrand === item && styles.listItemTextActive]}>
                  {item}
                </Text>
                {vehicleBrand === item && <Ionicons name="checkmark" size={22} color="#3FA9F5" />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Model Modal */}
      <Modal visible={showModelModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{vehicleBrand} Modelleri</Text>
            <TouchableOpacity onPress={() => setShowModelModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableModels}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, vehicleModel === item && styles.listItemActive]}
                onPress={() => {
                  setVehicleModel(item);
                  setShowModelModal(false);
                }}
              >
                <Text style={[styles.listItemText, vehicleModel === item && styles.listItemTextActive]}>
                  {item}
                </Text>
                {vehicleModel === item && <Ionicons name="checkmark" size={22} color="#3FA9F5" />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
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
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EBF5FF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  selectDisabled: {
    opacity: 0.5,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  selectTextActive: {
    color: '#1B1B1E',
    fontWeight: '500',
  },
  // Renk Grid
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  colorItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    width: '18%',
    minWidth: 58,
  },
  colorItemActive: {
    borderColor: '#3FA9F5',
    backgroundColor: '#EBF5FF',
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    marginBottom: 4,
  },
  colorName: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
  colorNameActive: {
    color: '#3FA9F5',
    fontWeight: '600',
  },
  // Fotoğraf
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoBtnText: {
    fontSize: 13,
    color: '#3FA9F5',
    marginTop: 6,
    fontWeight: '500',
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3FA9F5',
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 14,
    color: '#3FA9F5',
    marginTop: 8,
    fontWeight: '600',
  },
  photoPreview: {
    position: 'relative',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
  },
  // Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 10,
    marginTop: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#3FA9F5',
    fontWeight: '500',
  },
  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  listItemActive: {
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#3FA9F5',
  },
  listItemText: {
    fontSize: 16,
    color: '#1B1B1E',
  },
  listItemTextActive: {
    fontWeight: '600',
    color: '#3FA9F5',
  },
});
