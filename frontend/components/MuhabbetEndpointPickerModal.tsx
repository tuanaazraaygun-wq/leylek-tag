/**
 * Muhabbet teklif uç noktası: ana uygulamadaki yolcu hedef akışıyla aynı mantık
 * (PlacesAutocomplete → haritada pin → "Tam burası" → ters geokod).
 * GMS yoksa arama sonucu doğrudan onaylanır.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PlacesAutocomplete, {
  buildMuhabbetQuickPickSuggestions,
  getRegisteredCityCenter,
  isLatLngWithinRegisteredCity,
  type PlaceDetails,
} from './PlacesAutocomplete';
import { DEFAULT_TR_MAP_FALLBACK_CENTER } from '../lib/mapDefaults';
import { isNativeGoogleMapsSupported } from '../lib/nativeGoogleMaps';
import { tapButtonHaptic } from '../utils/touchHaptics';

let EndpointMapView: React.ComponentType<any> | null = null;
let EndpointMapProvider: string | undefined;
if (Platform.OS !== 'web') {
  try {
    const M = require('react-native-maps');
    EndpointMapView = M.default;
    EndpointMapProvider = M.PROVIDER_GOOGLE;
  } catch {
    EndpointMapView = null;
  }
}

const SEARCH_DELTA = 0.11;
const PIN_DELTA = 0.026;

export type MuhabbetCommittedPlace = PlaceDetails & { mapPinConfirmed: boolean };

export type MuhabbetIntercityPairPayload = {
  pickup: MuhabbetCommittedPlace;
  dropoff: MuhabbetCommittedPlace;
  originCity: string;
  destinationCity: string;
};

type MuhabbetIntercityPreset = {
  label: string;
  originCity: string;
  destinationCity: string;
  pickup: { address: string; latitude: number; longitude: number };
  dropoff: { address: string; latitude: number; longitude: number };
};

const IST_AVRUPA_COORD = { latitude: 41.0369, longitude: 28.985 };
const IST_ANADOLU_COORD = { latitude: 40.9903, longitude: 29.0266 };

function buildMuhabbetIntercityPresets(): MuhabbetIntercityPreset[] {
  const ank = getRegisteredCityCenter('Ankara');
  const ist = getRegisteredCityCenter('İstanbul');
  const izm = getRegisteredCityCenter('İzmir');
  const ada = getRegisteredCityCenter('Adana');
  const ant = getRegisteredCityCenter('Antalya');
  const bur = getRegisteredCityCenter('Bursa');
  if (!ank || !ist || !izm || !ada || !ant || !bur) return [];
  return [
    {
      label: 'Ankara → İstanbul (Avrupa)',
      originCity: 'Ankara',
      destinationCity: 'İstanbul',
      pickup: { address: 'Ankara Merkez', ...ank },
      dropoff: { address: 'İstanbul (Avrupa Yakası)', ...IST_AVRUPA_COORD },
    },
    {
      label: 'İstanbul (Avrupa) → Ankara',
      originCity: 'İstanbul',
      destinationCity: 'Ankara',
      pickup: { address: 'İstanbul (Avrupa Yakası)', ...IST_AVRUPA_COORD },
      dropoff: { address: 'Ankara Merkez', ...ank },
    },
    {
      label: 'İstanbul (Anadolu) → Ankara',
      originCity: 'İstanbul',
      destinationCity: 'Ankara',
      pickup: { address: 'İstanbul (Anadolu Yakası)', ...IST_ANADOLU_COORD },
      dropoff: { address: 'Ankara Merkez', ...ank },
    },
    {
      label: 'Ankara → İzmir',
      originCity: 'Ankara',
      destinationCity: 'İzmir',
      pickup: { address: 'Ankara Merkez', ...ank },
      dropoff: { address: 'İzmir Merkez', ...izm },
    },
    {
      label: 'Ankara → Adana',
      originCity: 'Ankara',
      destinationCity: 'Adana',
      pickup: { address: 'Ankara Merkez', ...ank },
      dropoff: { address: 'Adana Merkez', ...ada },
    },
    {
      label: 'Ankara → Antalya',
      originCity: 'Ankara',
      destinationCity: 'Antalya',
      pickup: { address: 'Ankara Merkez', ...ank },
      dropoff: { address: 'Antalya Merkez', ...ant },
    },
    {
      label: 'İstanbul → Bursa',
      originCity: 'İstanbul',
      destinationCity: 'Bursa',
      pickup: { address: 'İstanbul Merkez', ...ist },
      dropoff: { address: 'Bursa Merkez', ...bur },
    },
  ];
}

/** Harita + Tam burası akışı bu cihazda mümkün mü (GMS + native). */
export function muhabbetListingMapPinFlowAvailable(): boolean {
  return !!EndpointMapView && isNativeGoogleMapsSupported();
}

/** OSM Nominatim ters geokod — teklif formu “Konumum” ile paylaşılır */
export async function reverseGeocodeTr(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=tr`;
  const response = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
  const data = (await response.json().catch(() => ({}))) as { display_name?: string };
  return (data.display_name && String(data.display_name).trim()) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export type MuhabbetEndpointPickerModalProps = {
  visible: boolean;
  title: string;
  city: string;
  cityContext?: string;
  /** Arama / harita önerilerini yakınlaştırmak için (opsiyonel) */
  biasLatitude?: number;
  biasLongitude?: number;
  onRequestClose: () => void;
  onCommitted: (place: MuhabbetCommittedPlace) => void;
  /** Şehirler arası ilan: tek dokunuşla iki ucu ve şehir alanlarını doldurur */
  intercityPresetsEnabled?: boolean;
  onIntercityPairCommitted?: (payload: MuhabbetIntercityPairPayload) => void;
};

export default function MuhabbetEndpointPickerModal({
  visible,
  title,
  city,
  cityContext,
  biasLatitude,
  biasLongitude,
  onRequestClose,
  onCommitted,
  intercityPresetsEnabled = false,
  onIntercityPairCommitted,
}: MuhabbetEndpointPickerModalProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);
  const mapCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const cityLookupGenRef = useRef(0);
  const [phase, setPhase] = useState<'search' | 'map'>('search');
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [acMountKey, setAcMountKey] = useState(0);
  const [resolvedCityCenter, setResolvedCityCenter] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  const cityTrim = (cityContext || city || '').trim();

  const inferredCityFromMapBias = useMemo(() => {
    if (cityTrim) return '';
    const lat = biasLatitude;
    const lng = biasLongitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return '';
    }
    return isLatLngWithinRegisteredCity('Ankara', lat, lng) ? 'Ankara' : '';
  }, [cityTrim, biasLatitude, biasLongitude]);

  const effectiveCityLabel = (cityTrim || inferredCityFromMapBias || '').trim();

  const staticCityCenter = useMemo(() => getRegisteredCityCenter(effectiveCityLabel), [effectiveCityLabel]);
  const effectiveCityCenter = staticCityCenter ?? resolvedCityCenter;
  const searchBiasLatitude = effectiveCityCenter?.latitude ?? biasLatitude;
  const searchBiasLongitude = effectiveCityCenter?.longitude ?? biasLongitude;
  const muhabbetQuickPicks = useMemo(() => buildMuhabbetQuickPickSuggestions(effectiveCityLabel), [effectiveCityLabel]);
  const intercityPresets = useMemo(() => buildMuhabbetIntercityPresets(), []);
  const useMap = !!EndpointMapView && isNativeGoogleMapsSupported();

  const onIntercityPresetPress = useCallback(
    (preset: MuhabbetIntercityPreset) => {
      if (!onIntercityPairCommitted) return;
      void tapButtonHaptic();
      onIntercityPairCommitted({
        pickup: { ...preset.pickup, mapPinConfirmed: false },
        dropoff: { ...preset.dropoff, mapPinConfirmed: false },
        originCity: preset.originCity,
        destinationCity: preset.destinationCity,
      });
      onRequestClose();
    },
    [onIntercityPairCommitted, onRequestClose],
  );

  const intercitySlot =
    intercityPresetsEnabled && onIntercityPairCommitted && intercityPresets.length > 0 ? (
      <View style={[styles.quickPickWrapTech, styles.intercitySection]}>
        <Text style={styles.quickPickTitleTech}>Şehirden Şehire</Text>
        <View style={styles.quickPickGrid}>
          {intercityPresets.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={[styles.quickPickChipTech, styles.intercityChip]}
              activeOpacity={0.85}
              onPress={() => onIntercityPresetPress(p)}
            >
              <Text style={styles.quickPickChipTextTech} numberOfLines={2}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    ) : null;

  const reset = useCallback(() => {
    setPhase('search');
    setPin(null);
    mapCenterRef.current = null;
    setGeocoding(false);
  }, []);

  /** CITY_DATA dışı şehirler: harita/bias Ankara fallback'e düşmesin diye Nominatim ile merkez çöz */
  useEffect(() => {
    if (!visible || !effectiveCityLabel) {
      cityLookupGenRef.current += 1;
      setResolvedCityCenter(null);
      return;
    }
    if (staticCityCenter) {
      cityLookupGenRef.current += 1;
      setResolvedCityCenter(null);
      return;
    }
    const gen = ++cityLookupGenRef.current;
    void (async () => {
      try {
        const q = encodeURIComponent(`${effectiveCityLabel}, Türkiye`);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
        const response = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
        const data = (await response.json()) as { lat?: string; lon?: string }[];
        if (gen !== cityLookupGenRef.current) return;
        const row = Array.isArray(data) ? data[0] : undefined;
        const lat = Number(row?.lat);
        const lng = Number(row?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setResolvedCityCenter({ latitude: lat, longitude: lng });
        } else {
          setResolvedCityCenter(null);
        }
      } catch {
        if (gen === cityLookupGenRef.current) setResolvedCityCenter(null);
      }
    })();
  }, [visible, effectiveCityLabel, staticCityCenter]);

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }
    setAcMountKey((k) => k + 1);
    const lat = effectiveCityCenter?.latitude ?? DEFAULT_TR_MAP_FALLBACK_CENTER.latitude;
    const lng = effectiveCityCenter?.longitude ?? DEFAULT_TR_MAP_FALLBACK_CENTER.longitude;
    setPin({ latitude: lat, longitude: lng });
  }, [visible, effectiveCityLabel, effectiveCityCenter?.latitude, effectiveCityCenter?.longitude, reset]);

  useEffect(() => {
    if (!visible || phase !== 'search' || !pin) return;
    const t = setTimeout(() => {
      try {
        mapRef.current?.animateToRegion?.(
          {
            latitude: pin.latitude,
            longitude: pin.longitude,
            latitudeDelta: SEARCH_DELTA,
            longitudeDelta: SEARCH_DELTA,
          },
          420,
        );
      } catch {
        /* ignore */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [visible, phase, pin?.latitude, pin?.longitude]);

  useEffect(() => {
    if (phase === 'map' && pin) {
      mapCenterRef.current = { latitude: pin.latitude, longitude: pin.longitude };
    }
  }, [phase, pin]);

  const finalizeCommit = useCallback(
    async (address: string, lat: number, lng: number, mapPinConfirmed: boolean) => {
      if (!isLatLngWithinRegisteredCity(effectiveCityLabel, lat, lng)) {
        Alert.alert(
          'Şehir sınırı',
          'Seçim yalnızca seçili şehir içinde olabilir. Lütfen haritada veya aramada şehir içi bir nokta seçin.',
        );
        return;
      }
      await tapButtonHaptic();
      onCommitted({
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        mapPinConfirmed,
      });
      onRequestClose();
    },
    [effectiveCityLabel, onCommitted, onRequestClose],
  );

  const onSearchPick = useCallback(
    (place: PlaceDetails) => {
      void tapButtonHaptic();
      const lat = Number(place.latitude);
      const lng = Number(place.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (!isLatLngWithinRegisteredCity(effectiveCityLabel, lat, lng)) {
        Alert.alert('Şehir sınırı', 'Bu öneri seçili şehir dışında görünüyor. Şehir içi bir adres seçin.');
        return;
      }
      if (!useMap) {
        void finalizeCommit(place.address, lat, lng, false);
        return;
      }
      setPhase('map');
      setPin({ latitude: lat, longitude: lng });
      requestAnimationFrame(() => {
        try {
          mapRef.current?.animateToRegion?.(
            { latitude: lat, longitude: lng, latitudeDelta: PIN_DELTA, longitudeDelta: PIN_DELTA },
            420,
          );
        } catch {
          /* ignore */
        }
      });
    },
    [effectiveCityLabel, finalizeCommit, useMap],
  );

  const onRegionComplete = useCallback((region: { latitude: number; longitude: number }) => {
    if (phase === 'map') {
      mapCenterRef.current = { latitude: region.latitude, longitude: region.longitude };
    }
  }, [phase]);

  const confirmMapCenter = useCallback(async () => {
    const c = mapCenterRef.current;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) {
      Alert.alert('Harita', 'Konum hazırlanıyor; kısa süre sonra tekrar deneyin.');
      return;
    }
    setGeocoding(true);
    try {
      await tapButtonHaptic();
      const address = await reverseGeocodeTr(c.latitude, c.longitude);
      await finalizeCommit(address, c.latitude, c.longitude, true);
    } catch {
      Alert.alert('Hata', 'Adres okunamadı. Haritayı kaydırıp tekrar deneyin.');
    } finally {
      setGeocoding(false);
    }
  }, [finalizeCommit]);

  const mapLat = pin?.latitude ?? DEFAULT_TR_MAP_FALLBACK_CENTER.latitude;
  const mapLng = pin?.longitude ?? DEFAULT_TR_MAP_FALLBACK_CENTER.longitude;
  const delta = phase === 'search' ? SEARCH_DELTA : PIN_DELTA;

  const endpointSearchPanel = (
    <View style={styles.panel} pointerEvents="auto">
      <Text style={styles.hero}>{title}</Text>
      <Text style={styles.subHero}>Adres ara, listeden seç; haritada konumu doğrula.</Text>
      {!useMap ? (
        <Text style={styles.gmsHint}>
          Bu cihazda harita doğrulaması yok; listeden seçtiğiniz adres doğrudan kullanılır.
        </Text>
      ) : null}
      <View style={styles.searchShell}>
        <PlacesAutocomplete
          key={acMountKey}
          placeholder="Mahalle, sokak, mekan ara…"
          city={effectiveCityLabel}
          hidePopularChips
          visualVariant="tech"
          suggestionsFirst={false}
          strictCityBounds={!!effectiveCityLabel}
          biasLatitude={searchBiasLatitude}
          biasLongitude={searchBiasLongitude}
          biasDeltaDeg={0.22}
          inputSize="large"
          predictionMaxHeightBonus={56}
          forceCityInSearch={!!effectiveCityLabel}
          slotAboveQuickPicks={intercitySlot}
          quickPickSuggestions={muhabbetQuickPicks}
          onPlaceSelected={onSearchPick}
        />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onRequestClose}>
      <View style={styles.root}>
        {EndpointMapView && useMap ? (
          <EndpointMapView
            key={`endpoint-map-${effectiveCityLabel}-${acMountKey}`}
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={EndpointMapProvider}
            mapType="standard"
            showsUserLocation={!!biasLatitude && !!biasLongitude}
            showsMyLocationButton={false}
            scrollEnabled
            zoomEnabled
            pitchEnabled={Platform.OS !== 'android'}
            rotateEnabled={Platform.OS !== 'android'}
            initialRegion={{
              latitude: mapLat,
              longitude: mapLng,
              latitudeDelta: delta,
              longitudeDelta: delta,
            }}
            onRegionChangeComplete={onRegionComplete}
          />
        ) : (
          <LinearGradient
            colors={['#0c4a6e', '#075985', '#0369a1']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {useMap && phase === 'map' ? (
          <View style={styles.crosshairWrap} pointerEvents="none">
            <View style={styles.crosshairPinShift}>
              <View style={styles.pinCore}>
                <Ionicons name="location" size={36} color="#FFF" />
              </View>
            </View>
          </View>
        ) : null}

        {phase === 'search' ? (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(6, 32, 58, 0.82)', 'rgba(6, 32, 58, 0.38)', 'transparent']}
            locations={[0, 0.38, 1]}
            style={styles.topFade}
          />
        ) : (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.12)', 'transparent']}
            locations={[0, 0.25, 1]}
            style={styles.topFadeLight}
          />
        )}

        <View style={styles.touchLayer} pointerEvents="box-none">
          <SafeAreaView style={styles.safeOverlay} pointerEvents="box-none" edges={['top', 'left', 'right']}>
            <View style={[styles.header, phase === 'map' && styles.headerDim]} pointerEvents="auto">
              <TouchableOpacity onPress={onRequestClose} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {phase === 'map' ? (
                  <TouchableOpacity
                    onPress={() => {
                      void tapButtonHaptic();
                      setPhase('search');
                    }}
                    style={styles.changeAreaBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.changeAreaText} numberOfLines={1}>
                      Mahalle / sokak değiştir
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {title}
                  </Text>
                )}
              </View>
              <View style={{ width: 40 }} />
            </View>

            {phase === 'search' ? (
              Platform.OS === 'android' ? (
                <View style={styles.kb}>{endpointSearchPanel}</View>
              ) : (
                <KeyboardAvoidingView behavior="padding" style={styles.kb} keyboardVerticalOffset={6}>
                  {endpointSearchPanel}
                </KeyboardAvoidingView>
              )
            ) : null}
          </SafeAreaView>
        </View>

        {phase === 'map' && useMap ? (
          <View style={[styles.confirmWrap, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]} pointerEvents="box-none">
            <Text style={styles.mapHint}>Haritayı sürükleyerek konumu ayarlayın</Text>
            <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.88} onPress={() => void confirmMapCenter()}>
              <Text style={styles.confirmBtnText}>Tam burası</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {geocoding ? (
          <View style={styles.geoOverlay}>
            <ActivityIndicator size="large" color="#E0F2FE" />
            <Text style={styles.geoText}>Adres alınıyor…</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c4a6e' },
  crosshairWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairPinShift: { marginBottom: 44 },
  pinCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59,130,246,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  topFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 220,
  },
  topFadeLight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 160,
  },
  touchLayer: { flex: 1 },
  safeOverlay: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  headerDim: { backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  changeAreaBtn: {
    maxWidth: '88%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  changeAreaText: { color: '#E0F2FE', fontSize: 14, fontWeight: '600' },
  kb: { flex: 1 },
  panel: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  hero: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  subHero: { fontSize: 14, color: 'rgba(224,242,254,0.88)', lineHeight: 20, marginBottom: 10 },
  gmsHint: { fontSize: 13, color: 'rgba(254,243,199,0.95)', marginBottom: 8, lineHeight: 18 },
  searchShell: { marginTop: 4 },
  confirmWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  mapHint: { color: '#E2E8F0', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    minWidth: 200,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  geoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  geoText: { marginTop: 12, color: '#E0F2FE', fontSize: 15, fontWeight: '600' },
  quickPickWrapTech: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  intercitySection: {
    marginBottom: 0,
  },
  quickPickTitleTech: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 10,
  },
  quickPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPickChipTech: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    maxWidth: '100%',
  },
  intercityChip: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  quickPickChipTextTech: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E0F2FE',
  },
});
