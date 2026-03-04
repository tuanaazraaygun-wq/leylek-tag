import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://ride-completion.preview.emergentagent.com';

interface Package {
  id: string;
  name: string;
  hours: number;
  price_tl: number;
}

interface DriverPackagesModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  onPackagePurchased?: () => void;
}

export default function DriverPackagesModal({
  visible,
  onClose,
  userId,
  onPackagePurchased,
}: DriverPackagesModalProps) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchPackages();
    }
  }, [visible]);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/driver/packages`);
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages);
      }
    } catch (error) {
      console.error('Paket yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    // TODO: iyzico entegrasyonu eklenecek
    // Şimdilik direkt aktifleştirme yapıyoruz (test için)
    
    Alert.alert(
      'Ödeme',
      'iyzico entegrasyonu yakında eklenecek. Test için paketi direkt aktifleştirmek ister misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Aktifleştir (Test)',
          onPress: async () => {
            setPurchasing(packageId);
            try {
              const response = await fetch(
                `${API_URL}/api/driver/activate-package?user_id=${userId}&package_id=${packageId}`,
                { method: 'POST' }
              );
              const data = await response.json();
              
              if (data.success) {
                Alert.alert('Başarılı', data.message);
                onPackagePurchased?.();
                onClose();
              } else {
                Alert.alert('Hata', data.detail || 'Paket aktifleştirilemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'Bağlantı hatası');
            } finally {
              setPurchasing(null);
            }
          }
        }
      ]
    );
  };

  const getPackageIcon = (hours: number) => {
    if (hours <= 3) return 'time-outline';
    if (hours <= 6) return 'timer-outline';
    if (hours <= 12) return 'sunny-outline';
    return 'moon-outline';
  };

  const getPackageColor = (hours: number) => {
    if (hours <= 3) return '#10B981';
    if (hours <= 6) return '#3B82F6';
    if (hours <= 9) return '#8B5CF6';
    if (hours <= 12) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sürücü Paketleri</Text>
              <Text style={styles.subtitle}>Yolcu bulmak için paket satın alın</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3FA9F5" />
              <Text style={styles.loadingText}>Paketler yükleniyor...</Text>
            </View>
          ) : (
            <ScrollView style={styles.packagesContainer} showsVerticalScrollIndicator={false}>
              {packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.id}
                  style={[
                    styles.packageCard,
                    selectedPackage === pkg.id && styles.packageCardSelected,
                    { borderColor: getPackageColor(pkg.hours) }
                  ]}
                  onPress={() => setSelectedPackage(pkg.id)}
                  disabled={purchasing !== null}
                >
                  <View style={[styles.packageIcon, { backgroundColor: getPackageColor(pkg.hours) + '20' }]}>
                    <Ionicons name={getPackageIcon(pkg.hours) as any} size={28} color={getPackageColor(pkg.hours)} />
                  </View>
                  
                  <View style={styles.packageInfo}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    <Text style={styles.packageHours}>{pkg.hours} saat aktif kalın</Text>
                  </View>
                  
                  <View style={styles.packagePriceContainer}>
                    <Text style={styles.packagePrice}>{pkg.price_tl} ₺</Text>
                    {selectedPackage === pkg.id && (
                      <TouchableOpacity
                        style={[styles.buyBtn, { backgroundColor: getPackageColor(pkg.hours) }]}
                        onPress={() => handlePurchase(pkg.id)}
                        disabled={purchasing !== null}
                      >
                        {purchasing === pkg.id ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.buyBtnText}>Satın Al</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              
              {/* Info */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
                <Text style={styles.infoText}>
                  Paket süreniz boyunca yolculara görünür olursunuz ve teklif alabilirsiniz.
                </Text>
              </View>
            </ScrollView>
          )}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
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
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
  },
  packagesContainer: {
    padding: 16,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  packageIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageInfo: {
    flex: 1,
    marginLeft: 14,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  packageHours: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  packagePriceContainer: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  buyBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buyBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
});
