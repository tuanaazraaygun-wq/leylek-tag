/**
 * DriverKYCScreen.tsx - Sürücü KYC Kayıt Ekranı
 * Web, Android ve iOS için tam uyumlu
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import type { AiMockResult, AiTier } from '../lib/driverKycAiMock';
import {
  analyzeLicenseMock,
  analyzeVehicleMock,
  combineAiTier,
  combineAiWarnings,
} from '../lib/driverKycAiMock';

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

const CAR_STEP_TITLES = ['Araç bilgileri', 'Araç fotoğrafı', 'Ehliyet', 'Özet', 'Başvuru'];
const MOTOR_STEP_TITLES = ['Motor bilgileri', 'Motor fotoğrafı', 'Ehliyet', 'Selfie', 'Başvuru'];

/** KYC submit yanıt gövdesi: JSON değilse veya boşsa anlamlı hata (proxy HTML / 413 vb.). */
function parseKycSubmitResponseJson(raw: string, httpStatus: number, contentType: string | null): unknown {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed.length) {
    throw new Error(
      `Sunucu boş yanıt döndü (HTTP ${httpStatus}). Bağlantı veya zaman aşımı olabilir; tekrar deneyin.`,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const flat = trimmed.replace(/\s+/g, ' ');
    const snippet = flat.length > 220 ? `${flat.slice(0, 220)}…` : flat;
    const ct = contentType || '';
    const looks413 =
      httpStatus === 413 ||
      /request entity too large|payload too large|413/i.test(flat) ||
      /too large|çok büyük/i.test(flat);
    const hint = looks413
      ? ' Büyük ihtimalle fotoğraflar istek boyutu limitini aşıyor; kamera kalitesini düşürüp tekrar deneyin.'
      : !/application\/json/i.test(ct) && /<\s*html[\s>]/i.test(trimmed)
        ? ' Sunucu JSON yerine HTML döndü (CDN / proxy / bakım sayfası).'
        : '';
    throw new Error(
      `Sunucu yanıtı JSON olarak okunamadı (HTTP ${httpStatus}).${hint} Özet: ${snippet}`,
    );
  }
}

/** FastAPI: detail string | dizi; özel cevaplarda message. */
function pickKycSubmitErrorMessage(data: unknown, httpStatus: number): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
    const detail = d.detail;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      const parts = detail.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          if (typeof o.msg === 'string') return o.msg;
          if (typeof o.message === 'string') return o.message;
        }
        return '';
      });
      const t = parts.filter(Boolean).join(' — ');
      if (t) return t;
    }
    if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
  }
  if (httpStatus === 413) {
    return 'İstek çok büyük (413). Fotoğrafları daha düşük çözünürlükte yükleyin.';
  }
  if (httpStatus >= 500) {
    return `Sunucu hatası (HTTP ${httpStatus}). Lütfen bir süre sonra tekrar deneyin.`;
  }
  return 'Başvuru gönderilemedi';
}

function AiResultCard({ result, subtitle }: { result: AiMockResult; subtitle?: string }) {
  const palette: Record<AiTier, { bg: string; border: string; accent: string }> = {
    green: { bg: '#ECFDF5', border: '#6EE7B7', accent: '#047857' },
    yellow: { bg: '#FFFBEB', border: '#FCD34D', accent: '#B45309' },
    red: { bg: '#FEF2F2', border: '#FCA5A5', accent: '#B91C1C' },
  };
  const c = palette[result.status];
  return (
    <View style={[aiCardStyles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      {subtitle ? <Text style={[aiCardStyles.sub, { color: c.accent }]}>{subtitle}</Text> : null}
      <Text style={[aiCardStyles.badge, { color: c.accent }]}>
        {result.status === 'green' ? 'Ön kontrol: iyi' : result.status === 'yellow' ? 'Ön kontrol: uyarı' : 'Ön kontrol: sorun'}
      </Text>
      <Text style={aiCardStyles.title}>{result.title}</Text>
      {result.messages.map((m, idx) => (
        <Text key={idx} style={aiCardStyles.line}>
          • {m}
        </Text>
      ))}
    </View>
  );
}

const aiCardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  sub: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  badge: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 },
  line: { fontSize: 13, color: '#374151', lineHeight: 18, marginBottom: 4 },
});

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

  const [step, setStep] = useState(0);
  const [vehicleAi, setVehicleAi] = useState<AiMockResult | null>(null);
  const [licenseAi, setLicenseAi] = useState<AiMockResult | null>(null);
  const [analyzingVehicle, setAnalyzingVehicle] = useState(false);
  const [analyzingLicense, setAnalyzingLicense] = useState(false);

  const stepTitles = isMotorKyc ? MOTOR_STEP_TITLES : CAR_STEP_TITLES;

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

  useEffect(() => {
    if (isMotorKyc) return;
    let cancelled = false;
    if (!vehiclePhoto) {
      setVehicleAi(null);
      setAnalyzingVehicle(false);
      return;
    }
    setAnalyzingVehicle(true);
    setVehicleAi(null);
    (async () => {
      try {
        const r = await analyzeVehicleMock(vehiclePhoto);
        if (!cancelled) setVehicleAi(r);
      } finally {
        if (!cancelled) setAnalyzingVehicle(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehiclePhoto, isMotorKyc]);

  useEffect(() => {
    if (!isMotorKyc) return;
    let cancelled = false;
    if (!motorcyclePhoto) {
      setVehicleAi(null);
      setAnalyzingVehicle(false);
      return;
    }
    setAnalyzingVehicle(true);
    setVehicleAi(null);
    (async () => {
      try {
        const r = await analyzeVehicleMock(motorcyclePhoto);
        if (!cancelled) setVehicleAi(r);
      } finally {
        if (!cancelled) setAnalyzingVehicle(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [motorcyclePhoto, isMotorKyc]);

  useEffect(() => {
    let cancelled = false;
    if (!licensePhoto) {
      setLicenseAi(null);
      setAnalyzingLicense(false);
      return;
    }
    setAnalyzingLicense(true);
    setLicenseAi(null);
    (async () => {
      try {
        const r = await analyzeLicenseMock(licensePhoto);
        if (!cancelled) setLicenseAi(r);
      } finally {
        if (!cancelled) setAnalyzingLicense(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [licensePhoto]);

  const vehiclePhotoForAi = isMotorKyc ? motorcyclePhoto : vehiclePhoto;
  const vehicleDocReady =
    !!vehiclePhotoForAi &&
    !analyzingVehicle &&
    !!vehicleAi &&
    vehicleAi.status !== 'red';
  const licenseDocReady =
    !!licensePhoto && !analyzingLicense && !!licenseAi && licenseAi.status !== 'red';

  const canGoNext = (): boolean => {
    if (isMotorKyc) {
      if (step === 0) return !!(vehicleBrand.trim() && vehicleModel.trim());
      if (step === 1) return vehicleDocReady;
      if (step === 2) return licenseDocReady;
      if (step === 3) return !!selfiePhoto;
      return false;
    }
    if (step === 0) return !!(plateNumber.trim() && vehicleBrand && vehicleModel);
    if (step === 1) return vehicleDocReady;
    if (step === 2) return licenseDocReady;
    if (step === 3) return true;
    return false;
  };

  const canSubmitFinal = (): boolean => {
    if (isMotorKyc) {
      return (
        vehicleBrand.trim() &&
        vehicleModel.trim() &&
        !!motorcyclePhoto &&
        !!licensePhoto &&
        !!selfiePhoto &&
        !!vehicleAi &&
        !!licenseAi &&
        vehicleAi.status !== 'red' &&
        licenseAi.status !== 'red'
      );
    }
    return (
      !!plateNumber.trim() &&
      !!vehicleBrand &&
      !!vehicleModel &&
      !!vehiclePhoto &&
      !!licensePhoto &&
      !!vehicleAi &&
      !!licenseAi &&
      vehicleAi.status !== 'red' &&
      licenseAi.status !== 'red'
    );
  };

  const goNext = () => {
    if (!canGoNext()) return;
    if (step < 4) setStep((s) => s + 1);
  };

  const goBackStep = () => {
    if (step > 0) setStep((s) => s - 1);
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

    if (!vehicleAi || !licenseAi) {
      const msg = 'Ön kontrol tamamlanmadı. Lütfen sihirbaz adımlarını tamamlayın.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Hata', msg);
      return;
    }
    if (vehicleAi.status === 'red' || licenseAi.status === 'red') {
      const msg = 'Kırmızı ön kontrol sonucu varken başvuru gönderilemez. Fotoğrafları güncelleyin.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Hata', msg);
      return;
    }

    const aiStatus = combineAiTier(vehicleAi, licenseAi);
    const aiWarnings = combineAiWarnings(vehicleAi, licenseAi);

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
            ai_status: aiStatus,
            ai_warnings: aiWarnings,
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
            ai_status: aiStatus,
            ai_warnings: aiWarnings,
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
      const contentType = response.headers.get('content-type');
      console.log('Response Text (first 500):', responseText.slice(0, 500));

      const data = parseKycSubmitResponseJson(responseText, response.status, contentType) as Record<
        string,
        unknown
      >;

      console.log('Response Data:', data);

      if (response.ok && data.success === true) {
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
        throw new Error(pickKycSubmitErrorMessage(data, response.status));
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isMotorKyc ? 'Motor Sürücü Kaydı' : 'Sürücü Kaydı'}
          </Text>
          <Text style={styles.headerStep}>
            Adım {step + 1}/5 · {stepTitles[step]}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Bilgi Kartı */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#3FA9F5" />
            <Text style={styles.infoText}>
              {isMotorKyc
                ? 'Adım adım motor bilgilerinizi ve belgelerinizi yükleyin. Ön kontroller mock AI ile yapılır; nihai onay admin tarafındadır.'
                : 'Adım adım araç ve ehliyet bilgilerinizi tamamlayın. Fotoğraf yükledikten sonra mock ön kontrol çalışır; nihai onay admin tarafındadır.'}
            </Text>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${((step + 1) / 5) * 100}%` }]} />
          </View>

          {!isMotorKyc ? (
            <>
              {step === 0 && (
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
                </>
              )}
              {step === 1 && (
                <>
                  <Text style={styles.stepHelp}>
                    Plaka ve aracın tamamı görünsün; gölgede veya çok uzaktan çekmeyin.
                  </Text>
                  <Text style={styles.label}>Araç Fotoğrafı *</Text>
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
                  {analyzingVehicle ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Fotoğraf analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>
                        Bu fotoğrafla ilerlenemez. Lütfen daha net bir görüntü yükleyin.
                      </Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: yine de devam edebilirsiniz; mümkünse daha iyi bir fotoğraf tercih edin.
                      </Text>
                    </View>
                  ) : null}
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Araç fotoğrafı (mock)" /> : null}
                </>
              )}
              {step === 2 && (
                <>
                  <Text style={styles.stepHelp}>
                    Ehliyetin dört köşesi ve tüm yazılar okunaklı görünmeli.
                  </Text>
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
                  {analyzingLicense ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Ehliyet analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>
                        Ehliyet fotoğrafı yetersiz. Lütfen net ve kadrajı tam bir görüntü yükleyin.
                      </Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <Text style={styles.warnBannerText}>
                        Ön kontrol uyarısı: devam edebilirsiniz; mümkünse belgeyi daha net çekin.
                      </Text>
                    </View>
                  ) : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet (mock)" /> : null}
                </>
              )}
              {step === 3 && (
                <>
                  <Text style={styles.summaryTitle}>Özet</Text>
                  <Text style={styles.summaryLine}>Plaka: {plateNumber.toUpperCase().trim() || '—'}</Text>
                  <Text style={styles.summaryLine}>
                    Araç: {vehicleBrand} {vehicleModel}
                    {vehicleYear ? ` (${vehicleYear})` : ''}
                    {vehicleColor ? ` · ${vehicleColor}` : ''}
                  </Text>
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Araç fotoğrafı" /> : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet" /> : null}
                </>
              )}
              {step === 4 && (
                <>
                  <Text style={styles.summaryTitle}>Başvuruyu gönderin</Text>
                  <Text style={styles.stepHelp}>
                    Bilgileriniz ve mock ön kontrol sonuçları admin incelemesine gidecek. Son karar her zaman admin
                    tarafındadır.
                  </Text>
                </>
              )}
            </>
          ) : (
            <>
              {step === 0 && (
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
              )}
              {step === 1 && (
                <>
                  <Text style={styles.stepHelp}>Motorunuz ve varsa plaka net görünsün.</Text>
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
                  {analyzingVehicle ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Motor fotoğrafı analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>Bu fotoğrafla ilerlenemez. Lütfen daha net bir görüntü yükleyin.</Text>
                    </View>
                  ) : null}
                  {vehicleAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <Text style={styles.warnBannerText}>Ön kontrol uyarısı: devam edebilirsiniz.</Text>
                    </View>
                  ) : null}
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Motor fotoğrafı (mock)" /> : null}
                </>
              )}
              {step === 2 && (
                <>
                  <Text style={styles.stepHelp}>Ehliyetin tüm köşeleri görünmeli.</Text>
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
                  {analyzingLicense ? (
                    <View style={styles.analyzeRow}>
                      <ActivityIndicator color="#3FA9F5" />
                      <Text style={styles.analyzeText}>Ehliyet analiz ediliyor…</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'red' ? (
                    <View style={styles.blockBanner}>
                      <Ionicons name="close-circle" size={22} color="#B91C1C" />
                      <Text style={styles.blockBannerText}>Ehliyet fotoğrafı yetersiz. Lütfen net bir görüntü yükleyin.</Text>
                    </View>
                  ) : null}
                  {licenseAi?.status === 'yellow' ? (
                    <View style={styles.warnBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <Text style={styles.warnBannerText}>Ön kontrol uyarısı: devam edebilirsiniz.</Text>
                    </View>
                  ) : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet (mock)" /> : null}
                </>
              )}
              {step === 3 && (
                <>
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
              )}
              {step === 4 && (
                <>
                  <Text style={styles.summaryTitle}>Özet ve gönderim</Text>
                  <Text style={styles.summaryLine}>
                    {vehicleBrand} {vehicleModel}
                    {plateNumber.trim() ? ` · ${plateNumber.toUpperCase().trim()}` : ''}
                  </Text>
                  {vehicleAi ? <AiResultCard result={vehicleAi} subtitle="Motor fotoğrafı" /> : null}
                  {licenseAi ? <AiResultCard result={licenseAi} subtitle="Ehliyet" /> : null}
                  <Text style={styles.stepHelp}>Selfie admin incelemesinde kullanılacaktır.</Text>
                </>
              )}
            </>
          )}

          {/* Submit Status */}
          {submitStatus ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color="#3FA9F5" />
              <Text style={styles.statusText}>{submitStatus}</Text>
            </View>
          ) : null}

          <View style={styles.wizardFooter}>
            {step > 0 ? (
              <TouchableOpacity style={styles.navBtnSecondary} onPress={goBackStep}>
                <Text style={styles.navBtnSecondaryText}>Geri</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {step < 4 ? (
              <TouchableOpacity
                style={[styles.navBtnPrimary, !canGoNext() && styles.navBtnDisabled]}
                onPress={goNext}
                disabled={!canGoNext()}
              >
                <Text style={styles.navBtnPrimaryText}>İleri</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitBtnFooter, (!canSubmitFinal() || loading) && styles.submitBtnDisabled]}
                onPress={submitKYC}
                disabled={!canSubmitFinal() || loading}
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
            )}
          </View>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerStep: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3FA9F5',
  },
  stepHelp: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  analyzeText: {
    fontSize: 14,
    color: '#3FA9F5',
    fontWeight: '500',
  },
  blockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  blockBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1B1E',
    marginBottom: 10,
  },
  summaryLine: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 22,
  },
  wizardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    paddingTop: 8,
  },
  navBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  navBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  navBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#3FA9F5',
    alignItems: 'center',
  },
  navBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  navBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnFooter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
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
