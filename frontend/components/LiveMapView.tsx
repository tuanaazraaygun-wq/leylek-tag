import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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
  } catch (e) {
    console.log('react-native-maps not available:', e);
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
  distance?: number; // km
  estimatedTime?: number; // minutes
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
  // Web veya MapView yok ise
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.placeholderContainer}>
        <Ionicons name="location" size={80} color="#3B82F6" />
        <Text style={styles.placeholderTitle}>🗺️ Canlı Konum Takibi</Text>
        <Text style={styles.placeholderIcon}>{userIcon} {userName}</Text>
        <Text style={styles.placeholderIcon}>{otherIcon} {otherName}</Text>
        {distance && (
          <Text style={styles.placeholderText}>Mesafe: {distance.toFixed(1)} km</Text>
        )}
        {estimatedTime && (
          <Text style={styles.placeholderText}>Tahmini Süre: {estimatedTime} dk</Text>
        )}
        <Text style={styles.placeholderNote}>Mobil uygulamada canlı harita aktif</Text>
      </View>
    );
  }

  // İlk bölge hesapla
  const initialRegion = {
    latitude: userLocation?.latitude || 41.0082,
    longitude: userLocation?.longitude || 28.9784,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={true}
      showsCompass={true}
      showsTraffic={false}
    >
      {/* User Marker */}
      {userLocation && (
        <Marker
          coordinate={userLocation}
          title={userName}
          description="Sen"
        >
          <View style={styles.markerContainer}>
            <Text style={styles.markerIcon}>{userIcon}</Text>
            <View style={styles.markerShadow} />
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
            <Text style={styles.markerIcon}>{otherIcon}</Text>
            <View style={styles.markerShadow} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
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
  placeholderIcon: {
    fontSize: 32,
    marginVertical: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#374151',
    marginTop: 8,
  },
  placeholderNote: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 20,
    fontStyle: 'italic',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    fontSize: 48,
  },
  markerShadow: {
    width: 20,
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    marginTop: -10,
  },
});
