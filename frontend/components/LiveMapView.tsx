import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Conditional import - sadece mobilde
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
    console.log('✅ react-native-maps yüklendi');
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

interface Location {
  latitude: number;
  longitude: number;
}

interface LiveMapViewProps {
  userLocation: Location | null;
  otherLocation: Location | null;
  userIcon: string;
  otherIcon: string;
  userName: string;
  otherName: string;
  distance?: number;
  estimatedTime?: number;
}

export default function LiveMapView({
  userLocation,
  otherLocation,
  userIcon,
  otherIcon,
  userName,
  otherName,
  distance,
  estimatedTime,
}: LiveMapViewProps) {
  
  // Web veya MapView yok ise placeholder göster
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.placeholderContainer}>
        <Ionicons name="location" size={80} color="#3B82F6" />
        <Text style={styles.placeholderTitle}>Canlı Konum Takibi</Text>
        <View style={styles.userRow}>
          <Text style={styles.placeholderIcon}>{userIcon}</Text>
          <Text style={styles.placeholderName}>{userName}</Text>
        </View>
        <View style={styles.userRow}>
          <Text style={styles.placeholderIcon}>{otherIcon}</Text>
          <Text style={styles.placeholderName}>{otherName}</Text>
        </View>
        {distance !== undefined && (
          <Text style={styles.infoText}>📍 Mesafe: {distance.toFixed(1)} km</Text>
        )}
        {estimatedTime !== undefined && (
          <Text style={styles.infoText}>⏱️ Tahmini Süre: {estimatedTime} dk</Text>
        )}
        <Text style={styles.noteText}>
          {Platform.OS === 'web' 
            ? 'Web\'de harita desteklenmiyor' 
            : 'Harita yüklenemedi'}
        </Text>
      </View>
    );
  }

  // Konum yoksa varsayılan kullan (Ankara merkez)
  const defaultLocation = {
    latitude: 39.9334,
    longitude: 32.8597,
  };

  const centerLocation = userLocation || otherLocation || defaultLocation;

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: centerLocation.latitude,
          longitude: centerLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsTraffic={false}
        mapType="standard"
      >
        {/* User Marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title={userName}
            description="Sen"
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerBubble}>
                <Text style={styles.markerIcon}>{userIcon}</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Other Person Marker */}
        {otherLocation && (
          <Marker
            coordinate={otherLocation}
            title={otherName}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerBubble, styles.otherBubble]}>
                <Text style={styles.markerIcon}>{otherIcon}</Text>
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Info Overlay */}
      <View style={styles.infoOverlay}>
        {distance !== undefined && (
          <View style={styles.infoBadge}>
            <Ionicons name="navigate" size={16} color="#FFF" />
            <Text style={styles.infoBadgeText}>{distance.toFixed(1)} km</Text>
          </View>
        )}
        {estimatedTime !== undefined && (
          <View style={styles.infoBadge}>
            <Ionicons name="time" size={16} color="#FFF" />
            <Text style={styles.infoBadgeText}>{estimatedTime} dk</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  placeholderIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  placeholderName: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    marginTop: 12,
  },
  noteText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 20,
    fontStyle: 'italic',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  otherBubble: {
    backgroundColor: '#10B981',
  },
  markerIcon: {
    fontSize: 24,
  },
  infoOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    gap: 10,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  infoBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
