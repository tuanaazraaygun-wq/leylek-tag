/**
 * DriverRequestMap.tsx - Sürücü için Haritada İstek Görüntüleme
 * 
 * ✅ Üstte harita - tüm istekler görünsün
 * ✅ Altta küçük istek kartları
 * ✅ Birden fazla teklif gönderebilme
 * ✅ Aynı yolcuya sadece 1 teklif
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { displayFirstName } from '../lib/displayName';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Request {
  id: string;
  request_id?: string;
  passenger_id: string;
  passenger_name: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address?: string;
  distance_to_passenger_km?: number;
  trip_distance_km?: number;
  time_to_passenger_min?: number;
  trip_duration_min?: number;
}

interface DriverRequestMapProps {
  requests: Request[];
  userLocation: { latitude: number; longitude: number } | null;
  userName: string;
  userRating: string;
  onSendOffer: (requestId: string, price: number) => Promise<void>;
  onDismiss: (requestId: string) => void;
  onBack: () => void;
  onLogout: () => void;
  sentOffers: string[]; // Teklif gönderilen request ID'leri
}

export default function DriverRequestMap({
  requests,
  userLocation,
  userName,
  userRating,
  onSendOffer,
  onDismiss,
  onBack,
  onLogout,
  sentOffers = [],
}: DriverRequestMapProps) {
  const mapRef = useRef<MapView>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [offerPrice, setOfferPrice] = useState('200');
  const [sendingOffer, setSendingOffer] = useState<string | null>(null);

  // Haritayı tüm isteklere fit et
  useEffect(() => {
    if (mapRef.current && requests.length > 0 && userLocation) {
      const coords = [
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        ...requests.map(r => ({ latitude: r.pickup_lat, longitude: r.pickup_lng })),
      ];
      
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [requests, userLocation]);

  const handleSendOffer = async (request: Request) => {
    const price = parseInt(offerPrice);
    if (isNaN(price) || price < 10) {
      Alert.alert('Hata', 'Geçerli bir fiyat girin (min ₺10)');
      return;
    }

    setSendingOffer(request.id);
    try {
      await onSendOffer(request.id, price);
      setSelectedRequest(null);
    } catch (error) {
      Alert.alert('Hata', 'Teklif gönderilemedi');
    } finally {
      setSendingOffer(null);
    }
  };

  const getMarkerColor = (request: Request) => {
    if (sentOffers.includes(request.id)) return '#22C55E'; // Yeşil - teklif gönderildi
    if (selectedRequest?.id === request.id) return '#3B82F6'; // Mavi - seçili
    return '#EF4444'; // Kırmızı - yeni istek
  };

  const renderRequestCard = ({ item }: { item: Request }) => {
    const isSent = sentOffers.includes(item.id);
    const isSelected = selectedRequest?.id === item.id;
    
    return (
      <TouchableOpacity 
        style={[
          styles.requestCard,
          isSelected && styles.requestCardSelected,
          isSent && styles.requestCardSent,
        ]}
        onPress={() => {
          setSelectedRequest(item);
          mapRef.current?.animateToRegion({
            latitude: item.pickup_lat,
            longitude: item.pickup_lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 300);
        }}
        activeOpacity={0.7}
      >
        {/* Üst Kısım - İsim ve Durum */}
        <View style={styles.cardHeader}>
          <View style={styles.cardNameContainer}>
            <Ionicons 
              name="person-circle" 
              size={24} 
              color={isSent ? '#22C55E' : '#3B82F6'} 
            />
            <Text style={styles.cardName}>{displayFirstName(item.passenger_name, 'Yolcu')} Yolcu</Text>
          </View>
          {isSent && (
            <View style={styles.sentBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
              <Text style={styles.sentBadgeText}>Gönderildi</Text>
            </View>
          )}
        </View>

        {/* Mesafe Bilgileri */}
        <View style={styles.cardInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="navigate" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.distance_to_passenger_km?.toFixed(1) || '?'} km
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.time_to_passenger_min || '?'} dk
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="flag" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.trip_distance_km?.toFixed(1) || '?'} km yol
            </Text>
          </View>
        </View>

        {/* Teklif Gönder Butonu */}
        {!isSent && isSelected && (
          <View style={styles.offerSection}>
            <View style={styles.priceInputContainer}>
              <Text style={styles.currencySymbol}>₺</Text>
              <TextInput
                style={styles.priceInput}
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="number-pad"
                placeholder="200"
              />
            </View>
            <TouchableOpacity 
              style={styles.sendOfferButton}
              onPress={() => handleSendOffer(item)}
              disabled={sendingOffer === item.id}
            >
              {sendingOffer === item.id ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFF" />
                  <Text style={styles.sendOfferText}>Teklif Ver</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{userName} Sürücü</Text>
          <Text style={styles.headerSubtitle}>⭐ {userRating} • {requests.length} İstek</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Harita */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation?.latitude || 41.0082,
            longitude: userLocation?.longitude || 28.9784,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Kullanıcı konumu çemberi */}
          {userLocation && (
            <Circle
              center={userLocation}
              radius={5000}
              fillColor="rgba(59, 130, 246, 0.1)"
              strokeColor="rgba(59, 130, 246, 0.3)"
              strokeWidth={1}
            />
          )}

          {/* İstek marker'ları */}
          {requests.map((request) => (
            <Marker
              key={request.id}
              coordinate={{
                latitude: request.pickup_lat,
                longitude: request.pickup_lng,
              }}
              onPress={() => setSelectedRequest(request)}
            >
              <View style={[
                styles.markerContainer,
                { backgroundColor: getMarkerColor(request) }
              ]}>
                <Ionicons name="person" size={16} color="#FFF" />
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Harita üzerinde bilgi */}
        <View style={styles.mapOverlay}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{requests.length}</Text>
              <Text style={styles.statLabel}>İstek</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#22C55E' }]}>{sentOffers.length}</Text>
              <Text style={styles.statLabel}>Teklif</Text>
            </View>
          </View>
        </View>
      </View>

      {/* İstek Kartları Listesi */}
      <View style={styles.requestsContainer}>
        <Text style={styles.requestsTitle}>
          {requests.length > 0 ? 'Yakındaki İstekler' : 'İstek Bekleniyor...'}
        </Text>
        
        {requests.length > 0 ? (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={renderRequestCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.requestsList}
            snapToInterval={SCREEN_WIDTH * 0.75 + 12}
            decelerationRate="fast"
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Yeni istekler bekleniyor...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 12,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  requestsContainer: {
    backgroundColor: '#FFF',
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  requestsList: {
    paddingHorizontal: 16,
  },
  requestCard: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  requestCardSent: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  sentBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#16A34A',
  },
  cardInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  priceInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingVertical: 10,
    paddingLeft: 4,
  },
  sendOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  sendOfferText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
