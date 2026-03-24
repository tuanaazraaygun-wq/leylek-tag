/**
 * DriverActivityMap - Sürücü Aktivite Haritası
 * Yakındaki aktif yolculukları ve yoğunluk bölgelerini gösterir
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = 220;

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://leylektag-debug.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

interface NearbyTag {
  id: string;
  lat: number;
  lng: number;
  location: string;
  price: number;
  distance_km: number;
}

interface BusyRegion {
  name: string;
  count: number;
  message: string;
}

interface ActivityData {
  nearby_tags: NearbyTag[];
  nearby_tag_count: number;
  nearby_driver_count: number;
  busy_regions: BusyRegion[];
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  city: string;
  /** Verilirse yakındaki talepler yalnız bu sürücünün araç tipiyle eşleşenler (backend filtre) */
  driverUserId?: string | null;
}

export default function DriverActivityMap({ userLocation, city, driverUserId }: Props) {
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Aktivite verilerini yükle
  const loadActivity = async () => {
    if (!userLocation) return;
    
    setLoading(true);
    try {
      const uidQ =
        driverUserId && String(driverUserId).trim()
          ? `&user_id=${encodeURIComponent(String(driverUserId).trim())}`
          : '';
      const response = await fetch(
        `${API_URL}/driver/nearby-activity?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=20${uidQ}`
      );
      const data = await response.json();
      
      if (data.success) {
        setActivityData(data);
      }
    } catch (error) {
      console.log('Activity load error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadActivity();
    
    // Her 15 saniyede bir güncelle
    const interval = setInterval(loadActivity, 15000);
    return () => clearInterval(interval);
  }, [userLocation, driverUserId]);

  if (!userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F97316" />
          <Text style={styles.loadingText}>Konum alınıyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Harita */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          customMapStyle={darkMapStyle}
        >
          {/* 20 km yarıçap çemberi */}
          <Circle
            center={userLocation}
            radius={20000}
            strokeColor="rgba(249, 115, 22, 0.3)"
            fillColor="rgba(249, 115, 22, 0.1)"
            strokeWidth={1}
          />
          
          {/* Aktif yolculuk noktaları */}
          {activityData?.nearby_tags.map((tag) => (
            <Marker
              key={tag.id}
              coordinate={{ latitude: tag.lat, longitude: tag.lng }}
              title={`₺${tag.price}`}
              description={tag.location}
            >
              <View style={styles.tagMarker}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
            </Marker>
          ))}
        </MapView>
        
        {/* Yenile butonu */}
        <TouchableOpacity style={styles.refreshButton} onPress={loadActivity}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="refresh" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      
      {/* İstatistikler */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#F97316' }]}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.statValue}>{activityData?.nearby_tag_count || 0}</Text>
            <Text style={styles.statLabel}>Bekleyen Yolcu</Text>
          </View>
        </View>
        
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}>
            <Ionicons name="car" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.statValue}>{activityData?.nearby_driver_count || 0}</Text>
            <Text style={styles.statLabel}>Online Sürücü</Text>
          </View>
        </View>
      </View>
      
      {/* Yoğun bölgeler */}
      {activityData?.busy_regions && activityData.busy_regions.length > 0 && (
        <View style={styles.busyRegionsContainer}>
          {activityData.busy_regions.slice(0, 2).map((region, index) => (
            <View key={index} style={styles.busyRegion}>
              <Ionicons name="flame" size={14} color="#EF4444" />
              <Text style={styles.busyRegionText}>{region.message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  loadingContainer: {
    height: MAP_HEIGHT,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  refreshButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  busyRegionsContainer: {
    marginTop: 10,
    gap: 6,
  },
  busyRegion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  busyRegionText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
