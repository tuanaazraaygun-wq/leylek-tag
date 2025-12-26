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

interface PlacesAutocompleteProps {
  placeholder?: string;
  onPlaceSelected: (place: PlaceDetails) => void;
  initialValue?: string;
  city?: string;
}

export default function PlacesAutocomplete({
  placeholder = 'Mahalle, sokak veya mekan ara...',
  onPlaceSelected,
  initialValue = '',
  city = '',
}: PlacesAutocompleteProps) {
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
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Nominatim API ile arama (ÜCRETSİZ)
  const searchPlaces = async (input: string) => {
    setLoading(true);
    try {
      // Şehir bilgisi varsa bbox ekle
      const cityData = city ? CITY_DATA[city] : null;
      
      // Arama sorgusunu hazırla
      let searchQuery = input;
      if (city && !input.toLowerCase().includes(city.toLowerCase())) {
        searchQuery = `${input}, ${city}`;
      }
      
      // Nominatim API - OpenStreetMap ücretsiz servisi
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tr&addressdetails=1&limit=10&accept-language=tr`;
      
      // Şehir sınırları varsa ekle
      if (cityData) {
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
        // Sonuçları filtrele ve formatla
        const filtered = data.filter(item => {
          // Ülke, il gibi çok geniş sonuçları çıkar
          return !['country', 'state', 'county'].includes(item.type);
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
    Keyboard.dismiss();
    
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
  const popularPlaces = city && POPULAR_PLACES[city] ? POPULAR_PLACES[city] : [];

  return (
    <View style={styles.container}>
      {/* Arama Kutusu */}
      <View style={styles.inputContainer}>
        <Ionicons name="search" size={20} color="#3FA9F5" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color="#3FA9F5" style={styles.loader} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clearInput} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Popüler Mahalleler */}
      {showPopular && popularPlaces.length > 0 && (
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

      {/* Öneriler Listesi */}
      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const formatted = formatAddress(item);
              return (
                <TouchableOpacity
                  style={styles.predictionItem}
                  onPress={() => handleSelectPrediction(item)}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="location" size={22} color="#3FA9F5" />
                  </View>
                  <View style={styles.predictionTextContainer}>
                    <Text style={styles.predictionMainText} numberOfLines={1}>
                      {formatted.main}
                    </Text>
                    <Text style={styles.predictionSecondaryText} numberOfLines={2}>
                      {formatted.secondary}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}

      {/* Sonuç Bulunamadı */}
      {showPredictions && predictions.length === 0 && query.length >= 2 && !loading && (
        <View style={styles.noResultsContainer}>
          <Ionicons name="location-outline" size={48} color="#DDD" />
          <Text style={styles.noResultsText}>"{query}" için sonuç bulunamadı</Text>
          <Text style={styles.noResultsHint}>Farklı bir arama deneyin</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  popularTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    marginTop: 8,
    maxHeight: 350,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
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
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
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
  noResultsText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  noResultsHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },
});
