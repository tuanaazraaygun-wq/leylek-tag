/**
 * OfferMapScreen - Modern Teklif Ekranı
 * 
 * Hem Yolcu hem Sürücü için kullanılır:
 * - Yolcu: Gelen sürücü tekliflerini görür
 * - Sürücü: Yolcu isteklerini görür ve teklif gönderir
 * 
 * Tasarım: Üstte harita, altta kart listesi
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// react-native-maps
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('Maps not available');
  }
}

// Renkler
const COLORS = {
  primary: '#4CAF50',      // Yeşil
  secondary: '#FFC107',    // Sarı
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  price: '#2E7D32',
  recommended: '#E8F5E9',
  border: '#E0E0E0',
};

// Tek bir teklif/istek kartı
interface OfferItem {
  id: string;
  name: string;
  rating: number;
  vehicle?: string;
  vehicleColor?: string;
  price?: number;
  distanceToUser: number;      // km - kullanıcıya mesafe
  estimatedArrival: number;    // dk - varış süresi
  tripDistance?: number;       // km - yolculuk mesafesi
  tripDuration?: number;       // dk - yolculuk süresi
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLocation?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  isRecommended?: boolean;
  photoUrl?: string;
}

interface OfferMapScreenProps {
  mode: 'passenger' | 'driver';
  userLocation: { latitude: number; longitude: number } | null;
  items: OfferItem[];
  userName: string;
  pickupLocation?: string;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffLocation?: string;
  dropoffCoords?: { latitude: number; longitude: number };
  onAccept?: (itemId: string) => void;
  onSendOffer?: (itemId: string, price: number) => Promise<boolean>;
  onDismiss?: (itemId: string) => void;
  onBack: () => void;
  timeRemaining?: number;  // saniye
}

// Teklif Kartı Bileşeni
function OfferCard({
  item,
  mode,
  index,
  onAccept,
  onSendOffer,
  onDismiss,
}: {
  item: OfferItem;
  mode: 'passenger' | 'driver';
  index: number;
  onAccept?: (id: string) => void;
  onSendOffer?: (id: string, price: number) => Promise<boolean>;
  onDismiss?: (id: string) => void;
}) {
  const [priceInput, setPriceInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, delay: index * 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSendOffer = async () => {
    if (!priceInput || sending || sent || !onSendOffer) return;
    const price = Number(priceInput);
    if (price < 10) return;

    setSending(true);
    const success = await onSendOffer(item.id, price);
    setSending(false);
    if (success) setSent(true);
  };

  const isRecommended = item.isRecommended || index === 0;

  return (
    <Animated.View 
      style={[
        styles.card,
        isRecommended && styles.cardRecommended,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}
    >
      {/* Önerilen Badge */}
      {isRecommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>ÖNERİLEN TEKLİF</Text>
        </View>
      )}

      <View style={styles.cardContent}>
        {/* Sol: Profil ve Bilgiler */}
        <View style={styles.cardLeft}>
          {/* Profil Resmi */}
          <View style={styles.profileContainer}>
            <View style={styles.profileImage}>
              <Ionicons name="person" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.onlineIndicator} />
          </View>

          {/* İsim ve Detaylar */}
          <View style={styles.infoContainer}>
            <Text style={styles.name}>{item.name}</Text>
            
            {/* Yıldız */}
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFC107" />
              <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '5.0'}</Text>
              {item.vehicle && (
                <>
                  <Text style={styles.separator}>|</Text>
                  <Ionicons name="car" size={14} color={COLORS.textSecondary} />
                </>
              )}
            </View>

            {/* Araç */}
            {item.vehicle && (
              <Text style={styles.vehicleText}>{item.vehicle}</Text>
            )}

            {/* Önerilen için ekstra bilgi */}
            {isRecommended && mode === 'passenger' && (
              <View style={styles.recommendedInfo}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                <Text style={styles.recommendedInfoText}>
                  Sana en yakın, makul fiyatlı teklif
                </Text>
              </View>
            )}

            {/* Konum bilgisi - Sürücü için */}
            {mode === 'driver' && item.pickupLocation && (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={14} color={COLORS.primary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.pickupLocation}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Sağ: Fiyat ve Araç Resmi */}
        <View style={styles.cardRight}>
          {mode === 'passenger' && item.price ? (
            <>
              <Text style={styles.price}>{item.price}₺</Text>
              <View style={styles.carImagePlaceholder}>
                <Ionicons name="car-sport" size={40} color="#9E9E9E" />
              </View>
            </>
          ) : mode === 'driver' && !sent ? (
            <View style={styles.priceInputContainer}>
              <TextInput
                style={styles.priceInput}
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="number-pad"
                placeholder="₺"
                placeholderTextColor="#BDBDBD"
              />
              <Text style={styles.currencyLabel}>₺</Text>
            </View>
          ) : sent ? (
            <View style={styles.sentBadge}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              <Text style={styles.sentText}>{priceInput}₺</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Alt Bilgiler */}
      <View style={styles.cardFooter}>
        {/* Mesafe ve Süre Bilgileri */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={14} color={COLORS.primary} />
            <Text style={styles.statText}>{item.estimatedArrival} dk</Text>
          </View>
          <Text style={styles.statDot}>•</Text>
          <View style={styles.statItem}>
            <Text style={styles.statText}>{item.distanceToUser} km</Text>
          </View>
          {item.tripDuration && (
            <>
              <Text style={styles.statDot}>•</Text>
              <View style={styles.statItem}>
                <Text style={styles.statText}>{item.tripDuration} min, {item.tripDistance}km</Text>
              </View>
            </>
          )}
          {item.tripDistance && (
            <View style={styles.tripDistanceBadge}>
              <Ionicons name="swap-horizontal" size={12} color={COLORS.textSecondary} />
              <Text style={styles.tripDistanceText}>{item.tripDistance}km</Text>
            </View>
          )}
        </View>

        {/* Aksiyon Butonları */}
        {mode === 'passenger' && (
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => onAccept?.(item.id)}
          >
            <Text style={styles.acceptButtonText}>Kabul Et</Text>
          </TouchableOpacity>
        )}

        {mode === 'driver' && !sent && (
          <TouchableOpacity 
            style={[styles.sendButton, (!priceInput || sending) && styles.sendButtonDisabled]}
            onPress={handleSendOffer}
            disabled={!priceInput || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#FFF" />
                <Text maxFontSizeMultiplier={1.28} style={styles.sendButtonText}>Teklif Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export default function OfferMapScreen({
  mode,
  userLocation,
  items,
  userName,
  pickupLocation,
  pickupCoords,
  dropoffLocation,
  dropoffCoords,
  onAccept,
  onSendOffer,
  onDismiss,
  onBack,
  timeRemaining = 90,
}: OfferMapScreenProps) {
  const mapRef = useRef<any>(null);
  const [countdown, setCountdown] = useState(timeRemaining);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Haritayı fit et
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    const coords: { latitude: number; longitude: number }[] = [userLocation];
    
    if (pickupCoords) coords.push(pickupCoords);
    if (dropoffCoords) coords.push(dropoffCoords);
    
    items.forEach(item => {
      if (item.pickupLat && item.pickupLng) {
        coords.push({ latitude: item.pickupLat, longitude: item.pickupLng });
      }
    });

    if (coords.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, items.length]);

  // Harita render
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.mapFallback}>
          <Ionicons name="map" size={50} color={COLORS.primary} />
          <Text style={styles.mapFallbackText}>
            {items.length} {mode === 'passenger' ? 'sürücü teklif verdi' : 'yolcu bekliyor'}
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : undefined}
        showsUserLocation={false}
      >
        {/* Kullanıcı konumu */}
        {userLocation && (
          <Marker coordinate={userLocation}>
            <View style={styles.userMarker}>
              <Ionicons name={mode === 'driver' ? 'car' : 'person'} size={20} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Pickup marker (yeşil) */}
        {pickupCoords && (
          <Marker coordinate={pickupCoords}>
            <View style={[styles.locationMarker, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="location" size={16} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Dropoff marker (kırmızı) */}
        {dropoffCoords && (
          <Marker coordinate={dropoffCoords}>
            <View style={[styles.locationMarker, { backgroundColor: '#F44336' }]}>
              <Ionicons name="flag" size={16} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Rota çizgisi */}
        {pickupCoords && dropoffCoords && (
          <Polyline
            coordinates={[pickupCoords, dropoffCoords]}
            strokeColor={COLORS.primary}
            strokeWidth={4}
          />
        )}

        {/* Diğer kullanıcılar (sürücüler veya yolcular) */}
        {items.map((item, index) => (
          item.pickupLat && item.pickupLng && (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.pickupLat, longitude: item.pickupLng }}
            >
              <View style={styles.itemMarkerContainer}>
                <View style={[styles.itemMarker, item.isRecommended && styles.itemMarkerHighlight]}>
                  <Ionicons name={mode === 'passenger' ? 'car' : 'person'} size={14} color="#FFF" />
                </View>
                {item.price && (
                  <View style={styles.priceCallout}>
                    <Text style={styles.priceCalloutText}>{item.price}₺</Text>
                  </View>
                )}
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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Ionicons name={mode === 'passenger' ? 'car' : 'people'} size={20} color={COLORS.secondary} />
          </View>
          <Text style={styles.headerTitle}>
            {items.length} {mode === 'passenger' ? 'sürücü teklif verdi' : 'yolcu bekliyor'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'passenger' ? 'Yeni teklifler geliyor...' : 'Teklif gönder'}
          </Text>
        </View>

        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Harita */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>

      {/* Teklif Listesi */}
      <View style={styles.listContainer}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <OfferCard
              item={item}
              mode={mode}
              index={index}
              onAccept={onAccept}
              onSendOffer={onSendOffer}
              onDismiss={onDismiss}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Zamanlayıcı */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>
            Teklifler {countdown} saniye içinde sona eriyor.
          </Text>
        </View>
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
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  menuButton: {
    padding: 4,
  },

  // Map
  mapContainer: {
    height: SCREEN_HEIGHT * 0.35,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  mapFallbackText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  locationMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  itemMarkerContainer: {
    alignItems: 'center',
  },
  itemMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  itemMarkerHighlight: {
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  priceCallout: {
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  priceCalloutText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.price,
  },

  // List
  listContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 12,
    paddingBottom: 60,
  },
  
  // Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardRecommended: {
    backgroundColor: '#FFFDE7',
    borderWidth: 1,
    borderColor: '#FFF59D',
  },
  recommendedBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  recommendedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  profileContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  infoContainer: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 4,
  },
  separator: {
    marginHorizontal: 6,
    color: COLORS.textSecondary,
  },
  vehicleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  recommendedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  recommendedInfoText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.price,
    marginBottom: 4,
  },
  carImagePlaceholder: {
    width: 70,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  priceInput: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 60,
    textAlign: 'center',
    paddingVertical: 8,
  },
  currencyLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sentBadge: {
    alignItems: 'center',
  },
  sentText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  
  // Card Footer
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  statDot: {
    marginHorizontal: 8,
    color: COLORS.textSecondary,
  },
  tripDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  tripDistanceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Timer
  timerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
