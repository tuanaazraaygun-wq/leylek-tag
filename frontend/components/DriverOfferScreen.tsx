/**
 * DriverOfferScreen - Sürücü Teklif Ekranı
 * 
 * Yolcunun gördüğü teklif ekranına benzer tasarım:
 * - Üstte harita (20km çevresindeki yolcuları gösterir)
 * - Altta kompakt kart listesi (scroll edilebilir)
 * - Her kartta: yolcu konumu, hedef, mesafe, süre bilgileri
 * - Hızlı teklif gönderme
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// react-native-maps'i sadece native platformlarda yükle
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

// Renkler
const COLORS = {
  primary: '#3FA9F5',
  secondary: '#FF6B35',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1B1B1E',
  textSecondary: '#64748B',
  success: '#22C55E',
  border: '#E2E8F0',
};

export interface PassengerRequest {
  id: string;
  request_id?: string;
  tag_id?: string;
  passenger_id: string;
  passenger_name: string;
  pickup_location: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_location: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  distance_to_passenger_km?: number;
  trip_distance_km?: number;
  time_to_passenger_min?: number;
  trip_duration_min?: number;
  // 🆕 MARTI TAG
  offered_price?: number;
  notes?: string;
  created_at?: string;
}

interface DriverOfferScreenProps {
  driverLocation: { latitude: number; longitude: number } | null;
  requests: PassengerRequest[];
  driverName: string;
  driverRating: number;
  onSendOffer: (requestId: string, price: number) => Promise<boolean>;
  onAcceptOffer?: (requestId: string) => void;  // 🆕 MARTI TAG
  onDismissRequest: (requestId: string) => void;
  onBack: () => void;
  onLogout: () => void;
}

// Yolcu Request Kartı Bileşeni - MARTI TAG MODELİ
function RequestCard({ 
  request, 
  driverLocation,
  onAccept, 
  onDismiss,
  index
}: { 
  request: PassengerRequest; 
  driverLocation: { latitude: number; longitude: number } | null;
  onAccept: () => void;
  onDismiss: () => void;
  index: number;
}) {
  const [accepting, setAccepting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);

  // Mesafe hesapla
  const distanceToPassenger = request.distance_to_passenger_km?.toFixed(1) || '?';
  const tripDistance = request.trip_distance_km?.toFixed(1) || '?';
  const timeToPassenger = request.time_to_passenger_min || Math.round((request.distance_to_passenger_km || 5) / 40 * 60);
  const tripDuration = request.trip_duration_min || Math.round((request.trip_distance_km || 10) / 50 * 60);

  // Kabul Et
  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    onAccept();
  };

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Üst Kısım - Yolcu Bilgisi */}
      <View style={styles.cardHeader}>
        <View style={styles.passengerInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>{request.passenger_name || 'Yolcu'}</Text>
            <Text style={styles.timeAgo}>Yeni teklif</Text>
          </View>
        </View>
        {/* 🆕 MARTI TAG - Yolcunun Teklif Ettiği Fiyat */}
        <View style={styles.priceTagContainer}>
          <Text style={styles.priceTagLabel}>Teklif</Text>
          <Text style={styles.priceTagValue}>{request.offered_price || 0} ₺</Text>
        </View>
      </View>

      {/* Konum Bilgileri */}
      <View style={styles.locationSection}>
        {/* Nereden */}
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Nereden</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {request.pickup_location || 'Bilinmiyor'}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <Ionicons name="car" size={12} color={COLORS.primary} />
            <Text style={styles.distanceText}>{distanceToPassenger} km</Text>
          </View>
        </View>

        {/* Çizgi */}
        <View style={styles.locationLine} />

        {/* Nereye */}
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.secondary }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Nereye</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {request.dropoff_location || 'Belirtilmedi'}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate" size={12} color={COLORS.secondary} />
            <Text style={styles.distanceText}>{tripDistance} km</Text>
          </View>
        </View>
      </View>

      {/* Mesafe ve Süre Bilgileri */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.statText}>{timeToPassenger} dk yolcuya</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="speedometer-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.statText}>{tripDuration} dk yolculuk</Text>
        </View>
      </View>

      {/* 🆕 MARTI TAG - Kabul Et / Geç Butonları */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
        >
          <Text style={styles.dismissButtonText}>Geç</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Kabul Et</Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
            disabled={!priceInput || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFF" />
                <Text style={styles.sendBtnText}>Teklif Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sentContainer}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
          <Text style={styles.sentText}>Teklif Gönderildi - ₺{priceInput}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function DriverOfferScreen({
  driverLocation,
  requests,
  driverName,
  driverRating,
  onSendOffer,
  onDismissRequest,
  onBack,
  onLogout,
}: DriverOfferScreenProps) {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Harita sınırlarını ayarla
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driverLocation) return;

    const coordinates: { latitude: number; longitude: number }[] = [driverLocation];
    
    requests.forEach(req => {
      if (req.pickup_lat && req.pickup_lng) {
        coordinates.push({ latitude: req.pickup_lat, longitude: req.pickup_lng });
      }
    });

    if (coordinates.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 300);
    }
  }, [mapReady, driverLocation, requests.length]);

  // Web fallback veya harita yoksa
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.mapFallback}>
          <Ionicons name="map" size={40} color={COLORS.primary} />
          <Text style={styles.mapFallbackText}>
            {requests.length} yolcu 20km içinde
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={driverLocation ? {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        } : undefined}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Sürücü konumu */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Konumunuz"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={24} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Yolcular */}
        {requests.map((req, index) => (
          req.pickup_lat && req.pickup_lng && (
            <Marker
              key={req.id || index}
              coordinate={{ latitude: req.pickup_lat, longitude: req.pickup_lng }}
              title={req.passenger_name || 'Yolcu'}
              description={req.pickup_location}
            >
              <View style={styles.passengerMarker}>
                <Ionicons name="person" size={16} color="#FFF" />
              </View>
            </Marker>
          )
        ))}
      </MapView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{driverName}</Text>
          <Text style={styles.headerSubtitle}>⭐ {driverRating?.toFixed(1) || '5.0'}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Harita - Üst %35 */}
      <View style={styles.mapContainer}>
        {renderMap()}
        
        {/* Harita üzerinde bilgi */}
        <View style={styles.mapOverlay}>
          <View style={styles.requestCountBadge}>
            <Ionicons name="people" size={16} color={COLORS.primary} />
            <Text style={styles.requestCountText}>{requests.length} yolcu bekliyor</Text>
          </View>
        </View>
      </View>

      {/* Yolcu İstekleri Listesi - Alt %65 */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Yakındaki İstekler</Text>
          <Text style={styles.listSubtitle}>20 km çevrenizdeki yolcular</Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Henüz istek yok</Text>
            <Text style={styles.emptySubtitle}>
              20 km çevrenizde yolcu bekleniyor...
            </Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item, index) => item.id || item.request_id || index.toString()}
            renderItem={({ item, index }) => (
              <RequestCard
                request={item}
                driverLocation={driverLocation}
                onSendOffer={(price) => onSendOffer(item.request_id || item.id, price)}
                onDismiss={() => onDismissRequest(item.id)}
                index={index}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
  },

  // Map
  mapContainer: {
    height: SCREEN_HEIGHT * 0.32,
    backgroundColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  mapFallbackText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  requestCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 6,
  },
  driverMarker: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  passengerMarker: {
    backgroundColor: COLORS.secondary,
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // List
  listContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  listSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerDetails: {
    marginLeft: 10,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  dismissBtn: {
    padding: 8,
  },

  // Location
  locationSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginLeft: 4,
    marginVertical: 4,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
  },

  // Offer Section
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  priceBtn: {
    padding: 10,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  priceInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    minWidth: 60,
    paddingVertical: 8,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  sentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    borderRadius: 12,
  },
  sentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
});
