import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

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
          Alert.alert('Hata', 'Bu sayfa sadece sürücüler için');
          router.back();
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
      Alert.alert('Hata', 'Galeri erişim izni gerekli');
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
      Alert.alert('Hata', 'Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/user/${user.id}/driver-details`, {
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
        Alert.alert('Başarılı', 'Sürücü bilgileri güncellendi. Doğrulama süreci başlatıldı.');
        router.back();
      }
    } catch (error) {
      Alert.alert('Hata', 'Bilgiler kaydedilemedi');
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
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sürücü Doğrulama</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={Colors.info} />
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
            placeholderTextColor={Colors.gray400}
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
                <Ionicons name="camera" size={40} color={Colors.gray400} />
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
                  color={vehicleType === type.value ? '#FFF' : Colors.primary}
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
            placeholderTextColor={Colors.gray400}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Model *</Text>
          <TextInput
            style={styles.input}
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="Toyota Corolla 2020"
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.label}>Renk</Text>
          <TextInput
            style={styles.input}
            value={vehicleColor}
            onChangeText={setVehicleColor}
            placeholder="Beyaz"
            placeholderTextColor={Colors.gray400}
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
                <Ionicons name="camera" size={40} color={Colors.gray400} />
                <Text style={styles.photoPlaceholderText}>Fotoğraf Ekle</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Kaydediliyor...' : 'Kaydet ve Doğrula'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text
  },
  content: {
    flex: 1,
    padding: Spacing.md
  },
  infoCard: {
    backgroundColor: Colors.info + '20',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.info,
    marginLeft: Spacing.sm,
    flex: 1
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    color: Colors.text
  },
  photoButton: {
    marginBottom: Spacing.md
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed'
  },
  photoPlaceholderText: {
    fontSize: FontSize.sm,
    color: Colors.gray400,
    marginTop: Spacing.sm
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md
  },
  vehicleTypeButton: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginRight: '2%',
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border
  },
  vehicleTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  vehicleTypeText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary
  },
  vehicleTypeTextActive: {
    color: '#FFF'
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: 'bold'
  }
});
