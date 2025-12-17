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
}

export default function PlacesAutocomplete({
  placeholder = 'Nereye gitmek istiyorsunuz?',
  onPlaceSelected,
  initialValue = '',
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
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&language=tr&components=country:tr&types=geocode|establishment`;
      
      console.log('🔍 Places API çağrılıyor:', input);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📍 Places API yanıt:', data.status, data.predictions?.length || 0, 'sonuç');
      
      if (data.status === 'OK' && data.predictions) {
        setPredictions(data.predictions);
        setShowPredictions(true);
      } else if (data.status === 'ZERO_RESULTS') {
        setPredictions([]);
        setShowPredictions(false);
      } else {
        console.error('Places API hatası:', data.status, data.error_message);
        setPredictions([]);
      }
    } catch (error) {
      console.error('Places API isteği hatası:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceDetails = async (placeId: string, description: string) => {
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}&language=tr`;
      
      console.log('📍 Place Details çağrılıyor:', placeId);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        const { lat, lng } = data.result.geometry.location;
        const address = data.result.formatted_address || description;
        
        console.log('✅ Konum bulundu:', address, lat, lng);
        
        setQuery(description);
        setShowPredictions(false);
        setPredictions([]);
        
        onPlaceSelected({
          address,
          latitude: lat,
          longitude: lng,
        });
      } else {
        console.error('Place Details hatası:', data.status);
      }
    } catch (error) {
      console.error('Place Details isteği hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrediction = (prediction: PlacePrediction) => {
    getPlaceDetails(prediction.place_id, prediction.description);
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
