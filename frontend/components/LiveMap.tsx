import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Only import on mobile
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
    console.log('MapView not available');
  }
}

interface LiveMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  otherLocation: { latitude: number; longitude: number } | null;
  userIcon: string;
  otherIcon: string;
  userName: string;
  otherName: string;
}

export default function LiveMap({ 
  userLocation, 
  otherLocation, 
  userIcon, 
  otherIcon, 
  userName, 
  otherName 
}: LiveMapProps) {
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webMapPlaceholder}>
        <Text style={styles.webMapText}>🗺️ Harita</Text>
        <Text style={styles.webMapSubtext}>Web preview'da harita desteklenmiyor</Text>
        <Text style={styles.webMapSubtext}>Mobilde tam çalışır</Text>
      </View>
    );
  }

  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: userLocation?.latitude || 41.0082,
        longitude: userLocation?.longitude || 28.9784,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation={true}
      showsMyLocationButton={true}
    >
      {/* User Marker */}
      {userLocation && (
        <Marker
          coordinate={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          }}
          title={userName}
          description="Sen"
        >
          <View style={styles.markerContainer}>
            <Text style={styles.markerIcon}>{userIcon}</Text>
          </View>
        </Marker>
      )}
      
      {/* Other Person Marker */}
      {otherLocation && (
        <Marker
          coordinate={{
            latitude: otherLocation.latitude,
            longitude: otherLocation.longitude,
          }}
          title={otherName}
        >
          <View style={styles.markerContainer}>
            <Text style={styles.markerIcon}>{otherIcon}</Text>
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
  webMapPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webMapText: {
    fontSize: 32,
    marginBottom: 8,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    fontSize: 40,
  },
});
