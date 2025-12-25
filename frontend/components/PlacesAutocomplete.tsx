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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAKqhXyi2cUC3GHLxjom4R_tQ3UfR5auUw';

// Türkiye şehirlerinin koordinatları
const CITY_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  'İstanbul': { lat: 41.0082, lng: 28.9784 },
  'Ankara': { lat: 39.9334, lng: 32.8597 },
  'İzmir': { lat: 38.4237, lng: 27.1428 },
  'Bursa': { lat: 40.1885, lng: 29.0610 },
  'Antalya': { lat: 36.8969, lng: 30.7133 },
  'Adana': { lat: 37.0000, lng: 35.3213 },
  'Konya': { lat: 37.8746, lng: 32.4932 },
  'Gaziantep': { lat: 37.0662, lng: 37.3833 },
  'Şanlıurfa': { lat: 37.1591, lng: 38.7969 },
  'Kocaeli': { lat: 40.8533, lng: 29.8815 },
  'Mersin': { lat: 36.8000, lng: 34.6333 },
  'Diyarbakır': { lat: 37.9144, lng: 40.2306 },
  'Hatay': { lat: 36.4018, lng: 36.3498 },
  'Manisa': { lat: 38.6191, lng: 27.4289 },
  'Kayseri': { lat: 38.7312, lng: 35.4787 },
  'Samsun': { lat: 41.2867, lng: 36.3300 },
  'Balıkesir': { lat: 39.6484, lng: 27.8826 },
  'Kahramanmaraş': { lat: 37.5858, lng: 36.9371 },
  'Van': { lat: 38.4891, lng: 43.4089 },
  'Aydın': { lat: 37.8560, lng: 27.8416 },
};

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
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
  city?: string; // Kullanıcının şehri - sonuçları filtrele
}

export default function PlacesAutocomplete({
  placeholder = 'Nereye gitmek istiyorsunuz?',
  onPlaceSelected,
  initialValue = '',
  city = '',
}: PlacesAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const searchPlaces = async (input: string) => {
    setLoading(true);
    try {
      // Şehir koordinatlarını al
      const cityCoords = city ? CITY_COORDINATES[city] : null;
      
      // Arama sorgusuna şehri ekle
      const searchQuery = city ? `${input}, ${city}, Türkiye` : `${input} Türkiye`;
      
      // Places API (New) Text Search kullanımı
      const url = `https://places.googleapis.com/v1/places:searchText`;
      
      console.log('🔍 Places API çağrılıyor:', searchQuery, cityCoords ? `(${city} odaklı)` : '');
      
      // Request body oluştur
      const requestBody: any = {
        textQuery: searchQuery,
        languageCode: 'tr',
        regionCode: 'TR',
        maxResultCount: 8
      };
      
      // Şehir varsa location bias ekle
      if (cityCoords) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: cityCoords.lat,
              longitude: cityCoords.lng
            },
            radius: 50000.0 // 50 km yarıçap
          }
        };
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      console.log('📍 Places API yanıt:', data?.places?.length || 0, 'sonuç');
      
      if (data.places && data.places.length > 0) {
        // Şehir filtresi uygula - sadece o şehirdeki sonuçları göster
        let filteredPlaces = data.places;
        
        if (city) {
          filteredPlaces = data.places.filter((place: any) => {
            const address = place.formattedAddress || '';
            // Şehir adını içeriyorsa göster
            return address.toLowerCase().includes(city.toLowerCase());
          });
          
          // Filtreleme sonucu boşsa tüm sonuçları göster
          if (filteredPlaces.length === 0) {
            filteredPlaces = data.places;
          }
        }
        
        const formattedPredictions = filteredPlaces.map((place: any) => ({
          place_id: place.id,
          description: place.formattedAddress || place.displayName?.text,
          structured_formatting: {
            main_text: place.displayName?.text || '',
            secondary_text: place.formattedAddress || ''
          },
          location: place.location
        }));
        setPredictions(formattedPredictions);
        setShowPredictions(true);
      } else {
        // Fallback: Eski API dene
        let oldUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}&language=tr&components=country:tr`;
        
        // Şehir varsa location bias ekle
        if (cityCoords) {
          oldUrl += `&location=${cityCoords.lat},${cityCoords.lng}&radius=50000`;
        }
        
        const oldResponse = await fetch(oldUrl);
        const oldData = await oldResponse.json();
        
        if (oldData.status === 'OK' && oldData.predictions) {
          // Şehir filtresi
          let filteredPredictions = oldData.predictions;
          if (city) {
            filteredPredictions = oldData.predictions.filter((p: any) => 
              p.description.toLowerCase().includes(city.toLowerCase())
            );
            if (filteredPredictions.length === 0) {
              filteredPredictions = oldData.predictions;
            }
          }
          setPredictions(filteredPredictions);
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(false);
        }
      }
    } catch (error) {
      console.error('Places API isteği hatası:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceDetails = async (placeId: string, description: string, location?: any) => {
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      // Eğer location zaten varsa (yeni API'den geldi), direkt kullan
      if (location && location.latitude && location.longitude) {
        console.log('✅ Konum (yeni API):', description, location);
        setQuery(description);
        setShowPredictions(false);
        setPredictions([]);
        onPlaceSelected({
          address: description,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setLoading(false);
        return;
      }
      
      // Yeni API ile detay al
      const url = `https://places.googleapis.com/v1/places/${placeId}`;
      
      console.log('📍 Place Details (New) çağrılıyor:', placeId);
      
      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'location,formattedAddress,displayName'
        }
      });
      
      const data = await response.json();
      
      if (data.location) {
        const address = data.formattedAddress || data.displayName?.text || description;
        
        console.log('✅ Konum bulundu:', address, data.location);
        
        setQuery(description);
        setShowPredictions(false);
        setPredictions([]);
        
        onPlaceSelected({
          address,
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        });
      } else {
        // Fallback: Eski API
        const oldUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}&language=tr`;
        const oldResponse = await fetch(oldUrl);
        const oldData = await oldResponse.json();
        
        if (oldData.status === 'OK' && oldData.result) {
          const { lat, lng } = oldData.result.geometry.location;
          const address = oldData.result.formatted_address || description;
          
          setQuery(description);
          setShowPredictions(false);
          setPredictions([]);
          
          onPlaceSelected({ address, latitude: lat, longitude: lng });
        }
      }
    } catch (error) {
      console.error('Place Details hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrediction = (prediction: any) => {
    getPlaceDetails(prediction.place_id, prediction.description, prediction.location);
  };

  const clearInput = () => {
    setQuery('');
    setPredictions([]);
    setShowPredictions(false);
  };

  return (
    <View style={styles.container}>
      {/* Arama Kutusu */}
      <View style={styles.inputContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color="#00A67E" style={styles.loader} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={clearInput} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Öneriler Listesi */}
      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.predictionItem}
                onPress={() => handleSelectPrediction(item)}
              >
                <Ionicons name="location" size={24} color="#00A67E" style={styles.locationIcon} />
                <View style={styles.predictionTextContainer}>
                  <Text style={styles.predictionMainText} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description.split(',')[0]}
                  </Text>
                  <Text style={styles.predictionSecondaryText} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}

      {/* Sonuç Bulunamadı */}
      {showPredictions && predictions.length === 0 && query.length >= 2 && !loading && (
        <View style={styles.noResultsContainer}>
          <Ionicons name="sad-outline" size={40} color="#ccc" />
          <Text style={styles.noResultsText}>Sonuç bulunamadı</Text>
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
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  predictionsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  locationIcon: {
    marginRight: 12,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 48,
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 8,
  },
  noResultsText: {
    marginTop: 10,
    fontSize: 14,
    color: '#999',
  },
});
