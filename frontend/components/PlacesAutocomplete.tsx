import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Türkiye şehirlerinin koordinatları ve bounding box'ları
const CITY_DATA: { [key: string]: { lat: number; lng: number; bbox: string } } = {
  'İstanbul': { lat: 41.0082, lng: 28.9784, bbox: '28.5,40.8,29.9,41.7' },
  'Ankara': { lat: 39.9334, lng: 32.8597, bbox: '32.2,39.5,33.5,40.4' },
  'İzmir': { lat: 38.4237, lng: 27.1428, bbox: '26.5,38.0,27.8,39.0' },
  'Bursa': { lat: 40.1885, lng: 29.0610, bbox: '28.4,39.8,30.0,40.6' },
  'Antalya': { lat: 36.8969, lng: 30.7133, bbox: '29.8,36.1,32.5,37.5' },
  'Adana': { lat: 37.0000, lng: 35.3213, bbox: '34.5,36.5,36.2,38.0' },
  'Konya': { lat: 37.8746, lng: 32.4932, bbox: '31.5,36.8,34.5,38.8' },
  'Gaziantep': { lat: 37.0662, lng: 37.3833, bbox: '36.5,36.5,38.2,37.8' },
  'Şanlıurfa': { lat: 37.1591, lng: 38.7969, bbox: '38.0,36.5,40.5,38.0' },
  'Kocaeli': { lat: 40.8533, lng: 29.8815, bbox: '29.3,40.5,30.5,41.2' },
  'Mersin': { lat: 36.8000, lng: 34.6333, bbox: '33.5,36.0,35.5,37.5' },
  'Diyarbakır': { lat: 37.9144, lng: 40.2306, bbox: '39.5,37.3,41.2,38.8' },
  'Hatay': { lat: 36.4018, lng: 36.3498, bbox: '35.5,35.8,37.0,37.0' },
  'Manisa': { lat: 38.6191, lng: 27.4289, bbox: '27.0,38.2,28.5,39.2' },
  'Kayseri': { lat: 38.7312, lng: 35.4787, bbox: '34.5,38.0,36.5,39.5' },
  'Samsun': { lat: 41.2867, lng: 36.3300, bbox: '35.5,40.8,37.2,41.8' },
  'Balıkesir': { lat: 39.6484, lng: 27.8826, bbox: '27.0,39.0,29.0,40.5' },
  'Kahramanmaraş': { lat: 37.5858, lng: 36.9371, bbox: '36.2,37.0,37.8,38.3' },
  'Van': { lat: 38.4891, lng: 43.4089, bbox: '42.5,37.8,44.5,39.5' },
  'Aydın': { lat: 37.8560, lng: 27.8416, bbox: '27.0,37.3,28.8,38.5' },
  'Denizli': { lat: 37.7765, lng: 29.0864, bbox: '28.5,37.2,30.0,38.3' },
  'Sakarya': { lat: 40.7569, lng: 30.3780, bbox: '29.8,40.3,31.0,41.2' },
  'Tekirdağ': { lat: 40.9833, lng: 27.5167, bbox: '26.5,40.5,28.5,41.5' },
  'Muğla': { lat: 37.2153, lng: 28.3636, bbox: '27.5,36.5,29.5,37.8' },
  'Eskişehir': { lat: 39.7767, lng: 30.5206, bbox: '29.8,39.0,31.5,40.5' },
  'Mardin': { lat: 37.3212, lng: 40.7245, bbox: '40.0,36.8,41.5,37.8' },
  'Trabzon': { lat: 41.0027, lng: 39.7168, bbox: '38.8,40.5,40.5,41.5' },
  'Malatya': { lat: 38.3552, lng: 38.3095, bbox: '37.5,37.8,39.2,38.9' },
  'Erzurum': { lat: 39.9043, lng: 41.2679, bbox: '40.3,39.3,42.5,40.5' },
};

/** Kayıtlı şehir adı CITY_DATA anahtarıyla birebir olmayabilir (büyük/küçük harf vb.) */
function resolveCityDataKey(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (CITY_DATA[t]) return t;
  const lower = t.toLocaleLowerCase('tr-TR');
  for (const k of Object.keys(CITY_DATA)) {
    if (k.toLocaleLowerCase('tr-TR') === lower) return k;
  }
  return null;
}

/** Kayıtlı şehir adı → harita merkezi (`app/index` hedef seçici). CITY_DATA ile aynı eşleme kuralları. */
export function getRegisteredCityCenter(
  raw: string,
): { latitude: number; longitude: number } | null {
  const key = resolveCityDataKey(raw);
  if (!key) return null;
  const d = CITY_DATA[key];
  return { latitude: d.lat, longitude: d.lng };
}

// Mahalle popüler aramaları - her şehir için
const POPULAR_PLACES: { [key: string]: string[] } = {
  'İstanbul': ['Kadıköy', 'Beşiktaş', 'Şişli', 'Bakırköy', 'Ümraniye', 'Üsküdar', 'Fatih', 'Beyoğlu', 'Ataşehir', 'Maltepe'],
  'Ankara': ['Çankaya', 'Keçiören', 'Mamak', 'Yenimahalle', 'Etimesgut', 'Sincan', 'Altındağ', 'Pursaklar', 'Gölbaşı', 'Batıkent'],
  'İzmir': ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Bayraklı', 'Çiğli', 'Alsancak', 'Narlıdere', 'Gaziemir', 'Balçova'],
  'Bursa': ['Osmangazi', 'Yıldırım', 'Nilüfer', 'Mudanya', 'Gemlik', 'İnegöl', 'Görükle', 'Kestel'],
  'Antalya': ['Muratpaşa', 'Kepez', 'Konyaaltı', 'Lara', 'Alanya', 'Manavgat', 'Side', 'Belek'],
};

interface PlaceResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance?: number;
  address?: {
    neighbourhood?: string;
    suburb?: string;
    district?: string;
    city?: string;
    town?: string;
    road?: string;
  };
}

interface PlaceDetails {
  address: string;
  latitude: number;
  longitude: number;
}

/** Sokak / cadde / mahalle önceliği — hedef aramada üstte göster */
function nominatimStreetRank(item: PlaceResult): number {
  const t = (item.type || '').toLowerCase();
  const dn = item.display_name || '';
  const roadHint =
    /\b(sokak|sokağı|cadde|caddesi|bulvar|bulvarı|mah\.?|mahalle|sk\.|cd\.)\b/i.test(dn) ||
    !!(item.address?.road);
  if (t === 'house' || t === 'building') return 0;
  if (roadHint || t === 'road' || t === 'residential' || t === 'living_street') return 1;
  if (t === 'neighbourhood' || t === 'suburb' || t === 'quarter') return 2;
  if (t === 'village' || t === 'hamlet' || t === 'farm') return 3;
  if (t === 'town' || t === 'city' || t === 'administrative') return 8;
  return 4;
}

/** Liste ve çipler için tek yerden layout — küçük ekranda sıkışmayı azaltır */
const LAYOUT = {
  inputMinHeight: 52,
  predictionListMin: 200,
  predictionListMax: 380,
  /** Ekran yüksekliğinin oranı (öneri listesi tavanı) */
  predictionMaxHeightRatio: 0.42,
  popularChipMinHeight: 40,
} as const;

interface PlacesAutocompleteProps {
  placeholder?: string;
  onPlaceSelected: (place: PlaceDetails) => void;
  initialValue?: string;
  city?: string;
  /** true: ilçe/mahalle popüler çipleri gösterme (hedef seçim modalı) */
  hidePopularChips?: boolean;
  /** Hedef modalı: koyu cam / neon çerçeve */
  visualVariant?: 'default' | 'tech';
  /** Öneri listesi arama kutusunun üstünde (yukarı doğru açılır) */
  suggestionsFirst?: boolean;
  /** Daha fazla sonuç; şehir viewbox sınırı gevşetilir */
  widerSearch?: boolean;
  /** true: şehir biliniyorsa her zaman viewbox ile sınırla (hedef seçim — tüm TR önerilerini kes) */
  strictCityBounds?: boolean;
  /** Hedef modalı: arama kutusu daha yüksek */
  inputSize?: 'default' | 'large';
  /** Öneri listesi tavanına eklenecek piksel */
  predictionMaxHeightBonus?: number;
}

export default function PlacesAutocomplete({
  placeholder = 'Mahalle, sokak veya mekan ara...',
  onPlaceSelected,
  initialValue = '',
  city = '',
  hidePopularChips = false,
  visualVariant = 'default',
  suggestionsFirst = false,
  widerSearch = false,
  strictCityBounds = false,
  inputSize = 'default',
  predictionMaxHeightBonus = 0,
}: PlacesAutocompleteProps) {
  const { height: windowHeight } = useWindowDimensions();
  const tech = visualVariant === 'tech';
  const ratio = tech ? Math.min(0.55, LAYOUT.predictionMaxHeightRatio + 0.14) : LAYOUT.predictionMaxHeightRatio;
  const predictionsMaxHeight = Math.round(
    Math.max(
      LAYOUT.predictionListMin,
      Math.min(
        LAYOUT.predictionListMax + (tech ? 100 : 0) + predictionMaxHeightBonus,
        windowHeight * ratio + predictionMaxHeightBonus,
      ),
    ),
  );
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showPopular, setShowPopular] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      setShowPopular(true);
      return;
    }

    setShowPopular(false);
    debounceRef.current = setTimeout(() => {
      searchPlaces(query);
    }, widerSearch ? 220 : 280);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, widerSearch, city, strictCityBounds]);

  // Nominatim API ile arama (ÜCRETSİZ)
  const searchPlaces = async (input: string) => {
    setLoading(true);
    try {
      const cityKey = resolveCityDataKey(city);
      const cityData = cityKey ? CITY_DATA[cityKey] : null;
      const cityLabel = cityKey || city.trim();

      // Arama sorgusunu hazırla
      let searchQuery = input;
      if (cityLabel && !input.toLowerCase().includes(cityLabel.toLowerCase())) {
        searchQuery = `${input}, ${cityLabel}`;
      }
      
      // Nominatim API - OpenStreetMap ücretsiz servisi
      const limit = widerSearch && !strictCityBounds ? 20 : strictCityBounds ? 15 : 10;
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tr&addressdetails=1&limit=${limit}&accept-language=tr`;
      
      const useBbox = cityData && (!widerSearch || strictCityBounds);
      if (useBbox) {
        url += `&viewbox=${cityData.bbox}&bounded=1`;
      }
      
      console.log('🔍 Nominatim arama:', searchQuery);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LeylekTAG-App/1.0'
        }
      });
      
      const data: PlaceResult[] = await response.json();
      
      console.log('📍 Nominatim sonuç:', data.length, 'adet');
      
      if (data && data.length > 0) {
        const cityNeedle = cityLabel
          ? cityLabel.toLocaleLowerCase('tr-TR')
          : '';
        // Sonuçları filtrele ve formatla
        let filtered = data.filter(item => {
          // Ülke, il gibi çok geniş sonuçları çıkar
          return !['country', 'state', 'county'].includes(item.type);
        });
        if (strictCityBounds && cityNeedle) {
          filtered = filtered.filter((item) =>
            item.display_name.toLocaleLowerCase('tr-TR').includes(cityNeedle),
          );
        }

        filtered.sort((a, b) => {
          const ra = nominatimStreetRank(a);
          const rb = nominatimStreetRank(b);
          if (ra !== rb) return ra - rb;
          const ia = typeof a.importance === 'number' ? a.importance : 0;
          const ib = typeof b.importance === 'number' ? b.importance : 0;
          if (ib !== ia) return ib - ia;
          return 0;
        });

        setPredictions(filtered);
        setShowPredictions(true);
      } else {
        setPredictions([]);
        setShowPredictions(false);
      }
    } catch (error) {
      console.error('Nominatim hatası:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  // Sonuç formatla
  const formatAddress = (item: PlaceResult): { main: string; secondary: string } => {
    const parts = item.display_name.split(',').map(p => p.trim());
    
    // Ana metin: İlk kısım (mahalle/sokak/mekan adı)
    const main = parts[0] || item.display_name;
    
    // İkincil metin: Geri kalan adres
    const secondary = parts.slice(1, 4).join(', ');
    
    return { main, secondary };
  };

  // Seçim işlemi
  const handleSelectPrediction = (item: PlaceResult) => {
    if (!tech) {
      Keyboard.dismiss();
    }
    
    const formatted = formatAddress(item);
    
    console.log('✅ Seçildi:', formatted.main, item.lat, item.lon);
    
    setQuery(formatted.main);
    setShowPredictions(false);
    setShowPopular(false);
    setPredictions([]);
    
    onPlaceSelected({
      address: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    });
  };

  // Popüler mahalle seçimi
  const handleSelectPopular = async (placeName: string) => {
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      const searchQuery = city ? `${placeName}, ${city}, Türkiye` : `${placeName}, Türkiye`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tr&limit=1&accept-language=tr`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LeylekTAG-App/1.0' }
      });
      
      const data: PlaceResult[] = await response.json();
      
      if (data && data.length > 0) {
        const item = data[0];
        setQuery(placeName);
        setShowPredictions(false);
        setShowPopular(false);
        
        onPlaceSelected({
          address: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        });
      }
    } catch (error) {
      console.error('Popüler yer hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => {
    setQuery('');
    setPredictions([]);
    setShowPredictions(false);
    setShowPopular(true);
  };

  // Popüler yerler listesi
  const popularCityKey = resolveCityDataKey(city);
  const popularPlaces =
    hidePopularChips || !popularCityKey || !POPULAR_PLACES[popularCityKey]
      ? []
      : POPULAR_PLACES[popularCityKey];

  return (
    <View style={[styles.container, tech && suggestionsFirst && styles.containerTechSuggestionsFirst]}>
      {/* Öneriler — hedef modalında üstte */}
      {tech && suggestionsFirst
        ? showPredictions &&
          predictions.length > 0 && (
            <View
              style={[
                styles.predictionsContainer,
                tech && styles.predictionsContainerTech,
                tech && styles.predictionsAboveInput,
                { maxHeight: predictionsMaxHeight },
              ]}
            >
              <FlatList
                data={predictions}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const formatted = formatAddress(item);
                  return (
                    <TouchableOpacity
                      style={[styles.predictionItem, tech && styles.predictionItemTech]}
                      onPress={() => handleSelectPrediction(item)}
                    >
                      <View style={[styles.iconContainer, tech && styles.iconContainerTech]}>
                        <Ionicons name="location" size={22} color={tech ? '#38BDF8' : '#3FA9F5'} />
                      </View>
                      <View style={styles.predictionTextContainer}>
                        <Text
                          style={[styles.predictionMainText, tech && styles.predictionMainTextTech]}
                          numberOfLines={2}
                        >
                          {formatted.main}
                        </Text>
                        <Text
                          style={[
                            styles.predictionSecondaryText,
                            tech && styles.predictionSecondaryTextTech,
                          ]}
                          numberOfLines={2}
                        >
                          {formatted.secondary}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={tech ? '#64748B' : '#CCC'} />
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => (
                  <View style={[styles.separator, tech && styles.separatorTech]} />
                )}
              />
            </View>
          )
        : null}

      {/* Arama Kutusu */}
      <View
        style={[
          styles.inputContainer,
          tech && styles.inputContainerTech,
          tech && inputSize === 'large' && styles.inputContainerTechLarge,
        ]}
      >
        <Ionicons
          name="search"
          size={inputSize === 'large' ? 22 : 20}
          color={tech ? '#38BDF8' : '#3FA9F5'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.input, tech && styles.inputTech, tech && inputSize === 'large' && styles.inputTechLarge]}
          placeholder={placeholder}
          placeholderTextColor={tech ? 'rgba(148, 163, 184, 0.95)' : '#999'}
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          returnKeyType="search"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={tech ? '#38BDF8' : '#3FA9F5'}
            style={styles.loader}
          />
        )}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clearInput} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={tech ? '#94A3B8' : '#999'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Popüler Mahalleler */}
      {showPopular && popularPlaces.length > 0 && !hidePopularChips && (
        <View style={styles.popularContainer}>
          <Text style={styles.popularTitle}>📍 {city} Popüler Yerler</Text>
          <View style={styles.popularGrid}>
            {popularPlaces.map((place, index) => (
              <TouchableOpacity
                key={index}
                style={styles.popularChip}
                onPress={() => handleSelectPopular(place)}
              >
                <Text style={styles.popularChipText}>{place}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Öneriler — varsayılan: input altında */}
      {showPredictions && predictions.length > 0 && !(tech && suggestionsFirst) && (
        <View
          style={[
            styles.predictionsContainer,
            tech && styles.predictionsContainerTech,
            { maxHeight: predictionsMaxHeight },
          ]}
        >
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item }) => {
              const formatted = formatAddress(item);
              return (
                <TouchableOpacity
                  style={[styles.predictionItem, tech && styles.predictionItemTech]}
                  onPress={() => handleSelectPrediction(item)}
                >
                  <View style={[styles.iconContainer, tech && styles.iconContainerTech]}>
                    <Ionicons name="location" size={22} color={tech ? '#38BDF8' : '#3FA9F5'} />
                  </View>
                  <View style={styles.predictionTextContainer}>
                    <Text
                      style={[styles.predictionMainText, tech && styles.predictionMainTextTech]}
                      numberOfLines={2}
                    >
                      {formatted.main}
                    </Text>
                    <Text
                      style={[styles.predictionSecondaryText, tech && styles.predictionSecondaryTextTech]}
                      numberOfLines={2}
                    >
                      {formatted.secondary}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={tech ? '#64748B' : '#CCC'} />
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, tech && styles.separatorTech]} />
            )}
          />
        </View>
      )}

      {/* Sonuç Bulunamadı */}
      {showPredictions && predictions.length === 0 && query.length >= 2 && !loading && (
        <View style={[styles.noResultsContainer, tech && styles.noResultsContainerTech]}>
          <Ionicons name="location-outline" size={48} color={tech ? '#475569' : '#DDD'} />
          <Text style={[styles.noResultsText, tech && styles.noResultsTextTech]}>
            {`"${query}" için sonuç bulunamadı`}
          </Text>
          <Text style={[styles.noResultsHint, tech && styles.noResultsHintTech]}>
            Farklı bir arama deneyin
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  containerTechSuggestionsFirst: {
    flexGrow: 1,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: LAYOUT.inputMinHeight,
    paddingVertical: Platform.OS === 'android' ? 4 : 0,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputContainerTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(56, 189, 248, 0.55)',
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 56,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  inputTech: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F1F5F9',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  inputContainerTechLarge: {
    minHeight: 62,
    borderRadius: 18,
    paddingVertical: Platform.OS === 'android' ? 6 : 4,
  },
  inputTechLarge: {
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  
  // Popüler yerler
  popularContainer: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  popularTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 14,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  popularChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: LAYOUT.popularChipMinHeight,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  popularChipText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  
  // Öneriler
  predictionsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  predictionsContainerTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 16,
    marginTop: 12,
  },
  predictionsAboveInput: {
    marginTop: 0,
    marginBottom: 10,
    flexGrow: 1,
    minHeight: 120,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  predictionItemTech: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerTech: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  predictionTextContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  predictionMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  predictionMainTextTech: {
    color: '#F8FAFC',
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  predictionSecondaryTextTech: {
    color: '#94A3B8',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 66,
  },
  separatorTech: {
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
    marginLeft: 66,
  },
  
  // Sonuç yok
  noResultsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noResultsContainerTech: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginTop: 12,
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  noResultsTextTech: {
    color: '#CBD5E1',
  },
  noResultsHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },
  noResultsHintTech: {
    color: '#64748B',
  },
});
