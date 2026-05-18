import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Spacing, BorderRadius, FontSize } from '../constants/Colors';
import { API_BASE_URL } from '../lib/backendConfig';
import { appAlert } from '../contexts/AppAlertContext';

/** Yerel premium verify ekranı (global palet dokunulmadan). */
const DV_P = {
  bg: '#08111F',
  bgElev: '#0B1220',
  card: 'rgba(16, 26, 43, 0.88)',
  border: '#1E3A5F',
  cyan: '#22D3EE',
  textHi: 'rgba(243, 248, 255, 0.94)',
  textMd: 'rgba(186, 201, 222, 0.82)',
} as const;

interface User {
  id: string;
  role: string;
  driver_details?: any;
}

export default function DriverVerificationScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licensePhoto, setLicensePhoto] = useState('');
  const [vehicleType, setVehicleType] = useState('sedan');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        if (parsed.role !== 'driver') {
          appAlert('Hata', 'Bu sayfa sadece sürücüler için', [{ text: 'Tamam', onPress: () => router.back() }]);
          return;
        }
        setUser(parsed);
        
        // Mevcut bilgileri doldur
        if (parsed.driver_details) {
          const dd = parsed.driver_details;
          setLicenseNumber(dd.license_number || '');
          setLicensePhoto(dd.license_photo || '');
          setVehicleType(dd.vehicle_type || 'sedan');
          setVehiclePlate(dd.vehicle_plate || '');
          setVehicleModel(dd.vehicle_model || '');
          setVehicleColor(dd.vehicle_color || '');
          setVehiclePhoto(dd.vehicle_photo || '');
        }
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Kullanıcı yüklenemedi:', error);
    }
  };

  const pickImage = async (type: 'license' | 'vehicle') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      appAlert('Hata', 'Galeri erişim izni gerekli');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'license') {
        setLicensePhoto(base64Image);
      } else {
        setVehiclePhoto(base64Image);
      }
    }
  };

  const handleSave = async () => {
    if (!licenseNumber || !vehiclePlate || !vehicleModel) {
      appAlert('Hata', 'Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/user/${user.id}/driver-details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_number: licenseNumber,
          license_photo: licensePhoto,
          vehicle_type: vehicleType,
          vehicle_plate: vehiclePlate,
          vehicle_model: vehicleModel,
          vehicle_color: vehicleColor,
          vehicle_photo: vehiclePhoto
        })
      });

      const data = await response.json();
      if (data.success) {
        appAlert('Başarılı', 'Sürücü bilgileri güncellendi. Doğrulama süreci başlatıldı.', [
          { text: 'Tamam', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      appAlert('Hata', 'Bilgiler kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const vehicleTypes = [
    { value: 'sedan', label: 'Sedan', icon: 'car' },
    { value: 'suv', label: 'SUV', icon: 'car-sport' },
    { value: 'van', label: 'Van', icon: 'bus' },
    { value: 'hatchback', label: 'Hatchback', icon: 'car' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={DV_P.cyan} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sürücü Doğrulama</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={DV_P.cyan} />
          <Text style={styles.infoText}>
            Güvenli yolculuk için sürücü bilgilerinizi doğrulayın
          </Text>
        </View>

        {/* Ehliyet Bilgileri */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ehliyet Bilgileri</Text>
          
          <Text style={styles.label}>Ehliyet Numarası *</Text>
          <TextInput
            style={styles.input}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholder="Ehliyet numaranızı girin"
            placeholderTextColor="rgba(186,201,222,0.42)"
          />

          <Text style={styles.label}>Ehliyet Fotoğrafı</Text>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => pickImage('license')}
          >
            {licensePhoto ? (
              <Image source={{ uri: licensePhoto }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={40} color={DV_P.cyan} />
                <Text style={styles.photoPlaceholderText}>Fotoğraf Ekle</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Araç Bilgileri */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Araç Bilgileri</Text>
          
          <Text style={styles.label}>Araç Tipi *</Text>
          <View style={styles.vehicleTypeContainer}>
            {vehicleTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === type.value && styles.vehicleTypeButtonActive
                ]}
                onPress={() => setVehicleType(type.value)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={24}
                  color={vehicleType === type.value ? DV_P.textHi : DV_P.cyan}
                />
                <Text
                  style={[
                    styles.vehicleTypeText,
                    vehicleType === type.value && styles.vehicleTypeTextActive
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Plaka *</Text>
          <TextInput
            style={styles.input}
            value={vehiclePlate}
            onChangeText={(text) => setVehiclePlate(text.toUpperCase())}
            placeholder="34 ABC 1234"
            placeholderTextColor="rgba(186,201,222,0.42)"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Model *</Text>
          <TextInput
            style={styles.input}
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="Toyota Corolla 2020"
            placeholderTextColor="rgba(186,201,222,0.42)"
          />

          <Text style={styles.label}>Renk</Text>
          <TextInput
            style={styles.input}
            value={vehicleColor}
            onChangeText={setVehicleColor}
            placeholder="Beyaz"
            placeholderTextColor="rgba(186,201,222,0.42)"
          />

          <Text style={styles.label}>Araç Fotoğrafı</Text>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => pickImage('vehicle')}
          >
            {vehiclePhoto ? (
              <Image source={{ uri: vehiclePhoto }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={40} color={DV_P.cyan} />
                <Text style={styles.photoPlaceholderText}>Fotoğraf Ekle</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && { opacity: 0.62 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={DV_P.cyan} size="small" />
              <Text style={styles.primaryButtonText}>Kaydediliyor...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>Kaydet ve Doğrula</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DV_P.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: DV_P.border,
    backgroundColor: 'rgba(11,18,32,0.96)',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: DV_P.textHi,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: DV_P.bg,
  },
  infoCard: {
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.18)',
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: DV_P.textMd,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  card: {
    backgroundColor: DV_P.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: DV_P.border,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: DV_P.textHi,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: DV_P.textHi,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: DV_P.border,
    marginBottom: Spacing.md,
    color: DV_P.textHi,
  },
  photoButton: {
    marginBottom: Spacing.md,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: DV_P.bgElev,
    borderWidth: 1,
    borderColor: DV_P.border,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(16,26,43,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DV_P.border,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: FontSize.sm,
    color: DV_P.textMd,
    marginTop: Spacing.sm,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  vehicleTypeButton: {
    width: '48%',
    backgroundColor: 'rgba(16,26,43,0.55)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginRight: '2%',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: DV_P.border,
  },
  vehicleTypeButtonActive: {
    backgroundColor: 'rgba(34,211,238,0.16)',
    borderColor: 'rgba(34,211,238,0.45)',
    shadowColor: DV_P.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  vehicleTypeText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: DV_P.textMd,
  },
  vehicleTypeTextActive: {
    color: DV_P.textHi,
  },
  primaryButton: {
    backgroundColor: 'rgba(6,148,173,0.42)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.42)',
    shadowColor: DV_P.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryButtonText: {
    color: DV_P.textHi,
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
});
